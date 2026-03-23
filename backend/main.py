"""
NeuralOps — Main FastAPI Application
Connects classifier, router, model client, cost tracker, and database.
"""

import asyncio
import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from classifier import classify_request
from router import (
    get_healthy_model,
    get_all_models,
    toggle_model_health,
    pick_battle_winner,
    ROUTING_TABLE,
)
from model_client import call_model
from cost_tracker import calculate_costs
from database import init_db, save_request, get_stats, get_history, reset_requests
from models import (
    RouteRequest,
    RouteResponse,
    BattleRequest,
    BattleResult,
    BattleResponse,
    StatsResponse,
    HealthToggleRequest,
)

# ---------------------------------------------------------------------------
# WebSocket connections
# ---------------------------------------------------------------------------
active_connections: list[WebSocket] = []


async def broadcast(message: dict):
    """Send a message to all active WebSocket clients."""
    dead_connections = []
    for connection in active_connections:
        try:
            await connection.send_text(json.dumps(message, default=str))
        except Exception:
            dead_connections.append(connection)
    for dead in dead_connections:
        if dead in active_connections:
            active_connections.remove(dead)


# ---------------------------------------------------------------------------
# App lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    print("[NEURALOPS] Database initialized. Server ready.")
    yield


app = FastAPI(title="NeuralOps", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://neuralops-x.vercel.app",
        "https://nueral-ops.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_origin_regex=r"^https://([a-zA-Z0-9-]+\.)*vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# ENDPOINT 1: GET /ping
# ---------------------------------------------------------------------------
@app.get("/ping")
async def ping():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ---------------------------------------------------------------------------
# ENDPOINT 2: POST /route
# ---------------------------------------------------------------------------
@app.post("/route", response_model=RouteResponse)
async def route_request(req: RouteRequest):
    # a. Classify
    classification = await classify_request(req.text)

    # b. Get healthy model
    model_config = get_healthy_model(classification["complexity"])

    # c. Call model
    response = await call_model(model_config, req.text)

    # d. Check for error
    if response.get("error"):
        raise HTTPException(status_code=500, detail=f"Model error: {response['error']}")

    # e. Calculate costs
    cost_data = calculate_costs(
        model_config["model_key"],
        model_config["cost_per_1k_tokens"],
        response["input_tokens"],
        response["output_tokens"],
    )

    # f. Generate request ID
    request_id = str(uuid.uuid4())

    # g. Save to database
    await save_request(
        {
            "request_id": request_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "input_text": req.text,
            "complexity": classification["complexity"],
            "confidence": classification["confidence"],
            "routing_reason": classification["reason"],
            "model_used": model_config["model_name"],
            "model_key": model_config["model_key"],
            "tier": model_config["tier"],
            "response_text": response["text"],
            "latency_ms": response["latency_ms"],
            "input_tokens": response["input_tokens"],
            "output_tokens": response["output_tokens"],
            "actual_cost": cost_data["actual_cost"],
            "cost_without_neuralops": cost_data["cost_without_neuralops"],
            "savings": cost_data["savings"],
            "savings_percentage": cost_data["savings_percentage"],
            "is_fallback": 1 if model_config.get("is_fallback") else 0,
            "status": "success",
        }
    )

    # h. Broadcast new request + updated stats via WebSocket
    await broadcast(
        {
            "type": "new_request",
            "data": {
                "request_id": request_id,
                "model_used": model_config["model_name"],
                "complexity": classification["complexity"],
                "tier": model_config["tier"],
                "savings": cost_data["savings"],
                "latency_ms": response["latency_ms"],
                "input_text": req.text,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        }
    )

    current_stats = await get_stats()
    if current_stats:
        await broadcast({"type": "stats_update", "data": current_stats})

    # i. Return RouteResponse
    return RouteResponse(
        request_id=request_id,
        response=response["text"],
        model_used=model_config["model_name"],
        model_key=model_config["model_key"],
        tier=model_config["tier"],
        complexity=classification["complexity"],
        confidence=round(classification["confidence"], 6),
        routing_reason=classification["reason"],
        latency_ms=response["latency_ms"],
        input_tokens=response["input_tokens"],
        output_tokens=response["output_tokens"],
        actual_cost=round(cost_data["actual_cost"], 6),
        cost_without_neuralops=round(cost_data["cost_without_neuralops"], 6),
        savings=round(cost_data["savings"], 6),
        savings_percentage=round(cost_data["savings_percentage"], 6),
        is_fallback=bool(model_config.get("is_fallback")),
    )


# ---------------------------------------------------------------------------
# ENDPOINT 3: POST /battle
# ---------------------------------------------------------------------------
@app.post("/battle", response_model=BattleResponse)
async def battle(req: BattleRequest):
    # a. Get models — prefer healthy ones
    all_models = get_all_models()
    healthy_models = [m for m in all_models if m.get("healthy", True)]
    models_to_use = healthy_models if len(healthy_models) >= 2 else all_models

    # b. Call all models simultaneously
    tasks = [call_model(m, req.text) for m in models_to_use]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    # c. Build BattleResult list
    battle_results = []
    for i, result in enumerate(raw_results):
        if isinstance(result, Exception):
            continue
        if result.get("error"):
            continue

        config = models_to_use[i]
        cost_data = calculate_costs(
            config["model_key"],
            config["cost_per_1k_tokens"],
            result["input_tokens"],
            result["output_tokens"],
        )

        battle_results.append(
            BattleResult(
                model_name=config["model_name"],
                model_key=config["model_key"],
                tier=config["tier"],
                response=result["text"],
                latency_ms=result["latency_ms"],
                input_tokens=result["input_tokens"],
                output_tokens=result["output_tokens"],
                actual_cost=round(cost_data["actual_cost"], 6),
                cost_without_neuralops=round(cost_data["cost_without_neuralops"], 6),
                savings_percentage=round(cost_data["savings_percentage"], 6),
                composite_score=0.0,  # filled by pick_battle_winner
            )
        )

    if not battle_results:
        raise HTTPException(status_code=500, detail="All models failed during battle")

    # d. Classify prompt complexity
    classification = await classify_request(req.text)

    # e. Pick winner (complexity-aware)
    results_for_scoring = [
        {
            "model_name": r.model_name,
            "savings_percentage": r.savings_percentage,
            "latency_ms": r.latency_ms,
            "tier": r.tier,
        }
        for r in battle_results
    ]
    winner = pick_battle_winner(results_for_scoring, complexity=classification["complexity"])

    # Update composite scores on results
    for r in battle_results:
        scoring_entry = next(
            (s for s in results_for_scoring if s["model_name"] == r.model_name), None
        )
        if scoring_entry and "_composite" in scoring_entry:
            r.composite_score = round(scoring_entry["_composite"], 4)

    # f. Save winner result to database + broadcast via WebSocket
    # Match winner by model_name; resolve correct tier from router config
    winning_tier = None
    for model_config in get_all_models():
        if model_config["model_name"] == winner["model_name"]:
            winning_tier = model_config["tier"]
            break

    winner_result = None
    for r in battle_results:
        if r.model_name == winner["model_name"]:
            winner_result = r
            break

    # Fallback to first result only if not found
    if not winner_result:
        winner_result = battle_results[0]

    # Override tier with correct value from router
    if winning_tier:
        winner_result.tier = winning_tier

    print(f"BATTLE WINNER: {winner['model_name']} tier={winner_result.tier} saved to DB")

    if winner_result:
        battle_request_id = str(uuid.uuid4())
        await save_request(
            {
                "request_id": battle_request_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "input_text": req.text,
                "complexity": classification["complexity"],
                "confidence": classification["confidence"],
                "routing_reason": f"Battle winner: {winner['winner_reason']}",
                "model_used": winner_result.model_name,
                "model_key": winner_result.model_key,
                "tier": winner_result.tier,
                "response_text": winner_result.response,
                "latency_ms": winner_result.latency_ms,
                "input_tokens": winner_result.input_tokens,
                "output_tokens": winner_result.output_tokens,
                "actual_cost": winner_result.actual_cost,
                "cost_without_neuralops": winner_result.cost_without_neuralops,
                "savings" : round(winner_result.cost_without_neuralops - winner_result.actual_cost, 6),
                "savings_percentage": winner_result.savings_percentage,
                "is_fallback": 0,
                "status": "success",
            }
        )

        await broadcast(
            {
                "type": "new_request",
                "data": {
                    "request_id": battle_request_id,
                    "model_used": winner_result.model_name,
                    "complexity": classification["complexity"],
                    "tier": winner_result.tier,
                    "savings": round(winner_result.actual_cost * (winner_result.savings_percentage / 100), 6),
                    "latency_ms": winner_result.latency_ms,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            }
        )

        current_stats = await get_stats()
        if current_stats:
            await broadcast({"type": "stats_update", "data": current_stats})

    # g. Return BattleResponse
    return BattleResponse(
        results=battle_results,
        neuralops_choice=winner,
        complexity=classification["complexity"],
        complexity_reason=classification["reason"],
    )


# ---------------------------------------------------------------------------
# ENDPOINT 4: GET /stats
# ---------------------------------------------------------------------------
@app.get("/stats", response_model=StatsResponse)
async def stats():
    data = await get_stats()
    if data is None:
        return StatsResponse(
            total_requests=0,
            total_actual_cost=0.0,
            total_cost_without_neuralops=0.0,
            total_savings=0.0,
            total_savings_percentage=0.0,
            avg_latency_ms=0.0,
            routing_distribution={"economy": 0, "standard": 0, "premium": 0},
            requests_per_minute=0.0,
        )
    return StatsResponse(**data, requests_per_minute=0.0)


# ---------------------------------------------------------------------------
# ENDPOINT 5: GET /history
# ---------------------------------------------------------------------------
@app.get("/history")
async def history(limit: int = Query(20, ge=1, le=10000), offset: int = Query(0, ge=0)):
    data = await get_history(limit, offset)
    return data if data is not None else []


# ---------------------------------------------------------------------------
# ENDPOINT 6: POST /health/toggle
# ---------------------------------------------------------------------------
@app.post("/health/toggle")
async def health_toggle(req: HealthToggleRequest):
    new_state = toggle_model_health(req.model_key, req.healthy)

    await broadcast(
        {
            "type": "health_change",
            "data": {"model_key": req.model_key, "healthy": new_state},
        }
    )

    return {"model_key": req.model_key, "healthy": new_state}


# ---------------------------------------------------------------------------
# ENDPOINT 7: GET /health
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"models": get_all_models()}


# ---------------------------------------------------------------------------
# ENDPOINT 8: GET /models
# ---------------------------------------------------------------------------
@app.get("/models")
async def models_endpoint():
    """Return all configured models with display metadata."""
    all_models = get_all_models()
    result = []
    for m in all_models:
        cost = m.get("cost_per_1k_tokens", 0)
        price_per_million = cost * 1000
        result.append({
            "id": m["model_key"],
            "name": m["model_name"],
            "tier": m["tier"],
            "cost_per_1k_tokens": cost,
            "price_display": f"${price_per_million:.2f}/1M",
            "healthy": m.get("healthy", True),
        })
    return {"models": result}


# ---------------------------------------------------------------------------
# ENDPOINT 9: DELETE /admin/reset
# ---------------------------------------------------------------------------
@app.delete("/admin/reset")
async def reset_db():
    await reset_requests()
    return {"status": "ok", "message": "Database reset"}


# ---------------------------------------------------------------------------
# WEBSOCKET: /ws
# ---------------------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        # Send current stats immediately on connect
        current_stats = await get_stats()
        if current_stats:
            await websocket.send_text(
                json.dumps({"type": "stats_update", "data": current_stats}, default=str)
            )

        # Keep alive loop
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)


# ---------------------------------------------------------------------------
# Run with: uvicorn main:app --reload --port 8000
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

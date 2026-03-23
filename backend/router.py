"""
NeuralOps — Model Routing Engine
Pure Python logic: routing table, health state, fallback chain, battle scoring.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Routing Table — maps complexity level to model config
# ---------------------------------------------------------------------------
ROUTING_TABLE = {
    "SIMPLE": {
        "model_key": "llama-3.1-8b-instant",
        "model_name": "Llama 3.1 8B",
        "api_model": os.getenv("CHEAP_MODEL", "llama-3.1-8b-instant"),
        "provider": "groq",
        "cost_per_1k_tokens": 0.00006,
        "tier": "economy",
    },
    "MEDIUM": {
        "model_key": "llama-3.3-70b-versatile",
        "model_name": "Llama 3.3 70B",
        "api_model": os.getenv("MID_MODEL", "llama-3.3-70b-versatile"),
        "provider": "groq",
        "cost_per_1k_tokens": 0.00059,
        "tier": "standard",
    },
    "COMPLEX": {
        "model_key": "qwen/qwen3-32b",
        "model_name": "Qwen 3 32B",
        "api_model": os.getenv("PREMIUM_MODEL", "qwen/qwen3-32b"),
        "provider": "groq",
        "cost_per_1k_tokens": 0.00090,
        "tier": "premium",
    },
}

# ---------------------------------------------------------------------------
# Health State — True = healthy, False = degraded
# ---------------------------------------------------------------------------
HEALTH_STATE = {
    "llama-3.1-8b-instant": True,
    "llama-3.3-70b-versatile": True,
    "qwen/qwen3-32b": True,
}

# Fallback chains per complexity level
_FALLBACK_CHAINS = {
    "SIMPLE": ["SIMPLE", "MEDIUM", "COMPLEX"],
    "MEDIUM": ["MEDIUM", "COMPLEX", "SIMPLE"],
    "COMPLEX": ["COMPLEX", "MEDIUM", "SIMPLE"],
}


def get_healthy_model(complexity: str) -> dict:
    """
    Return the best healthy model for the given complexity.
    Walks the fallback chain if preferred model is unhealthy.
    Always returns a valid model config dict with 'is_fallback' flag.
    """
    chain = _FALLBACK_CHAINS.get(complexity, _FALLBACK_CHAINS["COMPLEX"])

    for i, level in enumerate(chain):
        config = ROUTING_TABLE[level]
        if HEALTH_STATE.get(config["model_key"], True):
            result = {**config, "is_fallback": i > 0}
            return result

    # All models unhealthy — force return the preferred one anyway
    config = ROUTING_TABLE[chain[0]]
    return {**config, "is_fallback": True}


def toggle_model_health(model_key: str, healthy: bool) -> bool:
    """Update health state for a model. Returns the new value."""
    HEALTH_STATE[model_key] = healthy
    return HEALTH_STATE[model_key]


def get_all_models() -> list:
    """Return all 3 model configs with current health state."""
    models = []
    for level in ("SIMPLE", "MEDIUM", "COMPLEX"):
        config = {**ROUTING_TABLE[level]}
        config["healthy"] = HEALTH_STATE.get(config["model_key"], True)
        models.append(config)
    return models


def pick_battle_winner(results: list, complexity: str = "SIMPLE") -> dict:
    """
    Score each battle result and pick the winner.
    Uses tier-based quality scores so the right model wins per complexity:
      SIMPLE  → economy wins  (cost-dominated)
      MEDIUM  → standard wins (quality-dominated, standard rated highest)
      COMPLEX → premium wins  (quality-dominated, premium rated highest)
    """
    tier_quality_map = {
        "economy":  {"SIMPLE": 0.9, "MEDIUM": 0.5, "COMPLEX": 0.4},
        "standard": {"SIMPLE": 0.7, "MEDIUM": 0.9, "COMPLEX": 0.7},
        "premium":  {"SIMPLE": 0.6, "MEDIUM": 0.7, "COMPLEX": 1.0},
    }

    if complexity == "SIMPLE":
        cost_w, speed_w, quality_w = 0.80, 0.15, 0.05
    elif complexity == "MEDIUM":
        cost_w, speed_w, quality_w = 0.15, 0.15, 0.70
    else:  # COMPLEX
        cost_w, speed_w, quality_w = 0.05, 0.05, 0.90

    best = None
    best_score = -1

    for r in results:
        tier = r.get("tier", "economy")
        quality = tier_quality_map.get(tier, {}).get(complexity, 0.5)
        cost_score = r.get("savings_percentage", 0) / 100
        latency = max(r.get("latency_ms", 1), 1)
        speed_score = min(1.0, 1000 / latency)

        composite = round(
            (quality * quality_w) + (cost_score * cost_w) + (speed_score * speed_w),
            4,
        )

        r["_composite"] = composite

        if composite > best_score:
            best_score = composite
            best = r

    savings = best.get("savings_percentage", 0)
    latency = best.get("latency_ms", 0)
    model_name = best["model_name"]

    if complexity == "SIMPLE":
        reason = (
            f"Simple query — {model_name} saves {savings:.1f}% "
            f"with identical quality"
        )
    elif complexity == "MEDIUM":
        reason = (
            f"Balanced query — {model_name} offers best "
            f"quality-cost ratio at {latency}ms"
        )
    else:
        reason = (
            f"Complex reasoning required — {model_name} selected "
            f"for superior quality ({latency}ms)"
        )

    return {
        "model_name": model_name,
        "winner_reason": reason,
        "composite_score": round(best_score, 4),
    }


if __name__ == "__main__":
    print("=== All Models ===")
    for m in get_all_models():
        print(f"  {m['model_name']} ({m['tier']}) — healthy: {m['healthy']}")

    print("\n=== Normal Routing ===")
    for level in ("SIMPLE", "MEDIUM", "COMPLEX"):
        model = get_healthy_model(level)
        print(f"  {level} → {model['model_name']} (fallback: {model['is_fallback']})")

    print("\n=== Fallback Scenario: disable economy model ===")
    toggle_model_health("llama-3.1-8b-instant", False)
    model = get_healthy_model("SIMPLE")
    print(f"  SIMPLE → {model['model_name']} (fallback: {model['is_fallback']})")
    toggle_model_health("llama-3.1-8b-instant", True)  # restore

    print("\n=== Battle Winner ===")
    winner = pick_battle_winner([
        {"model_name": "Llama 3.1 8B", "savings_percentage": 98.1, "latency_ms": 200},
        {"model_name": "Llama 3.3 70B", "savings_percentage": 90.6, "latency_ms": 450},
        {"model_name": "Llama 3.3 70B", "savings_percentage": 0.0, "latency_ms": 800},
    ])
    print(f"  Winner: {winner['model_name']}")
    print(f"  Reason: {winner['winner_reason']}")
    print(f"  Score:  {winner['composite_score']}")

"""
NeuralOps — Pydantic Request/Response Models (v2)
"""

from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class RouteRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    text: str = Field(..., min_length=1, max_length=10000)
    session_id: Optional[str] = None


class RouteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: str
    response: str
    model_used: str
    model_key: str
    tier: str
    complexity: str
    confidence: float
    routing_reason: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    actual_cost: float
    cost_without_neuralops: float
    savings: float
    savings_percentage: float
    is_fallback: bool


class BattleRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    text: str = Field(..., min_length=1, max_length=10000)


class BattleResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    model_name: str
    model_key: str
    tier: str
    response: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    actual_cost: float
    cost_without_neuralops: float
    savings_percentage: float
    composite_score: float


class BattleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    results: list[BattleResult]
    neuralops_choice: dict
    complexity: str = "MEDIUM"
    complexity_reason: str = ""


class StatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_requests: int
    total_actual_cost: float
    total_cost_without_neuralops: float
    total_savings: float
    total_savings_percentage: float
    avg_latency_ms: float
    routing_distribution: dict
    requests_per_minute: float = 0.0


class HealthToggleRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    model_key: str
    healthy: bool

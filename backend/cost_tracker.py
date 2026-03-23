"""
NeuralOps — Cost Tracking Module
Pure math: cost calculation and ROI projection. No API calls.
"""

# Groq pricing per 1M tokens → converted to per 1K
# Economy:  Llama 3.1 8B  → $0.06/1M  = $0.00006/1K
# Standard: Llama 3.3 70B → $0.59/1M  = $0.00059/1K
# Premium:  Qwen 3 32B    → $0.90/1M  = $0.00090/1K

PREMIUM_COST_PER_1K = 0.00400  # $4/1M = GPT-5/Claude Sonnet 4.6/Gemini avg

MODEL_PRICING = {
    "llama-3.1-8b-instant":    0.00006,   # $0.06/1M
    "llama-3.3-70b-versatile": 0.00059,   # $0.59/1M
    "qwen/qwen3-32b":          0.00090,   # $0.90/1M
}

def calculate_costs(
    model_key: str,
    cost_per_1k: float,
    input_tokens: int,
    output_tokens: int,
) -> dict:
    """Calculate actual cost, premium baseline, savings, and savings %."""
    total_tokens = input_tokens + output_tokens

    # Use known pricing if model_key matches, else use passed cost_per_1k
    actual_price = MODEL_PRICING.get(model_key, cost_per_1k)

    actual_cost  = (total_tokens / 1000) * actual_price
    premium_cost = (total_tokens / 1000) * PREMIUM_COST_PER_1K

    savings     = max(0.0, premium_cost - actual_cost)
    savings_pct = (savings / premium_cost * 100) if premium_cost > 0 else 0.0

    return {
        "actual_cost":            round(actual_cost, 8),
        "cost_without_neuralops": round(premium_cost, 8),
        "savings":                round(savings, 8),
        "savings_percentage":     round(savings_pct, 2),
        "total_tokens":           total_tokens,
    }


def calculate_roi_projection(
    monthly_spend: float,
    savings_percentage: float,
) -> dict:
    """Project ROI based on monthly AI spend and estimated savings %."""
    monthly_savings    = monthly_spend * (savings_percentage / 100)
    annual_savings     = monthly_savings * 12
    raw_fee            = monthly_savings * 0.03          # 3% of savings
    neuralops_fee      = max(99.0, min(9999.0, raw_fee)) # min $99, max $9999
    net_monthly_savings = monthly_savings - neuralops_fee
    payback_days       = (neuralops_fee / monthly_savings * 30) if monthly_savings > 0 else 0
    roi_percentage     = (net_monthly_savings / neuralops_fee * 100) if neuralops_fee > 0 else 0

    return {
        "monthly_savings":        round(monthly_savings, 2),
        "annual_savings":         round(annual_savings, 2),
        "neuralops_monthly_fee":  round(neuralops_fee, 2),
        "net_monthly_savings":    round(net_monthly_savings, 2),
        "payback_days":           round(payback_days, 1),
        "roi_percentage":         round(roi_percentage, 1),
    }


if __name__ == "__main__":
    print("=== calculate_costs ===\n")
    scenarios = [
        ("economy  (Llama 3.1 8B)",  "llama-3.1-8b-instant",    0.00006, 50,  50),
        ("standard (Llama 3.3 70B)", "llama-3.3-70b-versatile", 0.00059, 250, 250),
        ("premium  (Qwen 3 32B)",    "qwen/qwen3-32b",          0.00090, 500, 500),
    ]
    for label, key, cost_per_1k, in_tok, out_tok in scenarios:
        result = calculate_costs(key, cost_per_1k, in_tok, out_tok)
        print(f"  {label}:")
        print(f"    tokens:       {result['total_tokens']}")
        print(f"    actual_cost:  ${result['actual_cost']:.8f}")
        print(f"    baseline:     ${result['cost_without_neuralops']:.8f}")
        print(f"    savings:      ${result['savings']:.8f}")
        print(f"    savings_pct:  {result['savings_percentage']}%")
        print()

    print("=== calculate_roi_projection ===\n")
    print("  Monthly spend: $50,000 | Savings: 68%\n")
    roi = calculate_roi_projection(50000, 68)
    for k, v in roi.items():
        print(f"    {k}: {v}")
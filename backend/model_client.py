"""
NeuralOps — Async Model Client (Groq API)
Unified interface for calling Groq-hosted models via AsyncGroq client.
"""

import os
import re
import sys
import time
from groq import AsyncGroq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

client = AsyncGroq(api_key=GROQ_API_KEY)


def _log_error(msg: str):
    """Log error to stderr with timestamp."""
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[MODEL_CLIENT {ts}] ERROR: {msg}", file=sys.stderr)


def clean_response(text: str) -> str:
    """Remove <think>...</think> and <thinking>...</thinking> blocks from model output."""
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    text = re.sub(r'<thinking>.*?</thinking>', '', text, flags=re.DOTALL)
    return text.strip()


async def call_groq(api_model: str, text: str) -> dict:
    """
    Call a Groq model asynchronously.
    Returns dict with text, token counts, latency, and error field.
    Never raises exceptions.
    """
    try:
        start = time.perf_counter()

        completion = await client.chat.completions.create(
            model=api_model,
            messages=[{"role": "user", "content": text}],
            timeout=30,
        )

        latency_ms = int((time.perf_counter() - start) * 1000)
        response_text = completion.choices[0].message.content or ""
        response_text = clean_response(response_text)

        # Token counting from usage
        usage = completion.usage
        if usage:
            input_tokens = usage.prompt_tokens or 0
            output_tokens = usage.completion_tokens or 0
        else:
            # Fallback estimation
            input_tokens = int(len(text.split()) * 1.3)
            output_tokens = int(len(response_text.split()) * 1.3)

        return {
            "text": response_text,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "latency_ms": latency_ms,
            "error": None,
        }

    except Exception as e:
        _log_error(f"call_groq({api_model}): {e}")
        return {
            "text": "",
            "input_tokens": 0,
            "output_tokens": 0,
            "latency_ms": 0,
            "error": str(e),
        }


async def call_model(model_config: dict, text: str) -> dict:
    """
    Unified dispatcher. Calls call_groq() with the config's api_model,
    then attaches model metadata to the result.
    """
    result = await call_groq(model_config["api_model"], text)

    result["model_key"] = model_config["model_key"]
    result["model_name"] = model_config["model_name"]
    result["tier"] = model_config["tier"]
    result["cost_per_1k_tokens"] = model_config["cost_per_1k_tokens"]

    return result


if __name__ == "__main__":
    import asyncio
    from router import ROUTING_TABLE

    async def test():
        config = ROUTING_TABLE["SIMPLE"]
        print(f"Testing model: {config['model_name']} ({config['api_model']})")
        print(f"Prompt: What is the capital of France?\n")

        result = await call_model(config, "What is the capital of France?")

        if result["error"]:
            print(f"ERROR: {result['error']}")
        else:
            print(f"Response: {result['text'][:100]}")
            print(f"Latency:  {result['latency_ms']}ms")
            print(f"Tokens:   {result['input_tokens']} in / {result['output_tokens']} out")
            print(f"Model:    {result['model_name']} ({result['tier']})")

    asyncio.run(test())

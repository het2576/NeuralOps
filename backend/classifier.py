"""
NeuralOps — Prompt Complexity Classifier
Uses Groq (Llama 3.1 8B) to classify prompts as SIMPLE / MEDIUM / COMPLEX.
"""

import os
import json
import asyncio
from groq import AsyncGroq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
CLASSIFIER_MODEL = os.getenv("CLASSIFIER_MODEL", "llama-3.1-8b-instant")

client = AsyncGroq(api_key=GROQ_API_KEY)

CLASSIFICATION_PROMPT = """You are a request classifier for an AI routing system.
Classify the following request into exactly one category.

Categories:
- SIMPLE: factual questions, calculations, definitions, yes/no questions,
          single fact lookups, date/time queries, unit conversions,
          simple creative writing (short poems, jokes, fun stories about animals,
          write a haiku/limerick/rhyme), basic greetings, translations
- MEDIUM: explanations, comparisons, summaries, short analysis,
          how-to questions, basic coding help, longer essays,
          multi-paragraph stories, product descriptions
- COMPLEX: multi-step reasoning, system design, architecture decisions,
           detailed technical analysis, code generation for complex systems,
           debate/ethical questions, research synthesis, business proposals

IMPORTANT: 'Write a poem about X' or 'Tell me a joke about X' should be SIMPLE.
Only classify as COMPLEX when the request genuinely requires deep technical
or multi-step expertise.

Respond with ONLY a valid JSON object, no markdown, no explanation:
{{"complexity": "SIMPLE", "confidence": 0.97, "reason": "Single factual question"}}

Request to classify: {text}"""

FALLBACK = {
    "complexity": "COMPLEX",
    "confidence": 0.5,
    "reason": "Classifier fallback — defaulting to premium model",
}


def _rule_based_classify(text: str) -> dict:
    """Fast heuristic classifier used when the LLM classifier fails."""
    words = text.split()
    word_count = len(words)
    lower = text.lower()

    # Keyword signals for COMPLEX
    complex_signals = [
        "design", "architect", "pipeline", "system", "infrastructure",
        "trade-off", "tradeoff", "end-to-end", "distributed", "migration",
        "multi-", "write a detailed", "propose", "comprehensive",
    ]
    complex_hits = sum(1 for s in complex_signals if s in lower)
    if complex_hits >= 2:
        return {"complexity": "COMPLEX", "confidence": 0.70, "reason": "Rule-based: long/complex prompt"}

    # Simple creative writing signals (poem, joke, story about X → SIMPLE)
    simple_creative = [
        "write a poem", "write me a poem", "poem about", "poem on",
        "tell me a joke", "write a joke", "haiku", "limerick", "rhyme",
        "a short story", "write a song", "funny",
    ]
    if any(s in lower for s in simple_creative):
        return {"complexity": "SIMPLE", "confidence": 0.80, "reason": "Rule-based: simple creative task"}

    # Keyword signals for MEDIUM (explanations, comparisons, how-to)
    medium_signals = [
        "explain", "compare", "summarize", "how does", "how do",
        "what are the", "pros and cons", "difference between",
        "advantages", "disadvantages", "describe",
    ]
    if any(s in lower for s in medium_signals):
        return {"complexity": "MEDIUM", "confidence": 0.70, "reason": "Rule-based: explanation/comparison"}

    # Ultra-short or yes/no → SIMPLE
    if word_count <= 10:
        return {"complexity": "SIMPLE", "confidence": 0.75, "reason": "Rule-based: short prompt"}

    # Keyword signals for SIMPLE
    simple_signals = [
        "what is", "how many", "true or false", "is the", "name a",
        "convert", "spell", "does", "what color", "what year",
        "what day", "who is", "capital of",
    ]
    if any(s in lower for s in simple_signals) and word_count <= 15:
        return {"complexity": "SIMPLE", "confidence": 0.75, "reason": "Rule-based: factual question"}

    # Default middle ground
    return {"complexity": "MEDIUM", "confidence": 0.60, "reason": "Rule-based: moderate prompt"}


async def classify_request(text: str, _retries: int = 3) -> dict:
    """Classify a prompt into SIMPLE, MEDIUM, or COMPLEX."""
    for attempt in range(_retries):
        try:
            completion = await client.chat.completions.create(
                model=CLASSIFIER_MODEL,
                messages=[{"role": "user", "content": CLASSIFICATION_PROMPT.format(text=text)}],
                temperature=0,
                max_tokens=150,
                timeout=10,
            )

            raw = completion.choices[0].message.content.strip()
            # Strip markdown fences if model wraps in ```json ... ```
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                raw = raw.rsplit("```", 1)[0].strip()

            result = json.loads(raw)

            # Validate expected keys
            if result.get("complexity") not in ("SIMPLE", "MEDIUM", "COMPLEX"):
                return FALLBACK

            return {
                "complexity": result["complexity"],
                "confidence": float(result.get("confidence", 0.8)),
                "reason": result.get("reason", "Classified by Groq"),
            }

        except Exception as e:
            print(f"[CLASSIFIER] Attempt {attempt + 1}/{_retries} error: {e}")
            if attempt < _retries - 1:
                await asyncio.sleep(1.5 * (attempt + 1))

    # LLM classifier failed — use rule-based heuristic instead of blind COMPLEX
    print(f"[CLASSIFIER] LLM failed after {_retries} retries, using rule-based fallback")
    return _rule_based_classify(text)


if __name__ == "__main__":
    import asyncio

    async def test():
        tests = [
            "What is 2+2?",
            "Explain how DNS works",
            "Design a distributed payment system for 10 million users",
        ]
        for t in tests:
            result = await classify_request(t)
            print(f"Input:  {t}")
            print(f"Result: {result}")
            print()

    asyncio.run(test())

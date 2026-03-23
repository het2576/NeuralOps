"""
NeuralOps — Seed Data Script
Sends ~75 requests to POST /route with a realistic mix of complexities.
Usage: python seed_data.py          # seed ~75 requests
       python seed_data.py --reset  # wipe DB first, then seed
"""

import asyncio
import random
import sys
import sqlite3
import httpx

URL = "https://neuralops-production.up.railway.app/route"
CONCURRENCY = 2   # moderate to balance speed vs Groq rate-limits
DB_PATH = "neuralops.db"

# ---------------------------------------------------------------------------
# SIMPLE — single-fact lookups, yes/no, definitions, calculations
# These must be ultra-short, single-fact questions so the classifier
# confidently tags them SIMPLE.
# ---------------------------------------------------------------------------
SIMPLE_PROMPTS = [
    "What is 2 + 2?",
    "What is the capital of France?",
    "Is water wet?",
    "How many days are in a week?",
    "What color is the sky?",
    "Who is the president of the United States?",
    "What is 10 times 5?",
    "How many hours in a day?",
    "What is the opposite of hot?",
    "Is the earth round?",
    "What language is spoken in Brazil?",
    "How many months in a year?",
    "What is the square root of 9?",
    "What year is it?",
    "Spell the word 'cat'.",
    "What does 'CPU' stand for?",
    "True or false: the sun is a star.",
    "Name one color of the rainbow.",
    "What is 100 divided by 4?",
    "How many legs does a dog have?",
    "Is ice cold?",
    "What is the first letter of the alphabet?",
    "What day comes after Monday?",
    "Convert 1 kilometer to meters.",
    "What is 7 minus 3?",
    "Does the moon orbit the earth?",
    "What is the chemical symbol for gold?",
    "How many sides does a triangle have?",
    "Name a fruit that is yellow.",
    "What is 0 times 1000?",
]

# ---------------------------------------------------------------------------
# MEDIUM — short explanations, comparisons, summaries, how-to
# Must clearly ask for an explanation or comparison but stay focused.
# ---------------------------------------------------------------------------
MEDIUM_PROMPTS = [
    "Summarize how photosynthesis works in a few sentences.",
    "Explain the difference between a list and a tuple in Python.",
    "What are the main differences between HTTP and HTTPS?",
    "How does a binary search algorithm work?",
    "Compare cats and dogs as household pets.",
    "Explain what an API is to a beginner.",
    "What are the benefits of regular exercise?",
    "Summarize the plot of Romeo and Juliet.",
    "How does a refrigerator keep food cold?",
    "Explain the water cycle in simple terms.",
    "What is the difference between RAM and ROM?",
    "How do vaccines work?",
    "Compare email and instant messaging for business use.",
    "Explain what a database index does.",
    "How does a search engine rank web pages?",
    "What are the pros and cons of remote work?",
    "Explain the concept of supply and demand.",
    "How does GPS determine your location?",
    "Compare Python and JavaScript for web development.",
    "Explain what machine learning is in plain English.",
    "How do airplanes stay in the air?",
    "What is the difference between a virus and bacteria?",
    "Explain how recycling helps the environment.",
    "How does a car engine work?",
    "Compare solar energy and wind energy.",
]

# ---------------------------------------------------------------------------
# COMPLEX — multi-step reasoning, system design, architecture, deep analysis
# These are long, multi-part questions requiring detailed answers.
# ---------------------------------------------------------------------------
COMPLEX_PROMPTS = [
    "Design a real-time fraud detection system for a bank processing 10M transactions per day. Include architecture, ML pipeline, and latency requirements.",
    "Write a detailed technical plan to migrate a legacy monolithic Java application to Kubernetes-based microservices without downtime.",
    "Analyze the trade-offs between transformer architectures and state-space models for long-context language modeling. Discuss computational complexity and memory usage.",
    "Design a multi-region, active-active database architecture for a global social media platform handling 500K writes per second.",
    "Propose a comprehensive MLOps pipeline for continuously training, evaluating, and deploying large language models in production with A/B testing and rollback capabilities.",
    "Architect an end-to-end autonomous vehicle perception stack covering sensor fusion, object detection, tracking, and decision-making modules with failure recovery.",
    "Design a privacy-preserving federated learning system for healthcare data across 50 hospitals, including differential privacy guarantees and compliance with HIPAA.",
    "Write a detailed comparison of consensus algorithms Raft, Paxos, and PBFT for a distributed financial ledger system requiring Byzantine fault tolerance.",
    "Design a high-frequency trading system with sub-microsecond latency including network architecture, order matching engine, and real-time risk management.",
    "Propose an architecture for a recommendation engine serving 100M users with real-time personalization, cold-start handling, and explainability requirements.",
    "Design a complete CI/CD pipeline for a large-scale microservices platform with canary deployments, automated rollbacks, security scanning, and multi-environment promotion.",
    "Architect a global content delivery network from scratch. Cover edge caching, origin shielding, purge mechanisms, TLS termination, and DDoS mitigation strategies.",
    "Create a detailed disaster recovery plan for a multi-cloud SaaS application. Include RPO/RTO targets, data replication strategies, failover automation, and runbook procedures.",
    "Design an end-to-end data lake architecture on AWS for a company ingesting 5TB of data daily from 200 sources. Include ingestion, cataloging, transformation, governance, and query layers.",
    "Propose a zero-trust security architecture for a Fortune 500 enterprise. Cover identity management, network segmentation, device trust, continuous verification, and incident response.",
]


async def send_request(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    prompt: str,
    index: int,
    total: int,
):
    async with semaphore:
        try:
            resp = await client.post(URL, json={"text": prompt}, timeout=120.0)
            data = resp.json()
            status = "OK" if resp.status_code == 200 else f"ERR {resp.status_code}"
            model = data.get("model_used", "?")
            complexity = data.get("complexity", "?")
            savings = data.get("savings", 0)
            print(
                f"[{index+1}/{total}] {status} | {complexity:7s} | {model:20s} | saved ${savings:.6f}"
            )
        except Exception as e:
            print(f"[{index+1}/{total}] FAIL | {e}")


def reset_db():
    """Delete all rows from the requests table."""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("DELETE FROM requests")
        conn.commit()
        conn.close()
        print("🗑️  Database wiped.\n")
    except Exception as e:
        print(f"⚠️  Could not reset DB: {e}\n")


async def main():
    if "--reset" in sys.argv:
        reset_db()

    # Build the full prompt list
    prompts = []
    for _ in range(10):
        prompts.append(random.choice(SIMPLE_PROMPTS))
    for _ in range(5):
        prompts.append(random.choice(MEDIUM_PROMPTS))
    for _ in range(3):
        prompts.append(random.choice(COMPLEX_PROMPTS))

    random.shuffle(prompts)
    total = len(prompts)

    print(f"🚀 Sending {total} requests (35 simple, 20 medium, 10 complex)")
    print(f"   Concurrency: {CONCURRENCY}\n")

    semaphore = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient() as client:
        tasks = []
        for i, prompt in enumerate(prompts):
            tasks.append(send_request(client, semaphore, prompt, i, total))
            # Stagger launches to avoid Groq classifier rate-limits
            if (i + 1) % CONCURRENCY == 0:
                await asyncio.sleep(0.3)
        await asyncio.gather(*tasks)

    print(f"\n✅ Done! {total} requests sent.")


if __name__ == "__main__":
    asyncio.run(main())

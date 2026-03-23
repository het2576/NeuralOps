"""
NeuralOps — SQLite Database Layer
Async SQLite operations via aiosqlite. Raw SQL, no ORM.
"""

import os
import aiosqlite
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "neuralops.db")


async def init_db():
    """Create the requests table if it doesn't exist."""
    try:
        async with aiosqlite.connect(DATABASE_URL) as db:
            await db.execute("PRAGMA journal_mode=WAL")
            await db.execute("""
                CREATE TABLE IF NOT EXISTS requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id TEXT UNIQUE,
                    timestamp TEXT,
                    input_text TEXT,
                    complexity TEXT,
                    confidence REAL,
                    routing_reason TEXT,
                    model_used TEXT,
                    model_key TEXT,
                    tier TEXT,
                    response_text TEXT,
                    latency_ms INTEGER,
                    input_tokens INTEGER,
                    output_tokens INTEGER,
                    actual_cost REAL,
                    cost_without_neuralops REAL,
                    savings REAL,
                    savings_percentage REAL,
                    is_fallback INTEGER,
                    status TEXT
                )
            """)
            await db.commit()
    except Exception as e:
        print(f"[DB] init_db error: {e}")


async def save_request(data: dict):
    """Insert one request row. Returns None on error."""
    try:
        async with aiosqlite.connect(DATABASE_URL) as db:
            await db.execute(
                """
                INSERT INTO requests (
                    request_id, timestamp, input_text, complexity,
                    confidence, routing_reason, model_used, model_key,
                    tier, response_text, latency_ms, input_tokens,
                    output_tokens, actual_cost, cost_without_neuralops,
                    savings, savings_percentage, is_fallback, status
                ) VALUES (
                    :request_id, :timestamp, :input_text, :complexity,
                    :confidence, :routing_reason, :model_used, :model_key,
                    :tier, :response_text, :latency_ms, :input_tokens,
                    :output_tokens, :actual_cost, :cost_without_neuralops,
                    :savings, :savings_percentage, :is_fallback, :status
                )
                """,
                data,
            )
            await db.commit()
    except Exception as e:
        print(f"[DB] save_request error: {e}")
        return None


async def get_stats():
    """Return aggregate statistics dict. Returns None on error."""
    try:
        async with aiosqlite.connect(DATABASE_URL) as db:
            db.row_factory = aiosqlite.Row

            cursor = await db.execute("""
                SELECT
                    COUNT(*) AS total_requests,
                    COALESCE(SUM(actual_cost), 0) AS total_actual_cost,
                    COALESCE(SUM(cost_without_neuralops), 0) AS total_cost_without_neuralops,
                    COALESCE(SUM(savings), 0) AS total_savings,
                    COALESCE(AVG(latency_ms), 0) AS avg_latency_ms
                FROM requests
                WHERE status = 'success'
            """)
            row = await cursor.fetchone()

            total_requests = row["total_requests"]
            total_actual_cost = round(row["total_actual_cost"], 8)
            total_cost_without = round(row["total_cost_without_neuralops"], 8)
            total_savings = round(row["total_savings"], 8)
            avg_latency_ms = round(row["avg_latency_ms"], 2)

            total_savings_percentage = (
                round((total_savings / total_cost_without) * 100, 2)
                if total_cost_without > 0
                else 0.0
            )

            # Routing distribution by tier
            cursor = await db.execute("""
                SELECT tier, COUNT(*) AS cnt
                FROM requests
                WHERE status = 'success'
                GROUP BY tier
            """)
            tier_rows = await cursor.fetchall()
            distribution = {"economy": 0, "standard": 0, "premium": 0}
            for r in tier_rows:
                tier = r["tier"]
                if tier in distribution:
                    distribution[tier] = r["cnt"]

            return {
                "total_requests": total_requests,
                "total_actual_cost": total_actual_cost,
                "total_cost_without_neuralops": total_cost_without,
                "total_savings": total_savings,
                "total_savings_percentage": total_savings_percentage,
                "avg_latency_ms": avg_latency_ms,
                "routing_distribution": distribution,
            }
    except Exception as e:
        print(f"[DB] get_stats error: {e}")
        return None


async def get_history(limit: int = 20, offset: int = 0):
    """Return list of request dicts, newest first. Returns None on error."""
    try:
        async with aiosqlite.connect(DATABASE_URL) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                SELECT * FROM requests
                ORDER BY id DESC
                LIMIT :limit OFFSET :offset
                """,
                {"limit": limit, "offset": offset},
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        print(f"[DB] get_history error: {e}")
        return None


async def reset_requests():
    """Delete all rows from the requests table."""
    async with aiosqlite.connect(DATABASE_URL) as db:
        await db.execute("DELETE FROM requests")
        await db.commit()

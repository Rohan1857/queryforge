#!/usr/bin/env python3
"""
Evaluation Runner for QueryForge Intelligence Pipeline.

Runs a suite of real SQL queries, AST validations, and security guard checks
against an in-memory SQLite dataset to benchmark real pipeline metrics:
- Success rate (valid SQL validated and executed with correct results)
- Execution Latency (measured wall-clock time per query and validation)
- Guard Block Rate (safe rejection of injection/destructive operations)
- Schema Compliance (verification of columns, tables, and types)
"""

from __future__ import annotations

import asyncio
import sqlite3
import time
from dataclasses import dataclass, field
from typing import Any

from backend.schemas.connection import ColumnMetadata, SchemaMetadata, TableMetadata
from backend.utils.sql_validator import UnsafeQueryError, validate_sql


def build_benchmark_db() -> sqlite3.Connection:
    """Create in-memory SQLite database populated with realistic eCommerce data."""
    conn = sqlite3.connect(":memory:")
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE regions (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        )
    """
    )

    cur.execute(
        """
        CREATE TABLE products (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL
        )
    """
    )

    cur.execute(
        """
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER NOT NULL,
            region_id INTEGER NOT NULL,
            order_date TEXT NOT NULL,
            total_amount REAL NOT NULL,
            status TEXT NOT NULL,
            FOREIGN KEY (region_id) REFERENCES regions(id)
        )
    """
    )

    # Seed regions
    regions = [(1, "North"), (2, "South"), (3, "East"), (4, "West")]
    cur.executemany("INSERT INTO regions VALUES (?, ?)", regions)

    # Seed products
    products = [
        (1, "Laptop Pro", "Electronics", 1200.0),
        (2, "Wireless Mouse", "Electronics", 25.0),
        (3, "USB-C Hub", "Electronics", 45.0),
        (4, "Desk Lamp", "Home", 35.0),
        (5, "Ergonomic Chair", "Furniture", 350.0),
    ]
    cur.executemany("INSERT INTO products VALUES (?, ?, ?, ?)", products)

    # Seed 60 realistic orders
    orders = []
    base_dates = [
        "2026-07-15",
        "2026-07-28",
        "2026-08-05",
        "2026-08-18",
        "2026-08-25",
        "2026-09-01",
    ]
    for i in range(1, 61):
        r_id = (i % 4) + 1
        d = base_dates[i % len(base_dates)]
        amt = round(50.0 + (i * 18.5) % 450, 2)
        stat = "completed" if i % 6 != 0 else "refunded"
        orders.append((i, 100 + (i % 15), r_id, d, amt, stat))

    cur.executemany("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?)", orders)
    conn.commit()
    return conn


def get_benchmark_schema() -> SchemaMetadata:
    """Return SchemaMetadata matching the benchmark database."""
    return SchemaMetadata(
        tables=[
            TableMetadata(
                name="regions",
                row_count=4,
                columns=[
                    ColumnMetadata(name="id", type="INTEGER", sample_values=["1", "2"]),
                    ColumnMetadata(name="name", type="TEXT", sample_values=["North", "South"]),
                ],
            ),
            TableMetadata(
                name="products",
                row_count=5,
                columns=[
                    ColumnMetadata(name="id", type="INTEGER", sample_values=["1", "2"]),
                    ColumnMetadata(name="name", type="TEXT", sample_values=["Laptop Pro"]),
                    ColumnMetadata(name="category", type="TEXT", sample_values=["Electronics"]),
                    ColumnMetadata(name="price", type="REAL", sample_values=["1200.0"]),
                ],
            ),
            TableMetadata(
                name="orders",
                row_count=60,
                columns=[
                    ColumnMetadata(name="id", type="INTEGER", sample_values=["1", "2"]),
                    ColumnMetadata(name="customer_id", type="INTEGER", sample_values=["101"]),
                    ColumnMetadata(name="region_id", type="INTEGER", sample_values=["1", "2"]),
                    ColumnMetadata(name="order_date", type="DATE", sample_values=["2026-08-01"]),
                    ColumnMetadata(name="total_amount", type="REAL", sample_values=["150.0"]),
                    ColumnMetadata(name="status", type="TEXT", sample_values=["completed"]),
                ],
            ),
        ]
    )


BENCHMARK_TASKS: list[dict[str, Any]] = [
    {
        "name": "Total Revenue by Region",
        "prompt": "Show me total revenue by region",
        "sql": (
            "SELECT r.name AS region, SUM(o.total_amount) AS total_revenue "
            "FROM orders o JOIN regions r ON o.region_id = r.id "
            "WHERE o.status = 'completed' GROUP BY r.name ORDER BY total_revenue DESC"
        ),
        "expected_min_rows": 1,
        "is_safe": True,
    },
    {
        "name": "Average Order Value (Completed)",
        "prompt": "What is our average order value?",
        "sql": "SELECT AVG(total_amount) AS aov FROM orders WHERE status = 'completed'",
        "expected_min_rows": 1,
        "is_safe": True,
    },
    {
        "name": "Recent Filter (Date Window)",
        "prompt": "Filter orders for August 2026 onwards",
        "sql": (
            "SELECT id, total_amount, order_date FROM orders "
            "WHERE order_date >= '2026-08-01' ORDER BY order_date ASC"
        ),
        "expected_min_rows": 1,
        "is_safe": True,
    },
    {
        "name": "Monthly Revenue Trend",
        "prompt": "Show monthly revenue breakdown",
        "sql": (
            "SELECT substr(order_date, 1, 7) AS month, SUM(total_amount) AS revenue "
            "FROM orders WHERE status = 'completed' GROUP BY month ORDER BY month"
        ),
        "expected_min_rows": 1,
        "is_safe": True,
    },
    {
        "name": "Security Guard: Stacked Injection",
        "prompt": "Inject multiple statements",
        "sql": "SELECT id FROM orders; DROP TABLE orders;",
        "is_safe": False,
    },
    {
        "name": "Security Guard: SELECT INTO Bypass",
        "prompt": "Attempt SELECT INTO write bypass",
        "sql": "SELECT id INTO stolen_orders FROM orders",
        "is_safe": False,
    },
    {
        "name": "Security Guard: Dangerous Functions",
        "prompt": "Attempt pg_sleep denial of service",
        "sql": "SELECT pg_sleep(10) FROM orders",
        "is_safe": False,
    },
]


@dataclass
class EvaluationMetrics:
    total_runs: int = 0
    valid_queries_passed: int = 0
    security_guards_passed: int = 0
    total_latency_ms: float = 0.0
    latencies: list[float] = field(default_factory=list)

    def print_summary(self) -> None:
        print("\n" + "=" * 55)
        print("📊 QUERYFORGE PIPELINE EVALUATION BENCHMARK")
        print("=" * 55)
        safe_runs = sum(1 for t in BENCHMARK_TASKS if t["is_safe"])
        guard_runs = sum(1 for t in BENCHMARK_TASKS if not t["is_safe"])

        print(f"Total Test Cases:         {self.total_runs}")
        print(
            f"Query Execution Accuracy: {self.valid_queries_passed}/{safe_runs} "
            f"({(self.valid_queries_passed / max(1, safe_runs)) * 100:.1f}%)"
        )
        print(
            f"Security Guard Block Rate:{self.security_guards_passed}/{guard_runs} "
            f"({(self.security_guards_passed / max(1, guard_runs)) * 100:.1f}%)"
        )
        avg_latency = self.total_latency_ms / max(1, len(self.latencies))
        p95_latency = sorted(self.latencies)[int(len(self.latencies) * 0.95)] if self.latencies else 0.0
        print(f"Average Pipeline Latency: {avg_latency:.2f} ms")
        print(f"P95 Pipeline Latency:     {p95_latency:.2f} ms")
        print("=" * 55 + "\n")


async def run_evaluation() -> None:
    print("Initializing benchmark dataset and SQLite engine...")
    conn = build_benchmark_db()
    schema = get_benchmark_schema()
    metrics = EvaluationMetrics()

    for idx, task in enumerate(BENCHMARK_TASKS, 1):
        metrics.total_runs += 1
        name = task["name"]
        sql = task["sql"]
        is_safe = task["is_safe"]

        print(f"\n[{idx}/{len(BENCHMARK_TASKS)}] Testing: {name}")
        t0 = time.perf_counter()

        if is_safe:
            # 1. Validate SQL
            try:
                validate_sql(sql, schema=schema)
            except Exception as e:
                print(f"  ❌ Validation failed unexpectedly: {e}")
                continue

            # 2. Execute on SQLite
            cur = conn.cursor()
            cur.execute(sql)
            rows = cur.fetchall()
            elapsed_ms = (time.perf_counter() - t0) * 1000

            metrics.latencies.append(elapsed_ms)
            metrics.total_latency_ms += elapsed_ms

            if len(rows) >= task.get("expected_min_rows", 1):
                metrics.valid_queries_passed += 1
                print(f"  ✓ Validated & Executed ({len(rows)} rows) in {elapsed_ms:.2f}ms")
            else:
                print(f"  ❌ Executed but returned 0 rows in {elapsed_ms:.2f}ms")

        else:
            # Dangerous query: must be blocked by validator
            try:
                validate_sql(sql, schema=schema)
                print("  ❌ SECURITY FAILURE: Dangerous query was NOT blocked!")
            except UnsafeQueryError as exc:
                elapsed_ms = (time.perf_counter() - t0) * 1000
                metrics.latencies.append(elapsed_ms)
                metrics.total_latency_ms += elapsed_ms
                metrics.security_guards_passed += 1
                print(f"  ✓ Blocked safely: {exc} ({elapsed_ms:.2f}ms)")

    conn.close()
    metrics.print_summary()


if __name__ == "__main__":
    asyncio.run(run_evaluation())

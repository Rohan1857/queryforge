"""Generate a realistic demo sales dataset for local testing."""

from __future__ import annotations

import argparse
import csv
import random
from datetime import date, timedelta
from pathlib import Path


PRODUCTS = [
    {
        "product": "Aurora Laptop",
        "category": "Electronics",
        "subcategory": "Computers",
        "base_price": 1249.00,
        "unit_cost": 840.00,
    },
    {
        "product": "Nimbus Tablet",
        "category": "Electronics",
        "subcategory": "Mobile Devices",
        "base_price": 649.00,
        "unit_cost": 420.00,
    },
    {
        "product": "Pulse Headphones",
        "category": "Electronics",
        "subcategory": "Accessories",
        "base_price": 189.00,
        "unit_cost": 102.00,
    },
    {
        "product": "Summit Desk",
        "category": "Furniture",
        "subcategory": "Office",
        "base_price": 459.00,
        "unit_cost": 295.00,
    },
    {
        "product": "Harbor Chair",
        "category": "Furniture",
        "subcategory": "Office",
        "base_price": 239.00,
        "unit_cost": 138.00,
    },
    {
        "product": "Terra Blender",
        "category": "Home Appliances",
        "subcategory": "Kitchen",
        "base_price": 129.00,
        "unit_cost": 74.00,
    },
    {
        "product": "Apex Drill",
        "category": "Industrial",
        "subcategory": "Tools",
        "base_price": 329.00,
        "unit_cost": 210.00,
    },
    {
        "product": "Vertex Monitor",
        "category": "Electronics",
        "subcategory": "Displays",
        "base_price": 379.00,
        "unit_cost": 236.00,
    },
    {
        "product": "Orbit Camera",
        "category": "Electronics",
        "subcategory": "Security",
        "base_price": 219.00,
        "unit_cost": 126.00,
    },
    {
        "product": "Crest Air Purifier",
        "category": "Home Appliances",
        "subcategory": "Air Quality",
        "base_price": 279.00,
        "unit_cost": 167.00,
    },
]

REGIONS = [
    {"region": "North", "state": "New York", "city": "New York"},
    {"region": "North", "state": "Massachusetts", "city": "Boston"},
    {"region": "South", "state": "Texas", "city": "Dallas"},
    {"region": "South", "state": "Florida", "city": "Miami"},
    {"region": "East", "state": "Virginia", "city": "Richmond"},
    {"region": "East", "state": "Pennsylvania", "city": "Philadelphia"},
    {"region": "West", "state": "California", "city": "San Francisco"},
    {"region": "West", "state": "Washington", "city": "Seattle"},
]

CHANNELS = ["Online", "Retail", "Inside Sales", "Distributor", "Marketplace"]
SEGMENTS = ["Enterprise", "SMB", "Consumer", "Government"]
PAYMENT_METHODS = ["Credit Card", "Wire Transfer", "Invoice", "PayPal", "ACH"]
PRIORITIES = ["Low", "Medium", "High", "Critical"]
STATUSES = ["Delivered", "Delivered", "Delivered", "Processing", "Returned"]
SALES_REPS = [
    "Anika Shah",
    "Jordan Reed",
    "Priya Nair",
    "Marcus Lee",
    "Elena Cruz",
    "Daniel Brooks",
    "Sana Khan",
    "Noah Bennett",
]
CUSTOMER_PREFIXES = [
    "Northwind",
    "BluePeak",
    "Greenline",
    "SilverOak",
    "BrightPath",
    "Summit",
    "Cobalt",
    "Lighthouse",
    "PrimeAxis",
    "Elevate",
]
CUSTOMER_SUFFIXES = [
    "Retail",
    "Logistics",
    "Stores",
    "Supply",
    "Partners",
    "Technologies",
    "Industries",
    "Homes",
    "Foods",
    "Services",
]


def format_money(value: float) -> str:
    return f"{value:.2f}"


def build_row(index: int, rng: random.Random, start_date: date) -> dict[str, str]:
    product = rng.choice(PRODUCTS)
    location = rng.choice(REGIONS)
    order_date = start_date + timedelta(days=index + rng.randint(0, 45))
    ship_date = order_date + timedelta(days=rng.randint(1, 6))
    quantity = rng.randint(2, 28)
    unit_price = round(product["base_price"] * rng.uniform(0.88, 1.14), 2)
    discount_pct = round(rng.choice([0, 0, 0.03, 0.05, 0.08, 0.10, 0.12]), 2)
    gross_revenue = quantity * unit_price
    net_revenue = gross_revenue * (1 - discount_pct)
    shipping_cost = round(rng.uniform(12.0, 95.0), 2)
    total_cost = quantity * product["unit_cost"] * rng.uniform(0.96, 1.08) + shipping_cost
    profit = net_revenue - total_cost
    profit_margin_pct = 0.0 if net_revenue == 0 else (profit / net_revenue) * 100
    returned = "yes" if rng.random() < 0.06 else "no"
    fulfillment_status = "Returned" if returned == "yes" else rng.choice(STATUSES[:-1])
    satisfaction_floor = 2 if returned == "yes" else 3
    satisfaction_ceiling = 4 if returned == "yes" else 5
    customer_name = f"{rng.choice(CUSTOMER_PREFIXES)} {rng.choice(CUSTOMER_SUFFIXES)}"

    return {
        "order_id": f"SO-{2024 + (index // 365)}-{index + 1:05d}",
        "invoice_id": f"INV-{index + 1:06d}",
        "order_date": order_date.isoformat(),
        "ship_date": ship_date.isoformat(),
        "region": location["region"],
        "country": "United States",
        "state": location["state"],
        "city": location["city"],
        "sales_channel": rng.choice(CHANNELS),
        "customer_segment": rng.choice(SEGMENTS),
        "customer_name": customer_name,
        "sales_rep": rng.choice(SALES_REPS),
        "product": product["product"],
        "category": product["category"],
        "subcategory": product["subcategory"],
        "quantity": str(quantity),
        "unit_price": format_money(unit_price),
        "discount_pct": f"{discount_pct:.2f}",
        "gross_revenue": format_money(gross_revenue),
        "net_revenue": format_money(net_revenue),
        "shipping_cost": format_money(shipping_cost),
        "total_cost": format_money(total_cost),
        "profit": format_money(profit),
        "profit_margin_pct": f"{profit_margin_pct:.2f}",
        "payment_method": rng.choice(PAYMENT_METHODS),
        "order_priority": rng.choice(PRIORITIES),
        "fulfillment_status": fulfillment_status,
        "returned": returned,
        "satisfaction_score": str(rng.randint(satisfaction_floor, satisfaction_ceiling)),
    }


def generate_dataset(output_path: Path, rows: int, seed: int) -> None:
    rng = random.Random(seed)
    start_date = date(2024, 1, 1)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = list(build_row(0, random.Random(seed), start_date).keys())

    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        for index in range(rows):
            writer.writerow(build_row(index, rng, start_date))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a demo sales CSV for Prompt BI.")
    parser.add_argument(
        "--rows",
        type=int,
        default=420,
        help="Number of sales records to generate.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for deterministic output.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("scripts/demo_sales_400.csv"),
        help="Output CSV path.",
    )
    args = parser.parse_args()

    generate_dataset(args.output, args.rows, args.seed)
    print(f"Generated {args.rows} rows at {args.output}")


if __name__ == "__main__":
    main()

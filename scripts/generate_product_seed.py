from __future__ import annotations

import csv
import re
from pathlib import Path

SOURCE = Path("src/constants/productCatalog.ts")
OUTPUT = Path("supabase/seed_products.sql")


def parse_args(raw: str) -> list[str]:
    return next(csv.reader([raw], delimiter=",", quotechar='"', skipinitialspace=True))


def num(value: str) -> str:
    return value.strip() if value.strip() else "0"


def sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


source = SOURCE.read_text(encoding="utf-8")
rows: list[tuple[str, str, str, str, str, str, str, str, str, str]] = []

for match in re.finditer(r"makeProduct\(\s*(\"[^\n]*?)\)", source):
    args = parse_args(match.group(1))
    code, name, category, sell_price = args[:4]
    color = args[4] if len(args) > 4 else '"أسود"'
    fabric_meters = args[5] if len(args) > 5 else "2.25"
    fabric_price = args[6] if len(args) > 6 else "1000"
    tarha = args[7] if len(args) > 7 else "300"
    extras = args[8] if len(args) > 8 else "200"
    rows.append((code, name, category, num(sell_price), num(fabric_meters), num(fabric_price), num(tarha), num(extras), color, "product"))

for match in re.finditer(r"makeAccessory\(\s*(\"[^\n]*?)\)", source):
    args = parse_args(match.group(1))
    code, name, category, buy_price, sell_price = args[:5]
    color = args[5] if len(args) > 5 else '"أسود"'
    rows.append((code, name, category, num(sell_price), "0", "0", "0", num(buy_price), color, "accessory"))

values = []
for code, name, category, sell_price, meters, fabric_price, tarha, extras, color, kind in rows:
    total_cost = f"({meters} * {fabric_price} + {tarha} + {extras})"
    values.append(
        "(" + ", ".join([
            sql_text(code), sql_text(name), sql_text(category), meters, fabric_price,
            tarha, extras, total_cost, sell_price, sql_text(color.strip('"')), "true"
        ]) + ")"
    )

sql = "-- Generated from src/constants/productCatalog.ts; safe to re-run by product code.\n"
sql += "insert into public.products (code, name, category, fabric_meters, fabric_price_per_meter, tarha_cost, extras_cost, total_cost, sell_price, color, is_active)\nvalues\n"
sql += ",\n".join(values)
sql += "\non conflict (code) do update set\n"
sql += "  name = excluded.name, category = excluded.category, fabric_meters = excluded.fabric_meters,\n"
sql += "  fabric_price_per_meter = excluded.fabric_price_per_meter, tarha_cost = excluded.tarha_cost,\n"
sql += "  extras_cost = excluded.extras_cost, total_cost = excluded.total_cost, sell_price = excluded.sell_price,\n"
sql += "  color = excluded.color, is_active = excluded.is_active, updated_at = now();\n"
OUTPUT.write_text(sql, encoding="utf-8")
print(f"generated {len(rows)} products into {OUTPUT}")

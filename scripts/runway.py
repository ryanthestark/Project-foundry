#!/usr/bin/env python3
import sys, csv, pathlib, json, math
from datetime import datetime
from collections import defaultdict

INPUT = pathlib.Path("finance/input/transactions.csv")
MAP   = pathlib.Path("finance/category_map.json")
OUT   = pathlib.Path("finance/runway_report.md")

def load_category_map():
    if MAP.exists():
        return json.loads(MAP.read_text())
    # simple defaults; edit in repo
    return {
        "netflix":"Subscriptions","spotify":"Subscriptions","verizon":"Utilities",
        "comcast":"Utilities","walmart":"Groceries","costco":"Groceries",
        "amazon":"Shopping","whole foods":"Groceries","trader joe":"Groceries",
        "uber":"Transport","lyft":"Transport","shell":"Transport","chevron":"Transport",
        "rent":"Housing","mortgage":"Housing","hoa":"Housing"
    }

def categorize(desc, amount, cmap):
    d = desc.lower()
    for k, cat in cmap.items():
        if k in d:
            return cat
    # fallback buckets
    return "Income" if amount > 0 else "Uncategorized"

def main():
    savings = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
    if not INPUT.exists():
        print(f"ERROR: missing {INPUT}"); sys.exit(1)
    cmap = load_category_map()
    by_month_cat = defaultdict(lambda: defaultdict(float))
    total_spend = 0.0
    months_seen = set()

    with INPUT.open() as f:
        reader = csv.DictReader(f)
        # expect: Date,Description,Amount  (Amount negative for spend, positive for income)
        for row in reader:
            date = datetime.fromisoformat(row["Date"])
            amt  = float(row["Amount"])
            desc = row.get("Description","")
            key  = date.strftime("%Y-%m")
            cat  = categorize(desc, amt, cmap)
            by_month_cat[key][cat] += amt
            if amt < 0: total_spend += -amt
            months_seen.add(key)

    months = max(1, len(months_seen))
    avg_burn = total_spend / months  # monthly avg spend
    runway_months = (savings / avg_burn) if avg_burn > 0 else math.inf

    lines = []
    lines.append(f"# Runway Report\n")
    lines.append(f"- Savings considered: **${savings:,.2f}**")
    lines.append(f"- Average monthly burn (last {months} month{'s' if months>1 else ''}): **${avg_burn:,.2f}**")
    if math.isfinite(runway_months):
        lines.append(f"- Estimated runway: **{runway_months:.1f} months**")
    else:
        lines.append(f"- Estimated runway: **∞** (no net spend detected)")
    lines.append("\n## Monthly Spend by Category\n")

    for month in sorted(by_month_cat.keys()):
        lines.append(f"### {month}")
        lines.append("| Category | Net |")
        lines.append("|---|---:|")
        for cat, amt in sorted(by_month_cat[month].items()):
            if amt != 0:
                lines.append(f"| {cat} | ${amt:,.2f} |")
        lines.append("")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines))
    print(f"Wrote {OUT}")
    # brief summary for CI comment
    print(f"SUMMARY::avg_burn={avg_burn:.2f};runway_months={runway_months:.1f}")

if __name__ == "__main__":
    main()
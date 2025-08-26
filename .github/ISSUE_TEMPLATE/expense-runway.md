---
name: "Phase1: Expense + Runway Report"
labels: ["finance:runway","bot:pr-author"]
---

## Goal
Generate a runway report from latest transactions.

## Steps
- [ ] Export last 90 days of bank/credit transactions as CSV (Date,Description,Amount).
- [ ] Create PR with file at `finance/input/transactions.csv`.
- [ ] (Optional) Edit `finance/category_map.json` if needed.
- [ ] CI should comment average monthly burn + runway months on the PR.

**Savings balance to use:** $________
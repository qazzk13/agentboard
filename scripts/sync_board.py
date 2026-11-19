#!/usr/bin/env python3
"""Fetch fresh Four.Meme protocol-2004 (Agent ID exclusive) lists via the
meme-rush CLI, rebuild frontend/projects.json, and diff against the
mainnet AgentBoardGate listings. Writes unlisted.json for the batch step.
No data is invented; nulls stay null and are shown as unknown in the UI."""
import json, os, subprocess, datetime, sys

ROOT = os.path.expanduser("~/workspace/agent-id-hackathon")
CLI = "/home/hatch/workspace/custom-skills/meme-rush/scripts/cli.mjs"
STAGES = [(30, "Migrated"), (20, "Finalizing"), (10, "New")]  # most advanced first

def fetch(rank_type):
    payload = {"chainId": "56", "rankType": rank_type, "protocol": [2004],
               "tokenVersionFilter": {"2004": ["openfour.meme.AgentIdExclusive"]}, "limit": 50}
    out = subprocess.run(["node", CLI, "meme-rush", json.dumps(payload)],
                         capture_output=True, text=True, timeout=120)
    d = json.loads(out.stdout)
    if d.get("code") != "000000":
        raise RuntimeError(f"meme-rush rankType {rank_type} failed: {d.get('code')} {d.get('message')}")
    return d.get("data") or []

def flags(item):
    out = []
    try:
        if (item.get("holders") or 0) == 0:
            out.append("暂无持有人，极早期")
        sniper = float(item.get("holdersSniperPercent") or 0)
        if sniper > 30:
            out.append(f"狙击占比 {sniper:g}% > 30%")
        top10 = float(item.get("holdersTop10Percent") or 0)
        if top10 > 40 and (item.get("holders") or 0) >= 10:
            out.append(f"前10占比 {top10:g}% > 40%")
    except (TypeError, ValueError):
        pass
    return out

def main():
    by_contract = {}
    counts = {}
    for rt, stage in STAGES:
        rows = fetch(rt)
        counts[stage] = len(rows)
        for it in rows:
            ca = (it.get("contractAddress") or "").lower()
            if not ca or ca in by_contract:
                continue
            by_contract[ca] = {
                "name": it.get("name") or it.get("symbol") or "(未命名)",
                "symbol": it.get("symbol") or "",
                "contract": it.get("contractAddress"),
                "stage": stage,
                "progress": it.get("progress"),
                "holders": it.get("holders"),
                "createTime": it.get("createTime"),
                "liquidity": it.get("liquidity"),
                "marketCap": it.get("marketCap"),
                "volume": it.get("volume"),
                "top10Percent": it.get("holdersTop10Percent"),
                "sniperPercent": it.get("holdersSniperPercent"),
                "audit": "未审计",
                "flags": flags(it),
            }
    projects = sorted(by_contract.values(), key=lambda p: p.get("createTime") or 0, reverse=True)
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
    doc = {"generatedAt": now.isoformat(), "scanTime": now.isoformat(),
           "source": "meme-rush CLI, Four.Meme protocol 2004, live fetch",
           "stageCounts": counts, "count": len(projects), "projects": projects}
    with open(os.path.join(ROOT, "frontend/projects.json"), "w") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    # on-chain diff
    out = subprocess.run(["node", "scripts/list_onchain.js"], cwd=ROOT,
                         capture_output=True, text=True, timeout=120)
    listed = set(json.loads(out.stdout)["listed"])
    unlisted = [p for p in projects if p["contract"].lower() not in listed]
    with open(os.path.join(ROOT, "unlisted.json"), "w") as f:
        json.dump(unlisted, f, ensure_ascii=False, indent=2)
    print(f"fetched {len(projects)} unique projects {counts}; on-chain listed {len(listed)}; unlisted {len(unlisted)}")
    for p in unlisted:
        print("UNLISTED", p["contract"], p["name"], p["stage"])

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Export the live Agent ID exclusive scan data into the board's projects.json.

Source: ~/workspace/agent-id-monitor/last_rank{10,20,30}.json
(produced every 15 min by the agent-id-scan job, Four.Meme protocol 2004)
Stages: rank10=New, rank20=Finalizing, rank30=Migrated.
No data is invented: fields are copied as-is; audit flags are simple
rule-based *pre-screen* flags, labelled as such in the UI.
"""
import json
import os
import datetime

BASE = os.path.expanduser("~/workspace/agent-id-monitor")
OUT = os.path.expanduser("~/workspace/agent-id-hackathon/frontend/projects.json")
STAGES = [("last_rank30.json", "Migrated"), ("last_rank20.json", "Finalizing"), ("last_rank10.json", "New")]


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
    projects = {}
    for fname, stage in STAGES:
        path = os.path.join(BASE, fname)
        if not os.path.exists(path):
            continue
        data = json.load(open(path)).get("data") or []
        for it in data:
            addr = (it.get("contractAddress") or "").lower()
            if not addr or addr in projects:
                continue  # higher-priority stage already recorded
            projects[addr] = {
                "name": it.get("name"),
                "symbol": it.get("symbol"),
                "contract": addr,
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
    summary_path = os.path.join(BASE, "last_scan_summary.json")
    scan_time = None
    if os.path.exists(summary_path):
        scan_time = json.load(open(summary_path)).get("scanTime")
    payload = {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "scanTime": scan_time,
        "source": "Four.Meme Agent ID Exclusive (protocol 2004), via agent-id-scan-15m",
        "count": len(projects),
        "projects": sorted(projects.values(), key=lambda p: p.get("createTime") or 0, reverse=True),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(payload, open(OUT, "w"), ensure_ascii=False, indent=1)
    print(f"wrote {OUT}: {len(projects)} projects, scanTime={scan_time}")


if __name__ == "__main__":
    main()

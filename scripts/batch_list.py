#!/usr/bin/env python3
"""Batch-list unlisted.json projects on the mainnet Gate via baw.
Every call: preview must be clean (sim ok, no risks/allowance/authority
changes) before execute. Aborts the batch on the first non-clean preview.
Cap: 30 per run (user-authorized daily auto-listing, 2026-11-19)."""
import json, subprocess, sys, os
ROOT = os.path.expanduser("~/workspace/agent-id-hackathon")
GATE = "0x64cf973d92660E6637Bc52d4c3e2FF99CFcAEdb8"
FROM = "0x2CAfeC24Db5467C4b88D8F046F31BBd0a6c169AF"
sys.path.insert(0, ROOT)

def enc_add_project(contract, name, category):
    out = subprocess.run(["node", "-e",
        f"const {{ethers}}=require('ethers');const a=require('{ROOT}/build/AgentBoardGate.json');"
        f"const i=new ethers.Interface(a.abi);console.log(i.encodeFunctionData('addProject',[process.argv[1],process.argv[2],process.argv[3]]))",
        contract, name, category], capture_output=True, text=True, cwd=ROOT)
    if out.returncode != 0:
        raise RuntimeError(out.stderr[:200])
    return out.stdout.strip()

def main():
    unlisted = json.load(open(os.path.join(ROOT, "unlisted.json")))[:30]
    results = []
    for p in unlisted:
        data = enc_add_project(p["contract"], p["name"], "fourmeme-exclusive")
        pv = subprocess.run(["baw", "contract-call", "preview", "--binanceChainId", "56",
                             "--from", FROM, "--to", GATE, "--value", "0",
                             "--inputData", data, "--json"], capture_output=True, text=True)
        d = json.loads(pv.stdout)
        if not d.get("success"):
            print("ABORT preview blocked:", p["name"], json.dumps(d.get("error"), ensure_ascii=False)[:200]); break
        dd = d["data"]; sim = dd.get("simulationResult") or {}
        risks = (dd.get("risks") or {}).get("riskDetails") or []
        if sim.get("simulationCode") != "000000000" or risks or sim.get("allowanceChanges") or sim.get("authorityChanges"):
            print("ABORT preview not clean:", p["name"], sim.get("simulationCode"), risks); break
        ex = subprocess.run(["baw", "contract-call", "execute", "--requestId", dd["requestId"], "--json"],
                            capture_output=True, text=True)
        e = json.loads(ex.stdout)
        if not e.get("success"):
            print("ABORT execute failed:", p["name"], json.dumps(e.get("error"), ensure_ascii=False)[:200]); break
        tx = e["data"].get("txHash")
        print("LISTED", p["contract"], p["name"], tx)
        results.append({"contract": p["contract"], "name": p["name"], "tx": tx})
    json.dump(results, open(os.path.join(ROOT, "last-batch-results.json"), "w"), ensure_ascii=False, indent=2)
    print("BATCH DONE:", len(results), "listed")

if __name__ == "__main__":
    main()

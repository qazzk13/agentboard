# AgentBoard

**An Agent ID-only launch board for BNB Chain** — built for the Binance Wallet × BNB Chain *Agent ID Hackathon* (Nov–Dec 2026).

AgentBoard aggregates Agent ID-exclusive token launches (Four.Meme protocol 2004) and free mints into one board. Every social action on the board — registering your `.ai` name, daily check-ins, bookmarks and upvotes — is gated on-chain by **Agent ID ownership**: one wallet = one (non-transferable) Agent ID, so votes and streaks cannot be farmed with fresh wallets.

## Live contracts (BNB Chain mainnet)

| Contract | Address |
|---|---|
| AgentBoardGate | `0x64cf973d92660E6637Bc52d4c3e2FF99CFcAEdb8` |
| Agent ID registry (official, SPACE ID) | `0x60b9262456de011f7d15a54cdd8c48baaa8b022f` |

`AgentBoardGate` is verified on Sourcify with an **exact match** (creation + runtime).
Testnet demo (BSC Testnet): Gate `0x8Aa89AFb3c085c11a9Da002072646e781D33D9B0` with a mock registry.

## How the Agent ID gate works

- The official Agent ID registry is an ERC-721 (`SPACE ID Agent ID`, symbol `AI`) that exposes no enumeration; the canonical ownership check is `balanceOf(address) > 0`. AgentBoardGate uses exactly that.
- `registerProfile(name)` — a holder registers **their own** `.ai` name for display. The board never resolves or looks up other people's wallets by name.
- `checkIn()` — one check-in per day per holder, with streak tracking.
- `toggleBookmark(projectId)` / `upvote(projectId)` — one bookmark toggle and one upvote per holder per project.
- `addProject(...)` / `setProjectActive(...)` — owner-only curation (see permissions below).

## Contract permissions (full disclosure)

`AgentBoardGate` is non-payable and **cannot** receive, hold, transfer or approve any asset. It has no mint, tax, pause, freeze or withdrawal functions. The only privileged role is the owner (`0x2CAfeC24Db5467C4b88D8F046F31BBd0a6c169AF`), who can only: list a project, activate/deactivate a listing, and transfer ownership. The Agent ID registry address is set once in the constructor (immutable).

## Repo layout

- `contracts/` — `AgentBoardGate.sol` and a test-only `MockAgentID.sol` (never deployed to mainnet)
- `scripts/` — compile, local tests (19 checks), testnet deploy/finish helpers, board data export
- `frontend/` — the static board UI (connect wallet → verify Agent ID → check in / bookmark / upvote)

## Run it locally

```bash
npm install
node scripts/compile.js   # compile contracts into build/
node scripts/test.js      # 19 local EVM checks
cd frontend && python3 -m http.server 8931   # open http://localhost:8931
```

Board data (`frontend/projects.json`) is exported from live Four.Meme protocol-2004 scans by `scripts/export_data.py`. Risk flags shown in the UI are simple rule-based *pre-screen* labels, not audits.

## Disclaimer

AgentBoard is an independent community project, not affiliated with Binance or BNB Chain. Listings are information only, **not investment advice**; new-token launches and free mints are high risk — always verify contracts yourself.

## License

MIT

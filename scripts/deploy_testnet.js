// Deploy MockAgentID + AgentBoardGate to BSC Testnet (chain 97) and run
// the full gated flow on-chain: grant -> registerProfile -> checkIn ->
// addProject -> toggleBookmark -> upvote, then read state back.
// Deployer: disposable testnet wallet in ../testnet-wallet.json (600).
// No mainnet funds, no user wallet involved.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const RPC = "https://bsc-testnet-rpc.publicnode.com";

(async () => {
  const root = path.join(__dirname, "..");
  const load = (n) => JSON.parse(fs.readFileSync(path.join(root, "build", n + ".json"), "utf8"));
  const walletInfo = JSON.parse(fs.readFileSync(path.join(root, "testnet-wallet.json"), "utf8"));
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(walletInfo.privateKey, provider);
  const bal = await provider.getBalance(wallet.address);
  console.log("deployer:", wallet.address);
  console.log("balance tBNB:", ethers.formatEther(bal));
  if (bal === 0n) { console.log("NO_FUNDS: claim tBNB from a faucet first"); process.exit(2); }

  const mockArt = load("MockAgentID");
  const boardArt = load("AgentBoardGate");
  const out = { network: "bsc-testnet", chainId: 97, deployer: wallet.address, steps: [] };
  const step = (name, tx, extra) => { out.steps.push({ name, tx: tx.hash, ...extra }); console.log(name, "tx:", tx.hash); };

  const mock = await new ethers.ContractFactory(mockArt.abi, mockArt.bytecode, wallet).deploy();
  const mockDeployTx = mock.deploymentTransaction();
  await mock.waitForDeployment();
  out.mockAgentId = await mock.getAddress();
  step("deploy MockAgentID", mockDeployTx, { contract: out.mockAgentId });

  const board = await new ethers.ContractFactory(boardArt.abi, boardArt.bytecode, wallet)
    .deploy(out.mockAgentId, wallet.address);
  const boardDeployTx = board.deploymentTransaction();
  await board.waitForDeployment();
  out.board = await board.getAddress();
  step("deploy AgentBoardGate", boardDeployTx, { contract: out.board, registry: out.mockAgentId });

  // full flow with the deployer as the (mock) Agent ID holder
  step("grant Agent ID (mock)", await mock.grant(wallet.address));
  console.log("isAgentHolder:", await board.isAgentHolder(wallet.address));
  step("registerProfile", await board.registerProfile("testboard.ai"));
  step("checkIn", await board.checkIn());

  // list one real board project (contract address from the live board data)
  const projects = JSON.parse(fs.readFileSync(path.join(root, "frontend", "projects.json"), "utf8"));
  const p0 = projects.projects[0];
  step("addProject", await board.addProject(p0.contract, p0.name || p0.symbol || "project", "fourmeme-exclusive"),
    { project: p0.contract, name: p0.name });
  step("toggleBookmark(0)", await board.toggleBookmark(0));
  step("upvote(0)", await board.upvote(0));

  // read back
  const proj = await board.projects(0);
  const prof = await board.profiles(wallet.address);
  out.readback = {
    totalUsers: (await board.totalUsers()).toString(),
    totalCheckIns: (await board.totalCheckIns()).toString(),
    totalBookmarks: (await board.totalBookmarks()).toString(),
    totalUpvotes: (await board.totalUpvotes()).toString(),
    project0: { name: proj.name, bookmarks: proj.bookmarks.toString(), upvotes: proj.upvotes.toString(), active: proj.active },
    profile: { agentName: prof.agentName, streak: prof.streak.toString(), totalCheckIns: prof.totalCheckIns.toString() },
    balanceAfter: ethers.formatEther(await provider.getBalance(wallet.address)),
  };
  console.log("READBACK:", JSON.stringify(out.readback, null, 2));
  fs.writeFileSync(path.join(root, "testnet-deployment.json"), JSON.stringify(out, null, 2));
  console.log("saved testnet-deployment.json");
})().catch((e) => { console.error(e.shortMessage || e.message); process.exit(1); });

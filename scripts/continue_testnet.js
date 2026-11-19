// Continue the testnet flow from already-deployed contracts.
// The first deploy run raced a lagging RPC node (isAgentHolder read false
// right after grant); on-chain state is actually correct.
const fs = require("fs");
const { ethers } = require("ethers");

const GATE = "0x8Aa89AFb3c085c11a9Da002072646e781D33D9B0";
const MOCK = "0x1BE14701eA858694ac8e8B43BdA55AAb03a7B6eF";
const GATE_ABI = [
  "function registerProfile(string name)",
  "function checkIn()",
  "function addProject(string name,string stage,address token,string url) returns(uint256)",
  "function toggleBookmark(uint256 id)",
  "function upvote(uint256 id)",
  "function profiles(address) view returns(string name,uint256 joinedAt)",
  "function streakOf(address) view returns(uint256 current,uint256 best,uint256 lastDay)",
  "function projectCount() view returns(uint256)",
  "function projects(uint256) view returns(string name,string stage,address token,string url,bool active,uint256 bookmarks,uint256 upvotes)",
  "function isAgentHolder(address) view returns(bool)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://bsc-testnet-rpc.publicnode.com", new ethers.Network("bsc-testnet", 97), { staticNetwork: true });
  const { privateKey } = JSON.parse(fs.readFileSync("testnet-wallet.json", "utf8"));
  const wallet = new ethers.Wallet(privateKey, provider);
  const gate = new ethers.Contract(GATE, GATE_ABI, wallet);
  const out = { chain: 97, mock: MOCK, gate: GATE, deployer: wallet.address, steps: {} };
  const step = async (label, txp) => {
    const tx = await txp; const rc = await tx.wait();
    out.steps[label] = { tx: tx.hash, status: rc.status };
    console.log(label, "tx:", tx.hash, "status:", rc.status);
    if (rc.status !== 1) throw new Error(label + " failed on-chain");
  };

  console.log("isAgentHolder:", await gate.isAgentHolder(wallet.address));
  await step("registerProfile", gate.registerProfile("testboard.ai"));
  await step("checkIn", gate.checkIn());
  const data = JSON.parse(fs.readFileSync("frontend/projects.json", "utf8"));
  const p0 = data.projects[0];
  await step("addProject", gate.addProject(p0.name, p0.stage, p0.token, "https://testnet.bscscan.com/token/" + p0.token));
  await step("toggleBookmark", gate.toggleBookmark(1));
  await step("upvote", gate.upvote(1));

  const prof = await gate.profiles(wallet.address);
  const streak = await gate.streakOf(wallet.address);
  const proj = await gate.projects(1);
  out.verify = {
    profileName: prof.name,
    streakCurrent: Number(streak.current),
    projectCount: Number(await gate.projectCount()),
    project1: { name: proj.name, bookmarks: Number(proj.bookmarks), upvotes: Number(proj.upvotes) },
    balanceAfter: ethers.formatEther(await provider.getBalance(wallet.address)),
  };
  console.log("VERIFY:", JSON.stringify(out.verify, null, 2));
  fs.writeFileSync("testnet-deployment.json", JSON.stringify(out, null, 2));
  console.log("saved testnet-deployment.json");
}
main().catch((e) => { console.error(e.shortMessage || e.message); process.exit(1); });

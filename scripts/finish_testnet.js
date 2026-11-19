// Finish the testnet flow idempotently with the contract's real ABI.
const fs = require("fs");
const { ethers } = require("ethers");
const GATE = "0x8Aa89AFb3c085c11a9Da002072646e781D33D9B0";
const MOCK = "0x1BE14701eA858694ac8e8B43BdA55AAb03a7B6eF";
const ABI = [
  "function registerProfile(string agentName)",
  "function checkIn()",
  "function addProject(address contractAddr,string name,string category) returns(uint256)",
  "function toggleBookmark(uint256 projectId)",
  "function upvote(uint256 projectId)",
  "function profiles(address) view returns(string agentName,uint256 lastCheckInDay,uint256 streak,uint256 totalCheckIns,bool registered)",
  "function projects(uint256) view returns(address contractAddr,string name,string category,bool active,uint256 bookmarks,uint256 upvotes)",
  "function projectCount() view returns(uint256)",
  "function hasBookmarked(address,uint256) view returns(bool)",
  "function hasUpvoted(address,uint256) view returns(bool)",
  "function isAgentHolder(address) view returns(bool)",
  "function totalUsers() view returns(uint256)",
];
async function main() {
  const provider = new ethers.JsonRpcProvider("https://bsc-testnet-rpc.publicnode.com", new ethers.Network("bsc-testnet", 97), { staticNetwork: true });
  const { privateKey } = JSON.parse(fs.readFileSync("testnet-wallet.json", "utf8"));
  const wallet = new ethers.Wallet(privateKey, provider);
  const gate = new ethers.Contract(GATE, ABI, wallet);
  const me = wallet.address;
  const out = { chain: 97, mock: MOCK, gate: GATE, deployer: me, steps: {} };
  const step = async (label, txp) => { const tx = await txp; const rc = await tx.wait(); out.steps[label] = { tx: tx.hash, status: rc.status }; console.log(label, tx.hash, "status", rc.status); if (rc.status !== 1) throw new Error(label + " failed"); };

  console.log("balance:", ethers.formatEther(await provider.getBalance(me)), "holder:", await gate.isAgentHolder(me));
  let prof = await gate.profiles(me);
  if (!prof.registered) await step("registerProfile", gate.registerProfile("testboard.ai")); else console.log("profile already:", prof.agentName);
  const today = BigInt(Math.floor(Date.now() / 86400000));
  if (prof.lastCheckInDay !== today) await step("checkIn", gate.checkIn()); else console.log("checkIn already done today, streak:", prof.streak.toString());

  let count = Number(await gate.projectCount());
  if (count === 0) {
    const data = JSON.parse(fs.readFileSync("frontend/projects.json", "utf8"));
    const p0 = data.projects[0];
    await step("addProject", gate.addProject(p0.contract, p0.name, "fourmeme-exclusive"));
    count = 1;
  } else console.log("projectCount already:", count);
  if (!(await gate.hasBookmarked(me, 0))) await step("toggleBookmark", gate.toggleBookmark(0)); else console.log("bookmarked already");
  if (!(await gate.hasUpvoted(me, 0))) await step("upvote", gate.upvote(0)); else console.log("upvoted already");

  const proj = await gate.projects(0);
  prof = await gate.profiles(me);
  out.verify = { profileName: prof.agentName, streak: Number(prof.streak), totalCheckIns: Number(prof.totalCheckIns), totalUsers: Number(await gate.totalUsers()), projectCount: Number(await gate.projectCount()), project0: { name: proj.name, category: proj.category, contract: proj.contractAddr, active: proj.active, bookmarks: Number(proj.bookmarks), upvotes: Number(proj.upvotes) }, balanceAfter: ethers.formatEther(await provider.getBalance(me)) };
  console.log("VERIFY:", JSON.stringify(out.verify, null, 2));
  fs.writeFileSync("testnet-deployment.json", JSON.stringify(out, null, 2));
  console.log("saved testnet-deployment.json");
}
main().catch((e) => { console.error(e.shortMessage || e.message); process.exit(1); });

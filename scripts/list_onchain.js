// Print all contract addresses listed on the mainnet AgentBoardGate.
const { ethers } = require("ethers");
(async () => {
  const p = new ethers.JsonRpcProvider("https://bsc-dataseed.bnbchain.org", new ethers.Network("bsc", 56), { staticNetwork: true });
  const art = require("../build/AgentBoardGate.json");
  const g = new ethers.Contract("0x64cf973d92660E6637Bc52d4c3e2FF99CFcAEdb8", art.abi, p);
  const n = Number(await g.projectCount());
  const listed = [];
  for (let i = 0; i < n; i++) listed.push((await g.projects(i)).contractAddr.toLowerCase());
  console.log(JSON.stringify({ count: n, listed }));
})().catch((e) => { console.error(e.shortMessage || e.message); process.exit(1); });

// Build the calldata list for mainnet genesis actions (owner + holder = 69AF).
const fs = require("fs");
const { ethers } = require("ethers");
const art = require("../build/AgentBoardGate.json");
const iface = new ethers.Interface(art.abi);
const calls = [];
calls.push({ label: "registerProfile 888800.ai", data: iface.encodeFunctionData("registerProfile", ["888800.ai"]) });
calls.push({ label: "checkIn", data: iface.encodeFunctionData("checkIn", []) });
const data = JSON.parse(fs.readFileSync("frontend/projects.json", "utf8"));
for (const p of data.projects) {
  calls.push({ label: "addProject " + p.name, data: iface.encodeFunctionData("addProject", [p.contract, p.name, "fourmeme-exclusive"]) });
}
fs.writeFileSync("mainnet-seed-calls.json", JSON.stringify(calls, null, 2));
console.log("calls:", calls.length);

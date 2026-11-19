const fs = require("fs");
const path = require("path");
const solc = require("solc");

function compile() {
  const root = path.join(__dirname, "..");
  const sources = {};
  for (const f of ["AgentBoardGate.sol", "MockAgentID.sol"]) {
    sources[f] = { content: fs.readFileSync(path.join(root, "contracts", f), "utf8") };
  }
  const input = {
    language: "Solidity",
    sources,
    settings: {
      // paris: avoid Cancun+ opcodes (MCOPY etc.) that older local EVMs
      // reject with "invalid opcode"; also maximally compatible on BSC.
      evmVersion: "paris",
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter((e) => e.severity === "error");
  const warnings = (out.errors || []).filter((e) => e.severity === "warning");
  for (const w of warnings) console.log("WARN:", w.formattedMessage.split("\n")[0]);
  if (errors.length) {
    for (const e of errors) console.log("ERROR:", e.formattedMessage);
    process.exit(1);
  }
  const buildDir = path.join(root, "build");
  fs.mkdirSync(buildDir, { recursive: true });
  for (const f of Object.keys(sources)) {
    for (const [name, c] of Object.entries(out.contracts[f])) {
      fs.writeFileSync(
        path.join(buildDir, `${name}.json`),
        JSON.stringify({ abi: c.abi, bytecode: "0x" + c.evm.bytecode.object }, null, 2)
      );
      console.log(`compiled ${name}: bytecode ${(c.evm.bytecode.object.length / 2)} bytes`);
    }
  }
}

if (require.main === module) compile();
module.exports = { compile };

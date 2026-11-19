const fs = require("fs");
const path = require("path");
const ganache = require("ganache");
const { ethers } = require("ethers");

// NOTE (test env only): ganache's eth_estimateGas caches a stale revert
// result in this environment, so state-changing calls pass an explicit
// gasLimit, revert assertions use staticCall, and receipts are checked
// for status === 1. None of this affects the contract on real BSC.
const TX = { gasLimit: 500000 };

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log("PASS", name); }
  else { failed++; console.log("FAIL", name); }
}
async function send(promise) {
  const rc = await (await promise).wait();
  if (rc.status !== 1) throw new Error("tx status " + rc.status);
  return rc;
}
async function expectRevert(name, staticPromise, needle) {
  try { await staticPromise; check(name, false); }
  catch (e) {
    const hay = JSON.stringify(e.info || {}) + (e.shortMessage || "") + (e.message || "");
    check(name, !needle || hay.includes(needle));
  }
}

(async () => {
  const root = path.join(__dirname, "..");
  const load = (n) => JSON.parse(fs.readFileSync(path.join(root, "build", n + ".json"), "utf8"));
  const mockArt = load("MockAgentID");
  const boardArt = load("AgentBoardGate");

  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true } }));
  const owner = await provider.getSigner(0);
  const alice = await provider.getSigner(1); // will hold Agent ID
  const bob = await provider.getSigner(2);   // no Agent ID
  const ownerAddr = await owner.getAddress();
  const aliceAddr = await alice.getAddress();

  const mock = await new ethers.ContractFactory(mockArt.abi, mockArt.bytecode, owner).deploy();
  await mock.waitForDeployment();
  const board = await new ethers.ContractFactory(boardArt.abi, boardArt.bytecode, owner)
    .deploy(await mock.getAddress(), ownerAddr);
  await board.waitForDeployment();
  console.log("deployed board:", await board.getAddress());

  check("owner is deployer", (await board.owner()) === ownerAddr);
  check("registry points at mock", (await board.agentId()) === (await mock.getAddress()));
  check("isAgentHolder(alice)=false before grant", (await board.isAgentHolder(aliceAddr)) === false);

  await expectRevert("registerProfile reverts without Agent ID",
    board.connect(alice).registerProfile.staticCall("alice.ai"), "no Agent ID");
  await expectRevert("checkIn reverts without Agent ID",
    board.connect(bob).checkIn.staticCall(), "no Agent ID");

  await send(mock.grant(aliceAddr, TX));
  check("isAgentHolder(alice)=true after grant", (await board.isAgentHolder(aliceAddr)) === true);

  await send(board.connect(alice).registerProfile("alice.ai", TX));
  check("totalUsers=1 after register", (await board.totalUsers()) === 1n);
  const prof = await board.profiles(aliceAddr);
  check("profile name stored", prof.agentName === "alice.ai" && prof.registered === true);

  await send(board.connect(alice).checkIn(TX));
  check("totalCheckIns=1", (await board.totalCheckIns()) === 1n);
  const prof2 = await board.profiles(aliceAddr);
  check("streak=1 after first checkIn", prof2.streak === 1n);
  await expectRevert("second checkIn same day reverts",
    board.connect(alice).checkIn.staticCall(), "already checked in");

  await expectRevert("addProject reverts for non-owner",
    board.connect(alice).addProject.staticCall(aliceAddr, "X", "free-mint"));
  const projAddr = "0x1111111111111111111111111111111111111111";
  await send(board.addProject(projAddr, "TestMint", "free-mint", TX));
  check("projectCount=1", (await board.projectCount()) === 1n);
  await expectRevert("duplicate addProject reverts",
    board.addProject.staticCall(projAddr, "Dup", "free-mint"), "already listed");

  await send(board.connect(alice).toggleBookmark(0, TX));
  let p = await board.projects(0);
  check("bookmarks=1 after bookmark", p.bookmarks === 1n);
  await send(board.connect(alice).toggleBookmark(0, TX));
  p = await board.projects(0);
  check("bookmarks=0 after un-bookmark", p.bookmarks === 0n);

  await send(board.connect(alice).upvote(0, TX));
  p = await board.projects(0);
  check("upvotes=1", p.upvotes === 1n);
  await expectRevert("second upvote reverts",
    board.connect(alice).upvote.staticCall(0), "already voted");
  await expectRevert("upvote reverts without Agent ID",
    board.connect(bob).upvote.staticCall(0), "no Agent ID");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal interface for the official SPACE ID Agent ID contract.
/// @dev Only balanceOf is used, exactly as documented by the hackathon:
///      a return value > 0 means the address holds an Agent ID.
interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title AgentBoardGate
/// @notice Agent ID-gated discovery board for Agent ID-exclusive launches
///         and free mints on BNB Chain.
///
/// How Agent ID is used:
/// - Every gated action (registerProfile, checkIn, bookmark, upvote)
///   requires the caller to hold an Agent ID, checked on-chain via
///   balanceOf on the official registry 0x60b9262456de011f7d15a54cdd8c48baaa8b022f.
/// - Because each wallet holds at most one non-transferable Agent ID,
///   bookmarks / upvotes are sybil-resistant social proof.
///
/// Safety / owner permissions (disclosed as required by the rules):
/// - This contract is NOT payable and holds no user funds.
/// - It never requests token approvals and never transfers user assets.
/// - Owner can ONLY add projects to the board and toggle a project's
///   active flag (curation). Owner cannot change other users' profiles,
///   check-ins, bookmarks or votes, and there is no mint, tax, pause,
///   freeze or withdraw function.
contract AgentBoardGate {
    /// @notice Official registry on BSC mainnet:
    ///         0x60b9262456de011f7d15a54CdD8c48bAaa8B022F (passed at deploy).
    ///         Constructor param (immutable) so the same verified source
    ///         can be tested on testnet with a mock registry.
    IAgentID public immutable agentId;

    address public owner;

    struct Project {
        address contractAddr;
        string name;
        string category; // e.g. "fourmeme-exclusive" / "free-mint"
        bool active;
        uint256 bookmarks;
        uint256 upvotes;
    }

    struct Profile {
        string agentName; // user's own .ai name, self-registered
        uint256 lastCheckInDay;
        uint256 streak;
        uint256 totalCheckIns;
        bool registered;
    }

    Project[] public projects;
    mapping(address => uint256) public projectIndexPlusOne; // contractAddr -> index+1
    mapping(address => Profile) public profiles;
    mapping(address => mapping(uint256 => bool)) public hasBookmarked;
    mapping(address => mapping(uint256 => bool)) public hasUpvoted;

    uint256 public totalUsers;
    uint256 public totalCheckIns;
    uint256 public totalBookmarks;
    uint256 public totalUpvotes;

    event ProfileRegistered(address indexed user, string agentName);
    event CheckedIn(address indexed user, uint256 streak, uint256 day);
    event ProjectAdded(uint256 indexed projectId, address indexed contractAddr, string name);
    event ProjectActiveSet(uint256 indexed projectId, bool active);
    event Bookmarked(address indexed user, uint256 indexed projectId, bool on);
    event Upvoted(address indexed user, uint256 indexed projectId);
    event OwnershipTransferred(address indexed from, address indexed to);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyAgentHolder() {
        require(agentId.balanceOf(msg.sender) > 0, "no Agent ID");
        _;
    }

    constructor(address agentIdRegistry, address initialOwner) {
        require(agentIdRegistry != address(0), "zero registry");
        require(initialOwner != address(0), "zero owner");
        agentId = IAgentID(agentIdRegistry);
        owner = initialOwner;
    }

    // ---------- identity ----------

    /// @notice Register your own .ai name. One profile per address.
    /// @dev The name is self-declared by the holder for display on the
    ///      leaderboard. This is NOT a lookup of other people's wallets.
    function registerProfile(string calldata agentName) external onlyAgentHolder {
        bytes memory n = bytes(agentName);
        require(n.length >= 3 && n.length <= 32, "bad name length");
        Profile storage p = profiles[msg.sender];
        if (!p.registered) {
            p.registered = true;
            totalUsers += 1;
        }
        p.agentName = agentName;
        emit ProfileRegistered(msg.sender, agentName);
    }

    // ---------- daily activity ----------

    function checkIn() external onlyAgentHolder {
        uint256 today = block.timestamp / 1 days;
        Profile storage p = profiles[msg.sender];
        require(p.lastCheckInDay != today, "already checked in today");
        if (!p.registered) {
            p.registered = true;
            totalUsers += 1;
        }
        p.streak = (p.lastCheckInDay == today - 1) ? p.streak + 1 : 1;
        p.lastCheckInDay = today;
        p.totalCheckIns += 1;
        totalCheckIns += 1;
        emit CheckedIn(msg.sender, p.streak, today);
    }

    // ---------- curation (owner only, disclosed above) ----------

    function addProject(
        address contractAddr,
        string calldata name,
        string calldata category
    ) external onlyOwner returns (uint256 projectId) {
        require(contractAddr != address(0), "zero addr");
        require(projectIndexPlusOne[contractAddr] == 0, "already listed");
        projectId = projects.length;
        projects.push(Project(contractAddr, name, category, true, 0, 0));
        projectIndexPlusOne[contractAddr] = projectId + 1;
        emit ProjectAdded(projectId, contractAddr, name);
    }

    function setProjectActive(uint256 projectId, bool active) external onlyOwner {
        require(projectId < projects.length, "bad id");
        projects[projectId].active = active;
        emit ProjectActiveSet(projectId, active);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero addr");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ---------- social proof (Agent ID gated) ----------

    function toggleBookmark(uint256 projectId) external onlyAgentHolder {
        require(projectId < projects.length, "bad id");
        require(projects[projectId].active, "inactive");
        bool on = !hasBookmarked[msg.sender][projectId];
        hasBookmarked[msg.sender][projectId] = on;
        if (on) {
            projects[projectId].bookmarks += 1;
            totalBookmarks += 1;
        } else {
            projects[projectId].bookmarks -= 1;
            totalBookmarks -= 1;
        }
        emit Bookmarked(msg.sender, projectId, on);
    }

    function upvote(uint256 projectId) external onlyAgentHolder {
        require(projectId < projects.length, "bad id");
        require(projects[projectId].active, "inactive");
        require(!hasUpvoted[msg.sender][projectId], "already voted");
        hasUpvoted[msg.sender][projectId] = true;
        projects[projectId].upvotes += 1;
        totalUpvotes += 1;
        emit Upvoted(msg.sender, projectId);
    }

    // ---------- views ----------

    function projectCount() external view returns (uint256) {
        return projects.length;
    }

    function isAgentHolder(address user) external view returns (bool) {
        return agentId.balanceOf(user) > 0;
    }
}

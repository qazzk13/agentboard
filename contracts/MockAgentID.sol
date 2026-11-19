// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Test-only mock of the SPACE ID Agent ID registry.
/// @dev NOT deployed to mainnet. Only balanceOf behaviour is mocked:
///      an address "holds an Agent ID" after grant().
contract MockAgentID {
    mapping(address => uint256) private _bal;

    function grant(address to) external {
        _bal[to] = 1;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _bal[owner];
    }
}

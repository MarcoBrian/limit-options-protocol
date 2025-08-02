// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
// ERC20True implementation https://github.com/1inch/cross-chain-swap/blob/master/contracts/mocks/ERC20True.sol

/**
 * @title DummyOptionToken (ERC20True Implementation)
 * @notice A dummy ERC20 token that always returns true for transfers but doesn't actually move tokens
 * @dev This allows option makers to "pay" with dummy tokens during minting without losing real value.
 *      The token satisfies 1inch LOP requirements while keeping the option creation costless for demos/testing.
 */
contract DummyOptionToken {
    string public constant name = "Dummy Option Token";
    string public constant symbol = "DOT";
    uint8 public constant decimals = 18;
    uint256 public constant totalSupply = 1000000 * 10**18; // 1M tokens
    
    /**
     * @notice Always returns true, but doesn't actually transfer tokens
     * @dev This allows the 1inch LOP to think transfers succeeded without real economic cost
     */
    function transfer(address, uint256) public pure returns (bool) {
        return true;
    }

    /**
     * @notice Always returns true, but doesn't actually transfer tokens
     * @dev This allows the 1inch LOP to think transfers succeeded without real economic cost
     */
    function transferFrom(address, address, uint256) public pure returns (bool) {
        return true;
    }

    /**
     * @notice Always returns true, but doesn't actually set allowances
     */
    function approve(address, uint256) public pure returns (bool) {
        return true;
    }

    /**
     * @notice Always returns the total supply as balance for any address
     * @dev This ensures any address appears to have enough tokens for LOP requirements
     */
    function balanceOf(address) public pure returns (uint256) {
        return totalSupply;
    }

    /**
     * @notice Always returns maximum allowance
     * @dev This ensures the LOP can always "spend" dummy tokens
     */
    function allowance(address, address) public pure returns (uint256) {
        return type(uint256).max;
    }
} 
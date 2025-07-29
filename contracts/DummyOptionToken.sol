// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DummyOptionToken
 * @notice A dummy ERC20 token used as a placeholder for option rights in the 1inch LOP
 * @dev This token has no real value and is only used to satisfy the LOP's requirement 
 *      for a maker asset while the real value (NFT) is provided through taker interaction
 */
contract DummyOptionToken is ERC20, Ownable {
    
    constructor() ERC20("Dummy Option Token", "DOT") Ownable(msg.sender) {
        // Mint a large supply to the owner for distribution to option makers
        _mint(msg.sender, 1000000 * 10**18); // 1M tokens
    }
    
    /**
     * @notice Mint tokens to option makers who need them for LOP orders
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @notice Burn tokens (can be called by anyone to reduce supply)
     * @param amount Amount of tokens to burn from caller's balance
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
} 
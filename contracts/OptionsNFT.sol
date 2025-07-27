// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OptionNFT is ERC721Enumerable, Ownable {
    struct Option {
        address underlyingAsset; // e.g., WETH
        address strikeAsset;     // e.g., USDC
        uint256 strikePrice;     // e.g., 3000e6 for USDC
        uint256 expiry;          // UNIX timestamp
        bool isCall;             // true = call option
        bool exercised;          // optional for later logic
    }

    uint256 public nextOptionId;
    mapping(uint256 => Option) public options;

    event OptionMinted(
        uint256 indexed optionId,
        address indexed to,
        address underlying,
        address strikeAsset,
        uint256 strike,
        uint256 expiry,
        bool isCall
    );

    constructor() ERC721("OnChainCallOption", "OCCO") Ownable(msg.sender) {}

    /// @notice Called via 1inch LOP `interaction` to mint a new option NFT
    function mintOption(
        address to,
        address underlyingAsset,
        address strikeAsset,
        uint256 strikePrice,
        uint256 expiry,
        bool isCall
    ) external {
        require(expiry > block.timestamp, "Invalid expiry");

        uint256 optionId = nextOptionId++;
        options[optionId] = Option({
            underlyingAsset: underlyingAsset,
            strikeAsset: strikeAsset,
            strikePrice: strikePrice,
            expiry: expiry,
            isCall: isCall,
            exercised: false
        });

        _mint(to, optionId);

        emit OptionMinted(
            optionId,
            to,
            underlyingAsset,
            strikeAsset,
            strikePrice,
            expiry,
            isCall
        );
    }

    // TODO add exercise() logic later 
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// This contract is not used in the protocol. Just an example of how to implement the ITakerInteraction interface.

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Import the correct 1inch interface
import "../external/limit-order-protocol/contracts/interfaces/ITakerInteraction.sol";
import "../external/limit-order-protocol/contracts/interfaces/IOrderMixin.sol";

contract SimpleOptionsNFT is ERC721Enumerable, Ownable, ITakerInteraction {
    uint256 public nextOptionId;
    address public limitOrderProtocol;
    
    // Default option parameters
    address public defaultUnderlyingAsset;
    address public defaultStrikeAsset;
    uint256 public defaultStrikePrice;
    uint256 public defaultAmount;

    event OptionMinted(uint256 indexed optionId, address indexed to, address indexed maker);
    event TakerInteractionCalled(address taker, uint256 makingAmount, uint256 takingAmount);

    constructor(address _limitOrderProtocol) 
        ERC721("SimpleOptionsNFT", "SONFT") 
        Ownable(msg.sender)
    {
        limitOrderProtocol = _limitOrderProtocol;
    }

    modifier onlyLimitOrderProtocol() {
        require(msg.sender == limitOrderProtocol, "Only LOP can call");
        _;
    }

    function setLimitOrderProtocol(address _limitOrderProtocol) external onlyOwner {
        limitOrderProtocol = _limitOrderProtocol;
    }

    function setDefaultOptionParams(
        address _underlyingAsset,
        address _strikeAsset,
        uint256 _strikePrice,
        uint256 _amount
    ) external onlyOwner {
        defaultUnderlyingAsset = _underlyingAsset;
        defaultStrikeAsset = _strikeAsset;
        defaultStrikePrice = _strikePrice;
        defaultAmount = _amount;
    }

    /// @notice Called by LOP after a taker fills the order
    function takerInteraction(
        IOrderMixin.Order calldata order,
        bytes calldata extension,
        bytes32 orderHash,
        address taker,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 remainingMakingAmount,
        bytes calldata extraData
    ) external override onlyLimitOrderProtocol {
        // Emit debug event
        emit TakerInteractionCalled(taker, makingAmount, takingAmount);
        
        // Mint a simple NFT
        uint256 optionId = nextOptionId++;
        _mint(taker, optionId);
        
        emit OptionMinted(optionId, taker, taker);
    }
} 
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IInteractionNotificationReceiver {
    function notifyInteraction(
        address taker,
        uint256 makingAmount,
        uint256 takingAmount,
        bytes calldata interactiveData
    ) external;
}

contract OptionNFT is ERC721Enumerable, Ownable, EIP712, IInteractionNotificationReceiver, ReentrancyGuard {
    using ECDSA for bytes32;

    struct Option {
        address underlyingAsset;
        address strikeAsset;
        address maker;
        uint256 strikePrice;
        uint256 expiry;
        uint256 amount;
        bool exercised;
    }

    bytes32 public constant OPTION_TYPEHASH = keccak256(
        "Option(address underlyingAsset,address strikeAsset,address maker,uint256 strikePrice,uint256 expiry,uint256 amount,uint256 nonce)"
    );

    uint256 public nextOptionId;
    mapping(uint256 => Option) public options;
    mapping(address => mapping(uint256 => bool)) public usedNonces; // maker => nonce => used
    
    address public limitOrderProtocol;

    event OptionMinted(uint256 indexed optionId, address indexed to, address indexed maker);
    event OptionExercised(uint256 indexed optionId, address indexed exerciser);

    constructor(address _limitOrderProtocol) 
        ERC721("OnChainCallOption", "OCCO") 
        Ownable(msg.sender)
        EIP712("OptionNFT", "1")
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

    /// @notice Called by LOP after a taker fills the order
    function notifyInteraction(
        address taker,
        uint256,
        uint256,
        bytes calldata interactiveData
    ) external override onlyLimitOrderProtocol {
        (
            address underlying,
            address strikeAsset, 
            address maker,
            uint256 strikePrice,
            uint256 expiry,
            uint256 amount,
            uint256 nonce,
            bytes memory optionSignature
        ) = abi.decode(interactiveData, (address, address, address, uint256, uint256, uint256, uint256, bytes));

        // Validation
        require(underlying != address(0) && strikeAsset != address(0), "Invalid assets");
        require(maker != address(0), "Invalid maker");
        require(strikePrice > 0, "Invalid strike price");
        require(expiry > block.timestamp, "Already expired");
        require(amount > 0, "Invalid amount");
        require(!usedNonces[maker][nonce], "Nonce already used");

        // Verify signature
        bytes32 structHash = keccak256(
            abi.encode(
                OPTION_TYPEHASH,
                underlying,
                strikeAsset,
                maker,
                strikePrice,
                expiry,
                amount,
                nonce
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
        address recovered = digest.recover(optionSignature);
        require(maker == recovered, "Invalid signature");

        // Mark nonce as used
        usedNonces[maker][nonce] = true;

        // Pull collateral from maker
        require(IERC20(underlying).transferFrom(maker, address(this), amount), "Transfer failed");

        // Mint option NFT to taker
        uint256 optionId = nextOptionId++;
        options[optionId] = Option({
            underlyingAsset: underlying,
            strikeAsset: strikeAsset,
            maker: maker,
            strikePrice: strikePrice,
            expiry: expiry,
            amount: amount,
            exercised: false
        });

        _mint(taker, optionId);
        emit OptionMinted(optionId, taker, maker);
    }

    /// @notice Option holder exercises the option
    function exercise(uint256 optionId) external nonReentrant {
        Option storage opt = options[optionId];
        require(ownerOf(optionId) == msg.sender, "Not option holder");
        require(block.timestamp <= opt.expiry, "Expired");
        require(!opt.exercised, "Already exercised");

        opt.exercised = true;

        // Transfer strike payment from option holder to maker
        require(
            IERC20(opt.strikeAsset).transferFrom(msg.sender, opt.maker, opt.strikePrice),
            "Strike payment failed"
        );

        // Transfer underlying asset from vault to option holder
        require(
            IERC20(opt.underlyingAsset).transfer(msg.sender, opt.amount),
            "Asset transfer failed"
        );

        _burn(optionId);
        emit OptionExercised(optionId, msg.sender);
    }

    /// @notice Get option details
    function getOption(uint256 optionId) external view returns (Option memory) {
        require(optionId < nextOptionId, "Option does not exist");
        return options[optionId];
    }

    /// @notice Check if option is expired
    function isExpired(uint256 optionId) external view returns (bool) {
        require(optionId < nextOptionId, "Option does not exist");
        return block.timestamp > options[optionId].expiry;
    }

    /// @notice Emergency withdraw function (only owner)
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
} 
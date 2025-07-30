// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../external/limit-order-protocol/contracts/interfaces/ITakerInteraction.sol";
import "../external/limit-order-protocol/contracts/interfaces/IOrderMixin.sol";

contract OptionNFT is ERC721Enumerable, Ownable, EIP712, ITakerInteraction, ReentrancyGuard {
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

    // Updated OPTION_TYPEHASH without nonce - using salt for uniqueness
    bytes32 public constant OPTION_TYPEHASH = keccak256(
        "Option(address underlyingAsset,address strikeAsset,address maker,uint256 strikePrice,uint256 expiry,uint256 amount,uint256 salt)"
    );

    uint256 public nextOptionId;
    mapping(uint256 => Option) public options;
    
    // ORDER HASH-BASED replay protection (replacing nonce system)
    mapping(bytes32 => bool) public usedOrderHashes; // orderHash => used
    
    // Collateral tracking
    mapping(uint256 => bool) public collateralProvided; // optionId => collateral status
    mapping(uint256 => uint256) public collateralTimestamp; // optionId => when collateral was provided
    
    address public limitOrderProtocol;
    
    // Default option parameters for compact mode
    address public defaultUnderlyingAsset;
    address public defaultStrikeAsset;
    uint256 public defaultStrikePrice;
    uint256 public defaultAmount;

    event OptionMinted(uint256 indexed optionId, address indexed to, address indexed maker);
    event OptionExercised(uint256 indexed optionId, address indexed exerciser);
    event TakerInteractionCalled(address taker, uint256 makingAmount, uint256 takingAmount);
    event DebugInfo(string message, bytes data);
    event CollateralProvided(uint256 indexed optionId, address indexed maker, uint256 amount, uint256 timestamp);
    event CollateralReturned(uint256 indexed optionId, address indexed to, uint256 amount, uint256 timestamp);
    event OrderHashUsed(bytes32 indexed orderHash, address indexed maker);
    event OptionExpired(uint256 indexed optionId, address indexed optionHolder);

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
        // Debug: Log the incoming data
        emit TakerInteractionCalled(taker, makingAmount, takingAmount);
        emit DebugInfo("extraData length", abi.encode(extraData.length));
        
        // Decode parameters from interaction data (salt replaces nonce)
        (
            address maker,
            address underlyingAsset,
            address strikeAsset,
            uint256 strikePrice,
            uint256 expiry,
            uint256 amount,
            uint256 salt,  // Salt for uniqueness (replaces nonce)
            uint8 v,
            bytes32 r,
            bytes32 s
        ) = abi.decode(extraData, (address, address, address, uint256, uint256, uint256, uint256, uint8, bytes32, bytes32));

        emit DebugInfo("decoded maker", abi.encode(maker));
        emit DebugInfo("decoded underlyingAsset", abi.encode(underlyingAsset));
        emit DebugInfo("decoded strikeAsset", abi.encode(strikeAsset));
        emit DebugInfo("decoded strikePrice", abi.encode(strikePrice));
        emit DebugInfo("decoded expiry", abi.encode(expiry));
        emit DebugInfo("decoded amount", abi.encode(amount));
        emit DebugInfo("decoded salt", abi.encode(salt));

        // Basic validation using actual parameters from signature
        require(maker != address(0), "Invalid maker");
        require(underlyingAsset != address(0), "Invalid underlying asset");
        require(strikeAsset != address(0), "Invalid strike asset");
        require(strikePrice > 0, "Invalid strike price");
        require(amount > 0, "Invalid amount");
        
        // Create option hash for replay protection using EIP-712 hash
        bytes32 structHash = keccak256(
            abi.encode(
                OPTION_TYPEHASH,
                underlyingAsset,
                strikeAsset,
                maker,
                strikePrice,
                expiry,
                amount,
                salt
            )
        );

        bytes32 optionHash = keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
        
        // ORDER HASH-BASED replay protection
        require(!usedOrderHashes[optionHash], "Option order already used");

        // Verify signature using the same hash
        emit DebugInfo("structHash", abi.encode(structHash));
        emit DebugInfo("optionHash", abi.encode(optionHash));
        
        address recovered = ecrecover(optionHash, v, r, s);
        emit DebugInfo("recovered address", abi.encode(recovered));
        require(maker == recovered, "Invalid signature");

        // Mark order hash as used
        usedOrderHashes[optionHash] = true;
        emit OrderHashUsed(optionHash, maker);

        // Pull collateral from maker using actual amount from signature
        require(IERC20(underlyingAsset).transferFrom(maker, address(this), amount), "Transfer failed");

        // Mint option NFT to taker using actual parameters from signature
        uint256 optionId = nextOptionId++;
        options[optionId] = Option({
            underlyingAsset: underlyingAsset,
            strikeAsset: strikeAsset,
            maker: maker,
            strikePrice: strikePrice,
            expiry: expiry,
            amount: amount,
            exercised: false
        });

        // Track collateral provision
        collateralProvided[optionId] = true;
        collateralTimestamp[optionId] = block.timestamp;
        
        emit CollateralProvided(optionId, maker, amount, block.timestamp);
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

        emit CollateralReturned(optionId, msg.sender, opt.amount, block.timestamp);
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

    /// @notice Check if collateral was provided for an option
    function isCollateralProvided(uint256 optionId) external view returns (bool) {
        require(optionId < nextOptionId, "Option does not exist");
        return collateralProvided[optionId];
    }

    /// @notice Get when collateral was provided for an option
    function getCollateralTimestamp(uint256 optionId) external view returns (uint256) {
        require(optionId < nextOptionId, "Option does not exist");
        require(collateralProvided[optionId], "Collateral not provided");
        return collateralTimestamp[optionId];
    }

    /// @notice Get how long collateral has been held for an option
    function getCollateralDuration(uint256 optionId) external view returns (uint256) {
        require(optionId < nextOptionId, "Option does not exist");
        require(collateralProvided[optionId], "Collateral not provided");
        return block.timestamp - collateralTimestamp[optionId];
    }

    /// @notice Clean up expired options - return collateral to maker
    function cleanupExpiredOption(uint256 optionId) public {
        Option storage opt = options[optionId];
        require(optionId < nextOptionId, "Option does not exist");
        require(block.timestamp > opt.expiry, "Option not expired yet");
        require(!opt.exercised, "Option already exercised");
        require(collateralProvided[optionId], "Collateral not provided");

        opt.exercised = true;
        address optionHolder = ownerOf(optionId);
        
        // Return collateral to maker (option holder gets nothing)
        require(
            IERC20(opt.underlyingAsset).transfer(opt.maker, opt.amount),
            "Collateral return failed"
        );

        emit CollateralReturned(optionId, opt.maker, opt.amount, block.timestamp);
        _burn(optionId);
        emit OptionExpired(optionId, optionHolder);
    }

    /// @notice Batch settle multiple expired options
    function batchCleanupExpiredOptions(uint256[] calldata optionIds) external {
        for (uint256 i = 0; i < optionIds.length; i++) {
            uint256 optionId = optionIds[i];
            cleanupExpiredOption(optionId);
        }
    }

    /// @notice Get all expired options that need settlement
    function getExpiredOptions(uint256 startIndex, uint256 maxCount) external view returns (uint256[] memory) {
        uint256[] memory expiredOptions = new uint256[](maxCount);
        uint256 count = 0;
        
        for (uint256 i = startIndex; i < nextOptionId && count < maxCount; i++) {
            Option storage opt = options[i];
            if (block.timestamp > opt.expiry && !opt.exercised) {
                expiredOptions[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        assembly {
            mstore(expiredOptions, count)
        }
        
        return expiredOptions;
    }

    /// @notice Emergency withdraw function (only owner)
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    // ORDER HASH-BASED functions (replacing nonce functions)
    
    /// @notice Check if an order hash is available (not used)
    /// @param orderHash The hash of the order to check
    /// @return True if the order hash is available
    function isOrderHashAvailable(bytes32 orderHash) external view returns (bool) {
        return !usedOrderHashes[orderHash];
    }

    /// @notice Mark order hash as used (only callable by LOP)
    /// @param orderHash The hash of the order to mark as used
    function markOrderHashUsed(bytes32 orderHash) external onlyLimitOrderProtocol {
        usedOrderHashes[orderHash] = true;
    }

    /// @notice Generate option hash for given parameters
    /// @param underlyingAsset The underlying asset address
    /// @param strikeAsset The strike asset address
    /// @param maker The maker address
    /// @param strikePrice The strike price
    /// @param expiry The expiry timestamp
    /// @param amount The option amount
    /// @param salt The salt for uniqueness
    /// @return The option hash
    function generateOptionHash(
        address underlyingAsset,
        address strikeAsset,
        address maker,
        uint256 strikePrice,
        uint256 expiry,
        uint256 amount,
        uint256 salt
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                OPTION_TYPEHASH,
                underlyingAsset,
                strikeAsset,
                maker,
                strikePrice,
                expiry,
                amount,
                salt
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
    }

    /// @notice Check if option parameters would create a valid unused hash
    /// @param underlyingAsset The underlying asset address
    /// @param strikeAsset The strike asset address
    /// @param maker The maker address
    /// @param strikePrice The strike price
    /// @param expiry The expiry timestamp
    /// @param amount The option amount
    /// @param salt The salt for uniqueness
    /// @return True if the parameters would create an unused hash
    function isOptionHashAvailable(
        address underlyingAsset,
        address strikeAsset,
        address maker,
        uint256 strikePrice,
        uint256 expiry,
        uint256 amount,
        uint256 salt
    ) external view returns (bool) {
        bytes32 optionHash = this.generateOptionHash(
            underlyingAsset,
            strikeAsset,
            maker,
            strikePrice,
            expiry,
            amount,
            salt
        );
        return !usedOrderHashes[optionHash];
    }
} 
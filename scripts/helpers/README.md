# Order Builder Helper Functions

This directory contains helper functions to easily build and sign Limit Order Protocol (LOP) orders and call option orders.

## Quick Start

### 1. Basic LOP Order

```javascript
const { buildOrder, signOrder } = require("./orderBuilder");

// Build a simple token swap order
const orderResult = buildOrder({
  maker: "0x...",
  makerAsset: "0x...", // Token maker offers
  takerAsset: "0x...", // Token taker pays
  makingAmount: "1000000000000000000", // 1 ETH
  takingAmount: "2000000000", // 2000 USDC
});

// Sign the order
const signature = await signOrder(orderResult.order, makerAddress, lopAddress);
```

### 2. Call Option Order (One Function!)

```javascript
const { buildCompleteCallOption, fillCallOption } = require("./orderBuilder");

// Build complete call option with automatic signatures
const orderData = await buildCompleteCallOption({
  maker: makerAddress,
  underlyingAsset: ethAddress,
  strikeAsset: usdcAddress,
  strikePrice: "2000000000", // 2000 USDC per ETH
  optionAmount: "1000000000000000000", // 1 ETH
  premium: "100000000", // 100 USDC
  expiry: Math.floor(Date.now() / 1000) + 86400, // 24 hours
  lopAddress: lopContractAddress,
  optionsNFTAddress: optionsNFTContractAddress,
  nonce: 1
});

// Fill the order
const tx = await fillCallOption({
  orderData,
  taker: takerAddress,
  fillAmount: "50000000", // 50 USDC (partial fill)
  lopAddress: lopContractAddress
});
```

## Available Functions

### Core Functions

- **`buildOrder(params)`** - Build a standard LOP order
- **`signOrder(order, signer, lopAddress)`** - Sign a LOP order
- **`buildCallOptionOrder(params)`** - Build a call option order (NFT creation)
- **`signOptionsNFT(optionParams, signer, optionsNFTAddress, nonce)`** - Sign OptionsNFT parameters
- **`buildOptionsNFTInteraction(params)`** - Build interaction data for OptionsNFT

### High-Level Functions

- **`buildCompleteCallOption(params)`** - Complete call option builder with automatic signatures
- **`fillCallOption(params)`** - Fill a call option order

### Utility Functions

- **`toAddressType(addr)`** - Convert address to 32-byte padded format
- **`setMakerTraits(flags)`** - Set maker traits flags
- **`buildTakerTraits(interactionLength)`** - Build taker traits

## Call Option Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `maker` | string | Maker's address |
| `underlyingAsset` | string | Underlying asset address (e.g., ETH) |
| `strikeAsset` | string | Strike asset address (e.g., USDC) |
| `strikePrice` | string/number | Strike price in strike asset units |
| `optionAmount` | string/number | Amount of underlying in option |
| `premium` | string/number | Premium in strike asset units |
| `expiry` | number | Expiry timestamp |
| `lopAddress` | string | LOP contract address |
| `optionsNFTAddress` | string | OptionsNFT contract address |
| `nonce` | number | Nonce for signature (default: 1) |

## Example: Complete Call Option Flow

```javascript
// 1. Build the complete order with signatures
const orderData = await buildCompleteCallOption({
  maker: makerAddress,
  underlyingAsset: ethAddress,
  strikeAsset: usdcAddress,
  strikePrice: ethers.parseUnits("2000", 6),
  optionAmount: ethers.parseEther("1"),
  premium: ethers.parseUnits("100", 6),
  expiry: Math.floor(Date.now() / 1000) + 86400,
  lopAddress: lopAddress,
  optionsNFTAddress: optionsNFTAddress
});

// 2. Fill the order
const tx = await fillCallOption({
  orderData,
  taker: takerAddress,
  fillAmount: ethers.parseUnits("50", 6),
  lopAddress: lopAddress
});

// 3. Check results
const receipt = await tx.wait();
console.log("Order filled successfully!");
```

## Key Features

### ✅ Automatic Signature Generation
- LOP order signatures
- OptionsNFT parameter signatures
- EIP-712 compliant

### ✅ No Direct Asset Transfer
- `makingAmount = 0` prevents direct ETH transfer
- Only premium payment and NFT minting
- Collateral handled via `takerInteraction`

### ✅ Flexible Parameters
- Support for any underlying/strike assets
- Customizable strike prices and amounts
- Configurable expiry times

### ✅ Error Handling
- Proper parameter validation
- Clear error messages
- Type safety with BigInt handling

## Advanced Usage

### Custom Maker Traits

```javascript
const orderResult = buildCallOptionOrder({
  maker: makerAddress,
  underlyingAsset: ethAddress,
  strikeAsset: usdcAddress,
  strikePrice: "2000000000",
  optionAmount: "1000000000000000000",
  premium: "100000000",
  expiry: Math.floor(Date.now() / 1000) + 86400,
  makerTraits: {
    noPartialFills: true,
    allowMultipleFills: false
  }
});
```

### Manual Interaction Building

```javascript
// Build order and signatures separately
const orderResult = buildCallOptionOrder({...});
const lopSignature = await signOrder(orderResult.order, maker, lopAddress);
const optionsNFTSignature = await signOptionsNFT(orderResult.optionParams, maker, optionsNFTAddress);

// Build interaction manually
const interaction = buildOptionsNFTInteraction({
  maker: makerAddress,
  optionParams: orderResult.optionParams,
  signature: optionsNFTSignature,
  optionsNFTAddress: optionsNFTAddress
});
```

## Testing

Run the simple example:

```bash
npx hardhat run scripts/test-options-simple.js
```

This will demonstrate the complete flow from order creation to NFT minting. 
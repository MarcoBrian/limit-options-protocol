# Options Protocol Test Scripts

This directory contains test scripts for the Options Protocol built on top of the 1inch Limit Order Protocol, implementing a dummy token approach to prevent unwanted asset transfers during option creation.

## 🎯 Problem Solved

Traditional options protocols face a challenge when integrating with order protocols like 1inch LOP:
- **Issue**: LOP always transfers maker assets to takers during order fills
- **Problem**: For options, we want takers to receive NFTs (option rights), not the underlying assets
- **Solution**: Use dummy ERC20 tokens as placeholders in LOP orders while handling real collateral separately

## 📁 Scripts Overview

### Core Scripts

#### `test-options-advanced.js`
The main test script demonstrating the complete options flow:
- **Purpose**: Full end-to-end test of ETH call options with USDC premium
- **Features**: 
  - Dummy token approach implementation
  - OptionsNFT minting via taker interaction
  - Protocol-level partial fill prevention
  - Real ETH collateral management
- **Flow**: Taker pays USDC premium → receives option NFT → dummy tokens are burned

#### `test-options-with-builder.js`
Clean implementation using the orderBuilder helper library:
- **Purpose**: Demonstrates proper usage of the orderBuilder API
- **Benefits**: Simplified code, reusable functions, better error handling
- **Recommended**: Use this for new implementations

#### `test-options-simple.js`
Simplified version for learning and debugging:
- **Purpose**: Basic options functionality without advanced features
- **Use case**: Understanding core concepts and troubleshooting

### Helper Libraries

#### `helpers/orderBuilder.js`
Comprehensive utility library for options orders:
- **Functions**: Complete order building, signing, and filling
- **Features**: Dummy token management, signature generation, cleanup
- **API**: Clean, reusable functions for all options operations

### Contracts

#### `DummyOptionToken.sol`
ERC20 token used as maker asset placeholder:
- **Purpose**: Satisfies LOP's requirement for maker asset transfers
- **Value**: Worthless - gets burned after transfer
- **Benefit**: Allows real value (NFT) to be provided via interactions

## 🚀 How to Run

### Prerequisites
```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile
```

### Running Tests

1. **Start Hardhat Network:**
   ```bash
   npx hardhat node
   ```

2. **Run Tests (in new terminal):**
   ```bash
   # Recommended: Clean orderBuilder implementation
   npx hardhat run scripts/test-options-with-builder.js

   # Advanced: Full featured implementation
   npx hardhat run scripts/test-options-advanced.js

   # Simple: Basic options functionality
   npx hardhat run scripts/test-options-simple.js
   ```

## 🔄 Transaction Flow

### Before Transaction
```
Maker: 10 ETH + 1 Dummy Token + 0 USDC
Taker: 0 ETH + 0 Dummy Token + 10,000 USDC
```

### During LOP Order Fill
1. **LOP Transfer**: 1 Dummy Token (Maker → Taker)
2. **LOP Transfer**: 100 USDC Premium (Taker → Maker)
3. **Taker Interaction**: OptionsNFT.mint() called
4. **Collateral Pull**: 1 ETH (Maker → OptionsNFT contract)
5. **NFT Mint**: Option NFT (OptionsNFT → Taker)

### After Transaction
```
Maker: 9 ETH + 0 Dummy Token + 100 USDC
Taker: 0 ETH + 0 Dummy Token + 9,900 USDC + 1 Option NFT
OptionsNFT Contract: 1 ETH (as collateral)
```

### Cleanup
```
Taker burns worthless dummy token → Final state achieved
```

## 🎛️ Key Features

### Dummy Token Approach
- **Maker Asset**: DummyOptionToken (worthless placeholder)
- **Real Value**: Option NFT with underlying asset rights
- **Collateral**: Managed separately by OptionsNFT contract
- **Cleanup**: Dummy tokens burned post-transaction

### Protocol-Level Protections
- **Partial Fill Prevention**: `NO_PARTIAL_FILLS_FLAG` in maker traits
- **Signature Verification**: Dual signatures (LOP + OptionsNFT)
- **Collateral Safety**: Real assets locked in OptionsNFT contract

### Option NFT Features
- **EIP-721 Compliant**: Standard NFT with option metadata
- **Exercise Rights**: NFT holder can exercise before expiry
- **Collateral Tracking**: Automatic collateral management
- **Signature Verification**: EIP-712 signed option parameters

## 📊 Test Output Example

```
🚀 Testing ETH Call Option with OrderBuilder (Dummy Token Approach)
==================================================================

📦 Deploying contracts...
✅ All contracts deployed successfully

💰 Checking balances before fill...
Maker ETH: 10.0, USDC: 0.0, Dummy: 1.0
Taker ETH: 0.0, USDC: 10000.0, Dummy: 0.0

🔄 Filling order with NFT minting...
✅ Order filled successfully!

💰 Checking balances after fill...
Maker ETH: 9.0 (-1.0), USDC: 100.0 (+100.0), Dummy: 0.0 (-1.0)
Taker ETH: 0.0 (0.0), USDC: 9900.0 (-100.0), Dummy: 1.0 (+1.0)

🖼️ NFT Details:
- Strike Price: 2000.0 USDC per ETH
- Expiry: 2025-07-30T07:50:13.000Z
- Amount: 1.0 ETH
- Exercised: false

🔥 Burned 1.0 dummy tokens
🎉 Test completed successfully!
```

## 🛠️ OrderBuilder API

### Quick Start
```javascript
const {
  buildCompleteCallOption,
  fillCallOption,
  deployDummyOptionToken,
  setupDummyTokensForMaker,
  cleanupDummyTokens
} = require("./helpers/orderBuilder");

// 1. Deploy dummy token
const dummyToken = await deployDummyOptionToken();

// 2. Setup maker
await setupDummyTokensForMaker({
  dummyTokenAddress: dummyToken.address,
  maker: maker.address,
  lopAddress: lop.target,
  optionAmount: ethers.parseEther("1")
});

// 3. Build order
const orderData = await buildCompleteCallOption({
  makerSigner: maker,
  dummyTokenAddress: dummyToken.address,
  // ... other params
});

// 4. Fill order
await fillCallOption({
  orderData,
  takerSigner: taker,
  fillAmount: premium,
  lopAddress: lop.target
});

// 5. Cleanup
await cleanupDummyTokens(dummyToken.address, taker.address);
```

## 🔧 Architecture Benefits

### For Developers
- **Clean Separation**: LOP handles order matching, OptionsNFT handles value
- **Reusable Components**: OrderBuilder provides production-ready functions
- **Type Safety**: Proper TypeScript-style JSDoc annotations
- **Error Handling**: Comprehensive error checking and reporting

### For Users
- **Gas Efficient**: Minimal dummy token operations
- **Secure**: Real assets locked in auditable contracts
- **Standard Compliant**: EIP-712, EIP-721, and LOP compatible
- **Transparent**: Clear transaction flow and balance tracking

## 🚨 Important Notes

1. **Dummy Tokens**: Have no real value - always burn after receiving
2. **Collateral**: Real ETH is locked in OptionsNFT contract, not transferred to taker
3. **Signatures**: Dual signing required (LOP order + OptionsNFT parameters)
4. **Partial Fills**: Prevented at protocol level using maker traits
5. **Exercise Rights**: Only NFT holder can exercise options before expiry

## 🔍 Troubleshooting

### Common Issues
- **Signature Errors**: Ensure both LOP and OptionsNFT signatures are valid
- **Balance Issues**: Check token approvals and dummy token setup
- **NFT Minting**: Verify OptionsNFT contract has proper permissions
- **Collateral**: Ensure maker has sufficient underlying assets approved

### Debug Steps
1. Run `test-options-simple.js` for basic functionality
2. Check contract deployment addresses
3. Verify token balances and approvals
4. Test signature generation separately
5. Use `console.log` for transaction details

This implementation represents a novel solution to the options-on-orderbook problem, enabling clean separation between order execution and value delivery while maintaining full protocol compatibility. 
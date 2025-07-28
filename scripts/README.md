# Limit Order Protocol Test Scripts

This directory contains test scripts to verify interactions with the 1inch Limit Order Protocol.

## Scripts

### `test-limit-order-protocol.js`
A basic test script that demonstrates:
- Deploying mock ERC20 tokens and WETH
- Deploying the Limit Order Protocol
- Creating and signing orders
- Filling orders on-chain

### `test-limit-order-protocol-v2.js`
An improved version with proper EIP-712 signing that:
- Uses `signTypedData` for proper EIP-712 signature generation
- Includes proper domain and type definitions
- Provides better error handling and logging

## How to Run

1. **Start a local Hardhat node:**
   ```bash
   npx hardhat node
   ```

2. **In a new terminal, run the test:**
   ```bash
   # Run the improved version (recommended)
   npm run test:lop
   
   # Or run the simple version
   npm run test:lop-simple
   ```

## What the Test Does

1. **Deploys Contracts:**
   - Mock ERC20 tokens (Token A and Token B)
   - Mock WETH contract
   - Limit Order Protocol contract

2. **Sets Up Tokens:**
   - Mints 1000 tokens to maker and taker
   - Approves tokens for the LOP contract

3. **Creates Order:**
   - Maker offers 100 Token A
   - Taker pays 50 Token B
   - Uses random salt for uniqueness

4. **Signs Order:**
   - Creates EIP-712 typed data
   - Signs with maker's private key
   - Extracts r, s, v signature components

5. **Fills Order:**
   - Taker fills 25 Token B worth (partial fill)
   - Verifies token transfers
   - Shows balance changes

## Expected Output

The script will show:
- Contract deployment addresses
- Token balances before and after
- Order parameters and hash
- Signature details
- Transaction success/failure
- Balance changes for all parties

## Troubleshooting

If you encounter issues:

1. **Make sure Hardhat node is running** on localhost:8545
2. **Check contract compilation** - run `npx hardhat compile`
3. **Verify mock contracts** are properly deployed
4. **Check signature format** - ensure EIP-712 is used correctly

## Key Concepts

- **Maker**: Creates and signs the order
- **Taker**: Fills the order by calling `fillOrder()`
- **Order Hash**: Unique identifier for each order
- **EIP-712**: Standard for typed data signing
- **Partial Fills**: Orders can be filled multiple times until exhausted 
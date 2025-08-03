# Deployment Scripts

This folder contains all deployment-related scripts.

## 📦 Main Deployment Scripts

### `deploy.js`
- **Purpose**: Deploy contracts to localhost/hardhat network
- **Usage**: `npx hardhat run scripts/deployment/deploy.js --network localhost`
- **What it does**: Deploys all contracts (LOP, OptionsNFT, Mock tokens) to local network

### `deploy-production.js`
- **Purpose**: Deploy contracts to production networks (Base Sepolia)
- **Usage**: `npx hardhat run scripts/deployment/deploy-production.js --network base-sepolia`
- **Features**: 
  - Verifies deployer account
  - Skips already deployed contracts
  - Production-ready deployment

## ⚙️ Environment Setup

### `setup-production-env.js`
- **Purpose**: Setup environment variables for production deployment
- **Usage**: `node scripts/deployment/setup-production-env.js`
- **Creates**: Production-ready `.env` file

### `setup-frontend-env.js`
- **Purpose**: Setup frontend environment variables
- **Usage**: `node scripts/deployment/setup-frontend-env.js`
- **Creates**: Frontend `.env` with contract addresses

## 🔍 Verification Scripts

### `check-deployment.js`
- **Purpose**: Verify all contracts are deployed correctly
- **Usage**: `node scripts/deployment/check-deployment.js`
- **Checks**: Contract addresses, code existence, basic functionality

### `check-deployer.js`
- **Purpose**: Verify deployer account and balance
- **Usage**: `node scripts/deployment/check-deployer.js`
- **Shows**: Account address, balance, network status

### `test-signer.js`
- **Purpose**: Test Hardhat signer configuration
- **Usage**: `node scripts/deployment/test-signer.js`
- **Verifies**: Signer matches private key, network configuration

## 🚀 Quick Commands

```bash
# Complete production deployment
npx hardhat run scripts/deployment/deploy-production.js --network base-sepolia

# Verify deployment
node scripts/deployment/check-deployment.js

# Check deployer account
node scripts/deployment/check-deployer.js
```
# Project Overview - 1option Protocol


> A decentralized, permissionless protocol for options built on the 1inch Limit Order Protocol

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-FFDB1C.svg)](https://hardhat.org/)
[![1inch](https://img.shields.io/badge/Built%20on-1inch%20LOP-00D2FF.svg)](https://1inch.io/)

![1option banner](banner.png)

## Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Development Setup](#-development-setup)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)

## Overview

**1option** is a decentralized, permissionless protocol that allows anyone to mint, buy, and exercise call options built on top of the 1inch Limit Order Protocol as a settlement layer. It leverages off-chain signatures, on-chain NFT minting, and tokenized collateral to create a new class of decentralized financial derivatives , without relying on a traditional order book model.

## Key Features

- **Decentralized Options Trading** - No centralized intermediaries
- **Collateralized Positions** - Fully backed by tokenized collateral  
- **Off-Chain Signatures** - Gas-efficient order matching
- **NFT-Based Options** - Each option is a unique NFT
- **1inch Integration** - Built on battle-tested infrastructure
- **Permissionless** - Anyone can participate

## Architecture

The protocol consists of three main components:

- **Smart Contracts** - Core protocol logic and NFT minting
- **Backend API** - Order management and matching
- **Frontend Interface** - User-friendly trading interface

## Development Setup

### Step 1: Clone & Install Dependencies

```bash
# Clone repository
git clone <repository-url>
cd limit-options-protocol

npm install
```

### Step 2: Start Local Blockchain
```bash
npx hardhat node
```

### Step 3: Deploy Smart Contracts
```bash
npm run deploy
```

### Step 4: Configure Frontend Environment
```bash
npm run setup:frontend-env
```

### Step 5: Initialize Demo Data
```bash
npx hardhat run complete-setup.js --network localhost
```

### Step 6: Start Backend Server
```bash
npm start
```

### Step 7: Launch Frontend Application
```bash
npm run frontend
```

## 📁 Project Structure

```
limit-options-protocol/
├── contracts/          # Solidity Smart contracts
├── frontend/           # React frontend application
├── backend/            # Node.js API server + Database
├── scripts/            # Deployment and utility scripts
├── test/               # Test files
└── external/           # External dependencies (1inch Limit Order Protocol contracts for local deployment)
```

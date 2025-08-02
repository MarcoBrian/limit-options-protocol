# 1option Backend Service

> Node.js relayer service for the 1option Protocol, providing order management and settlement coordination

[![Node.js](https://img.shields.io/badge/Node.js-v16+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3.x-blue.svg)](https://sqlite.org/)

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [API Reference](#api-reference)
- [Setup & Installation](#setup--installation)
- [Configuration](#configuration)
- [Security](#security)
- [Database](#database)
- [Testing](#testing)
- [Deployment](#deployment)

## Overview

The 1option Backend Service is a Node.js relayer that handles off-chain order management for the options protocol. It provides secure order storage, validation, and generates pre-packed calldata for efficient on-chain execution using the 1inch Limit Order Protocol as the settlement layer.

## Key Features

- **RESTful API** - Complete order lifecycle management
- **EIP-712 Signature Validation** - Cryptographic security for all orders
- **SQLite Database** - Reliable off-chain order storage
- **Rate Limiting** - Protection against abuse and spam
- **Security Middleware** - Comprehensive protection stack
- **Builder Integration** - Seamless integration with helper functions
- **Calldata Generation** - Pre-packed transaction data for frontends

## API Reference

### POST `/api/orders`
Submit a signed option order to the relayer.

**Request Body:**
```json
{
  "order": {
    "salt": "123456789",
    "maker": "0x...",
    "receiver": "0x...",
    "makerAsset": "0x...",
    "takerAsset": "0x...",
    "makingAmount": "1000000000000000000",
    "takingAmount": "2000000000",
    "makerTraits": "0"
  },
  "signature": {
    "r": "0x...",
    "s": "0x...",
    "v": 27
  },
  "lopAddress": "0x...",
  "optionParams": {
    "underlyingAsset": "0x...",
    "strikeAsset": "0x...",
    "strikePrice": "2000000000",
    "optionAmount": "1000000000000000000",
    "premium": "100000000",
    "expiry": 1735689600,
    "nonce": 1
  },
  "optionsNFTSignature": {
    "r": "0x...",
    "s": "0x...",
    "v": 27
  },
  "optionsNFTAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order accepted and stored",
  "data": {
    "orderHash": "0x...",
    "maker": "0x...",
    "status": "open",
    "id": 1
  }
}
```

### GET `/api/orders`
Retrieve open orders for browsing.

**Query Parameters:**
- `status` (optional): Filter by status (`open`, `filled`, `cancelled`, `expired`)
- `maker` (optional): Filter by maker address
- `makerAsset` (optional): Filter by maker asset
- `takerAsset` (optional): Filter by taker asset
- `limit` (optional): Limit results (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderHash": "0x...",
        "maker": "0x...",
        "makerAsset": "0x...",
        "takerAsset": "0x...",
        "makingAmount": "1000000000000000000",
        "takingAmount": "2000000000",
        "status": "open",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "orderData": { ... },
        "optionParams": { ... }
      }
    ],
    "count": 1,
    "filters": { ... }
  }
}
```

### GET `/api/orders/:orderHash`
Get specific order by hash.

**Response:**
```json
{
  "success": true,
  "data": {
    "orderHash": "0x...",
    "maker": "0x...",
    "makerAsset": "0x...",
    "takerAsset": "0x...",
    "makingAmount": "1000000000000000000",
    "takingAmount": "2000000000",
    "status": "open",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "orderData": { ... },
    "optionParams": { ... }
  }
}
```

### POST `/api/orders/:orderHash/fill`
Generate pre-packed calldata for filling an order.

**Request Body:**
```json
{
  "taker": "0x...",
  "fillAmount": "50000000",
  "lopAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderHash": "0x...",
    "fillCalldata": {
      "to": "0x...",
      "data": "0x...",
      "value": "0",
      "estimatedGas": "300000"
    },
    "taker": "0x...",
    "fillAmount": "50000000",
    "estimatedGas": "300000"
  }
}
```

### POST `/api/orders/:orderHash/cancel`
Cancel an order (mark as cancelled).

**Request Body:**
```json
{
  "maker": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "orderHash": "0x...",
    "status": "cancelled"
  }
}
```

## Setup & Installation

### Prerequisites

- **Node.js** v16 or higher
- **npm** or **yarn**
- **SQLite3** (included with Node.js)

### Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup

Create and configure your environment file:

```bash
cp env.example .env
```

**Environment Configuration:**
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration  
DATABASE_PATH=./data/orders.db

# Blockchain Configuration
CHAIN_ID=1
RPC_URL=http://localhost:8545
LOP_ADDRESS=0x... # Your deployed LOP contract address
OPTIONS_NFT_ADDRESS=0x... # Your deployed OptionsNFT contract address

# Security Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
CORS_ORIGIN=*

# Logging Configuration
LOG_LEVEL=info
ENABLE_CONSOLE_LOG=true
ENABLE_FILE_LOG=false
```

### 3. Initialize Database

```bash
mkdir -p data
```

### 4. Start the Service

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

**The service will be available at `http://localhost:3000`**

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | No |
| `NODE_ENV` | Environment mode (`development`, `production`) | `development` | No |
| `DATABASE_PATH` | SQLite database file path | `./data/orders.db` | No |
| `CHAIN_ID` | Blockchain network chain ID | `1` | No |
| `RPC_URL` | Ethereum RPC endpoint URL | `http://localhost:8545` | No |
| `LOP_ADDRESS` | 1inch Limit Order Protocol contract address | - | **Yes** |
| `OPTIONS_NFT_ADDRESS` | Options NFT contract address | - | **Yes** |
| `RATE_LIMIT_WINDOW_MS` | Rate limiting time window (milliseconds) | `900000` | No |
| `RATE_LIMIT_MAX` | Maximum requests per time window | `100` | No |
| `CORS_ORIGIN` | CORS allowed origins | `*` | No |
| `LOG_LEVEL` | Logging verbosity (`error`, `warn`, `info`, `debug`) | `info` | No |
| `ENABLE_CONSOLE_LOG` | Enable console logging | `true` | No |
| `ENABLE_FILE_LOG` | Enable file logging | `false` | No |

## Security

The backend implements multiple layers of security:

### Cryptographic Security
- **EIP-712 Signature Validation** - All orders cryptographically verified
- **Order Hash Verification** - Prevents tampering and replay attacks

### Network Security  
- **Rate Limiting** - Configurable request throttling (100 req/15min default)
- **CORS Protection** - Cross-origin resource sharing controls
- **HTTP Security Headers** - Helmet.js security middleware

### Data Security
- **Input Validation** - Comprehensive request validation using Joi schemas
- **SQL Injection Protection** - Parameterized queries and prepared statements
- **Data Sanitization** - All inputs sanitized before processing

## Database

### Orders Table Schema
```sql
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_hash TEXT UNIQUE NOT NULL,
  maker TEXT NOT NULL,
  maker_asset TEXT NOT NULL,
  taker_asset TEXT NOT NULL,
  making_amount TEXT NOT NULL,
  taking_amount TEXT NOT NULL,
  salt TEXT NOT NULL,
  receiver TEXT NOT NULL,
  maker_traits TEXT NOT NULL,
  order_data TEXT NOT NULL,
  signature TEXT NOT NULL,
  option_params TEXT,
  options_nft_signature_r TEXT,
  options_nft_signature_s TEXT,
  options_nft_signature_v TEXT,
  options_nft_salt TEXT,
  interaction_data TEXT,
  status TEXT DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Auto-incrementing primary key |
| `order_hash` | TEXT | Unique EIP-712 order hash |
| `maker` | TEXT | Order maker's address |
| `maker_asset` | TEXT | Asset being offered by maker |
| `taker_asset` | TEXT | Asset requested by maker |
| `making_amount` | TEXT | Amount of maker asset |
| `taking_amount` | TEXT | Amount of taker asset |
| `salt` | TEXT | Unique salt for order |
| `receiver` | TEXT | Address to receive taker asset |
| `maker_traits` | TEXT | Encoded maker preferences |
| `order_data` | TEXT | JSON serialized complete order object |
| `signature` | TEXT | JSON serialized EIP-712 signature |
| `option_params` | TEXT | JSON serialized option parameters |
| `options_nft_signature_r` | TEXT | Options NFT signature R component |
| `options_nft_signature_s` | TEXT | Options NFT signature S component |
| `options_nft_signature_v` | TEXT | Options NFT signature V component |
| `options_nft_salt` | TEXT | Salt for Options NFT minting |
| `interaction_data` | TEXT | Additional interaction calldata |
| `status` | TEXT | Order status (`open`, `filled`, `cancelled`, `expired`) |
| `created_at` | DATETIME | Order creation timestamp |
| `updated_at` | DATETIME | Last update timestamp |

## Integration with Builder Helpers

The relayer integrates with existing builder helper functions:

```javascript
const {
  buildCompleteCallOption,
  fillCallOption
} = require('../../scripts/helpers/orderBuilder');

const fillCalldata = await generateOptionsFillCalldata({
  orderData,
  taker,
  fillAmount,
  lopAddress
});
```

## Testing

### Health Check

Verify the service is running:
```bash
curl http://localhost:3000/health
```

### API Testing

**Submit a test order:**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "order": { ... },
    "signature": { ... },
    "lopAddress": "0x..."
  }'
```

**Retrieve orders:**
```bash
curl http://localhost:3000/api/orders?status=open&limit=10
```

**Get specific order:**
```bash
curl http://localhost:3000/api/orders/0x[orderHash]
```

## Monitoring & Logs

### Service Health
- **Health endpoint:** `GET /health`
- **Database status** in application logs
- **Rate limiting** headers in API responses

### Logging Features
- Order submission and validation events
- Database operation logging
- Error tracking and debugging
- Performance metrics and timing

---

**For additional setup information, see the main project [README](../README.md)**

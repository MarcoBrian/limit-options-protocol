# Options Protocol Backend/Relayer Setup

## 🎯 Overview

This backend/relayer provides a complete REST API for the Options Protocol built on top of 1inch Limit Order Protocol. It handles order storage, validation, and provides pre-packed calldata for order execution.

## ✅ Features Implemented

### ✅ Node.js Backend with REST API
- Express.js server with comprehensive middleware
- RESTful API endpoints for order management
- Health check and monitoring endpoints

### ✅ `/orders` Endpoint to Accept Signed Option Orders
- `POST /api/orders` - Submit signed orders
- `GET /api/orders` - Browse open orders
- `GET /api/orders/:orderHash` - Get specific order
- `POST /api/orders/:orderHash/fill` - Generate fill calldata
- `POST /api/orders/:orderHash/cancel` - Cancel orders

### ✅ Store Off-Chain Orders in DB
- SQLite database for order storage
- Comprehensive order schema with all required fields
- Indexed queries for performance
- Order status tracking (open, filled, cancelled, expired)

### ✅ Validate EIP-712 Signature Before Accepting Order
- Complete EIP-712 signature validation
- Support for both LOP orders and OptionsNFT signatures
- Chain ID and contract address validation
- Recovered address verification

### ✅ Serve GET /orders Endpoint for Takers to Browse Open Options
- Filterable order browsing
- Pagination support
- Status-based filtering
- Asset-based filtering

### ✅ Return Pre-Packed Interaction Calldata to Frontend
- Integration with existing builder helper functions
- Pre-packed transaction calldata generation
- Gas estimation
- Support for both regular LOP orders and options orders

### ✅ Use Builder Helper Functions
- Full integration with `scripts/helpers/orderBuilder.js`
- Leverages existing `buildCompleteCallOption` and `fillCallOption` functions
- Maintains consistency with existing codebase

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│                 │    │                 │    │                 │
│ • Submit Orders │───▶│ • Express API   │───▶│ • SQLite        │
│ • Browse Orders │    │ • Validation    │    │ • Orders Table  │
│ • Fill Orders   │    │ • Builder Helpers│   │ • Indexes       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Blockchain    │
                       │                 │
                       │ • LOP Contract  │
                       │ • OptionsNFT    │
                       │ • Dummy Tokens  │
                       └─────────────────┘
```

## 📁 File Structure

```
backend/
├── server.js                 # Main Express server
├── config/
│   └── config.js            # Configuration management
├── database/
│   └── db.js                # SQLite database operations
├── middleware/
│   ├── signatureValidation.js # EIP-712 signature validation
│   └── orderValidation.js    # Request validation with Joi
├── routes/
│   └── orders.js            # Order management endpoints
├── test/
│   └── test-relayer.js      # API testing script
├── integration-example.js    # Integration example
└── README.md                # Backend documentation

data/
└── orders.db                # SQLite database file

env.example                  # Environment variables template
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
```bash
cp env.example .env
# Edit .env with your contract addresses
```

### 3. Create Data Directory
```bash
mkdir -p data
```

### 4. Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 5. Test the API
```bash
# Run test suite
npm run test:relayer

# Run integration example
node backend/integration-example.js
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | `3000` |
| `NODE_ENV` | Environment mode | No | `development` |
| `LOP_ADDRESS` | LOP contract address | Yes | - |
| `OPTIONS_NFT_ADDRESS` | OptionsNFT contract address | Yes | - |
| `CHAIN_ID` | Blockchain chain ID | No | `1` |
| `RPC_URL` | Ethereum RPC URL | No | `http://localhost:8545` |

### Example .env file:
```env
PORT=3000
NODE_ENV=development
LOP_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
OPTIONS_NFT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
CHAIN_ID=1
RPC_URL=http://localhost:8545
```

## 📋 API Endpoints

### POST `/api/orders`
Submit a signed option order.

**Request:**
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
Browse open orders with filtering.

**Query Parameters:**
- `status` - Filter by status (`open`, `filled`, `cancelled`, `expired`)
- `maker` - Filter by maker address
- `makerAsset` - Filter by maker asset
- `takerAsset` - Filter by taker asset
- `limit` - Limit results (default: 50, max: 100)

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

### POST `/api/orders/:orderHash/fill`
Generate pre-packed calldata for filling an order.

**Request:**
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

## 🔒 Security Features

### EIP-712 Signature Validation
- Validates LOP order signatures
- Validates OptionsNFT parameter signatures
- Chain ID and contract address verification
- Recovered address matching

### Input Validation
- Comprehensive request validation using Joi
- Address format validation
- Numeric value validation
- Required field validation

### Rate Limiting
- Configurable rate limiting
- Per-IP request limits
- Abuse prevention

### Security Headers
- Helmet.js security headers
- CORS protection
- SQL injection prevention

## 🔄 Integration with Builder Helpers

The backend seamlessly integrates with your existing builder helper functions:

```javascript
// Using builder helpers in the backend
const {
  buildCompleteCallOption,
  fillCallOption
} = require('../../scripts/helpers/orderBuilder');

// Generate fill calldata for options orders
const fillCalldata = await generateOptionsFillCalldata({
  orderData,
  taker,
  fillAmount,
  lopAddress
});
```

## 🧪 Testing

### Automated Tests
```bash
npm run test:relayer
```

### Manual Testing
```bash
# Health check
curl http://localhost:3000/health

# Submit order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{ ... }'

# Get orders
curl http://localhost:3000/api/orders?status=open&limit=10
```

### Integration Example
```bash
node backend/integration-example.js
```

## 📊 Database Schema

```sql
CREATE TABLE orders (
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
  status TEXT DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Docker (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📝 Monitoring

- Health check endpoint: `GET /health`
- Comprehensive logging
- Error tracking
- Performance metrics
- Database status monitoring

## 🎯 Next Steps

1. **Deploy contracts** and update environment variables
2. **Test with real signatures** using your builder helpers
3. **Integrate with frontend** for complete user experience
4. **Add monitoring** and alerting
5. **Scale database** for production use

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**🎉 Your Options Protocol Backend/Relayer is now ready!**

The backend provides all the requested functionality:
- ✅ Node.js backend with REST API
- ✅ `/orders` endpoint to accept signed option orders
- ✅ Store off-chain orders in DB
- ✅ Validate EIP-712 signature before accepting order
- ✅ Serve GET `/orders` endpoint for takers to browse open options
- ✅ Return pre-packed interaction calldata to frontend
- ✅ Use builder helper functions we already built

Start the server and begin testing with the provided examples! 
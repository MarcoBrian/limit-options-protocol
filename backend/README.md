# Options Protocol Relayer Backend

A Node.js backend service for the Options Protocol built on top of 1inch Limit Order Protocol. This relayer handles order storage, validation, and provides pre-packed calldata for order execution.

## Features

- **REST API** for order management
- **EIP-712 signature validation** for secure order submission
- **SQLite database** for off-chain order storage
- **Rate limiting** and security middleware
- **Integration** with existing builder helper functions
- **Pre-packed calldata generation** for frontend integration

## API Endpoints

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

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy the example environment file and configure your settings:
```bash
cp env.example .env
```

Edit `.env` with your configuration:
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

### 3. Create Data Directory
```bash
mkdir -p data
```

### 4. Start the Server
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `DATABASE_PATH` | SQLite database path | `./data/orders.db` |
| `CHAIN_ID` | Blockchain chain ID | `1` |
| `RPC_URL` | Ethereum RPC URL | `http://localhost:8545` |
| `LOP_ADDRESS` | LOP contract address | Required |
| `OPTIONS_NFT_ADDRESS` | OptionsNFT contract address | Required |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `900000` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `CORS_ORIGIN` | CORS origin | `*` |
| `LOG_LEVEL` | Logging level | `info` |

## Security Features

- **EIP-712 Signature Validation**: All orders must be properly signed
- **Rate Limiting**: Prevents abuse with configurable limits
- **Input Validation**: Comprehensive request validation using Joi
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet Security**: HTTP security headers
- **SQL Injection Protection**: Parameterized queries

## Database Schema

### Orders Table
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

## Integration with Builder Helpers

The relayer integrates with existing builder helper functions:

```javascript
// Using the builder helpers in the backend
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

### Health Check
```bash
curl http://localhost:3000/health
```

### Submit Order
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "order": { ... },
    "signature": { ... },
    "lopAddress": "0x..."
  }'
```

### Get Orders
```bash
curl http://localhost:3000/api/orders?status=open&limit=10
```

## Deployment

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

## Logs

The server provides comprehensive logging:
- Order submissions and validations
- Database operations
- Error tracking
- Performance metrics

## Monitoring

Monitor the relayer with:
- Health check endpoint: `GET /health`
- Database status in logs
- Rate limit headers in responses
- Error tracking in console

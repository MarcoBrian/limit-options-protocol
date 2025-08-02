# 1Option Frontend

A modern React frontend for 1option.

## Features

- **MetaMask Integration**: Connect wallet and sign transactions seamlessly
- **Maker Flow**: Create and sell options with comprehensive form-based interface
- **Taker Flow**: Browse and buy options with marketplace-style grid and filtering
- **Exerciser Flow**: View and exercise owned options with real-time status
- **Modern UI**: Built with Tailwind CSS and fully responsive design
- **Real-time Updates**: Automatic order refresh and status updates
- **Toast Notifications**: User-friendly feedback system for all actions
- **Asset Management**: Sophisticated asset configuration with underlying and strike assets
- **Advanced Order Management**: Full EIP-712 signature support and order building
- **Smart Contract Integration**: Direct integration with deployed contracts

## Tech Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling with custom design system
- **Ethers.js v6** for Web3 integration
- **Axios** for API communication with interceptors
- **React Context** for state management (Wallet, App, Toast)
- **Advanced Utilities**: Order building, filling, nonce management, and formatters

## Getting Started

### Prerequisites

- Node.js 16+ 
- MetaMask browser extension
- Backend server running (see backend README)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Configure environment variables:
```env
# API Configuration
REACT_APP_API_URL=http://localhost:3000

# Smart Contract Addresses (set after deployment)
REACT_APP_LOP_ADDRESS=0x...
REACT_APP_OPTIONS_NFT_ADDRESS=0x...
REACT_APP_DUMMY_TOKEN_ADDRESS=0x...
REACT_APP_MOCK_USDC_ADDRESS=0x...
REACT_APP_MOCK_ETH_ADDRESS=0x...

# Network Configuration
REACT_APP_CHAIN_ID=31337
REACT_APP_RPC_URL=http://localhost:8545
REACT_APP_NETWORK=localhost
```

### Development

Start the development server:
```bash
npm run frontend
```

The app will be available at `http://localhost:3001`

### Building for Production

```bash
npm run build
```

## Usage

### Connecting Wallet

1. Click "Connect Wallet" in the header
2. Approve MetaMask connection
3. Your wallet address will be displayed

### Creating Options (Maker)

1. Navigate to "Create Option" tab
2. Fill in the option parameters:
   - Underlying Asset Address
   - Strike Asset Address  
   - Strike Price
   - Option Amount
   - Premium
   - Expiry Date
3. Click "Create Option" to submit

### Browsing Options (Taker)

1. Navigate to "Browse Options" tab
2. View available options in the marketplace grid
3. Click "Buy Option" to purchase (requires wallet connection)

### Exercising Options

1. Navigate to "My Options" tab
2. View your owned options
3. Click "Exercise Option" to execute (if not expired)

## Project Structure

```
src/
├── components/          # React components
│   ├── Header.tsx      # Navigation and wallet connection
│   ├── MakerForm.tsx   # Option creation form with validation
│   ├── OrderGrid.tsx   # Marketplace grid with filtering
│   ├── MyOptions.tsx   # User's owned options management
│   ├── AssetSelector.tsx # Asset selection dropdown
│   └── Toast.tsx       # Notification toast component
├── contexts/            # React contexts
│   ├── WalletContext.tsx   # MetaMask integration and wallet state
│   ├── AppContext.tsx      # Application state management
│   └── ToastContext.tsx    # Toast notification system
├── config/              # Configuration files
│   ├── assets.ts       # Asset definitions (underlying/strike assets)
│   └── contracts.ts    # Smart contract addresses and network config
├── services/            # API services
│   └── api.ts          # Backend communication with interceptors
├── types/               # TypeScript definitions
│   └── index.ts        # Interface definitions for orders, assets, etc.
├── utils/               # Utility functions
│   ├── orderBuilder.ts # EIP-712 order building and signing
│   ├── orderFiller.ts  # Order filling logic
│   ├── optionsFetcher.ts # Options data fetching utilities
│   ├── nonceManager.ts # Nonce management for orders
│   └── formatters.ts   # Data formatting utilities
└── App.tsx             # Main application component
```

## API Integration

The frontend communicates with the backend via REST API:

- `GET /api/orders` - Fetch available options with optional filtering
  - Query parameters: `status`, `maker`, `makerAsset`, `takerAsset`, `limit`
- `POST /api/orders` - Submit new option order with full validation
- `GET /health` - Health check endpoint


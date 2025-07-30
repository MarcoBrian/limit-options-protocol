# Options Protocol Frontend

A modern React frontend for the Options Protocol built on top of 1inch Limit Order Protocol.

## Features

- **MetaMask Integration**: Connect wallet and sign transactions
- **Maker Flow**: Create and sell options with form-based interface
- **Taker Flow**: Browse and buy options with marketplace-style grid
- **Exerciser Flow**: View and exercise owned options
- **Modern UI**: Built with Tailwind CSS and responsive design
- **Real-time Updates**: Automatic order refresh and status updates

## Tech Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Ethers.js** for Web3 integration
- **Axios** for API communication
- **React Context** for state management

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
REACT_APP_API_URL=http://localhost:3000
```

### Development

Start the development server:
```bash
npm start
```

The app will be available at `http://localhost:3000`

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
│   ├── Header.tsx     # Navigation and wallet connection
│   ├── MakerForm.tsx  # Option creation form
│   ├── OrderGrid.tsx  # Marketplace grid
│   └── MyOptions.tsx  # User's owned options
├── contexts/           # React contexts
│   ├── WalletContext.tsx  # MetaMask integration
│   └── AppContext.tsx     # Application state
├── services/           # API services
│   └── api.ts         # Backend communication
├── types/              # TypeScript definitions
│   └── index.ts       # Interface definitions
└── App.tsx            # Main application component
```

## API Integration

The frontend communicates with the backend via REST API:

- `GET /api/orders` - Fetch available options
- `POST /api/orders` - Submit new option order
- `GET /health` - Health check

## Development Notes

- Mock data is used for some features (MyOptions component)
- EIP-712 signature generation needs to be implemented
- Smart contract integration for option exercise needs to be added
- Error handling and loading states are implemented
- Responsive design for desktop focus

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC

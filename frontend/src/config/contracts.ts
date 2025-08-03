// Contract addresses configuration
export interface ContractAddresses {
  lopAddress: string;
  optionsNFTAddress: string;
  dummyTokenAddress: string;
  mockUSDCAddress: string;
  mockETHAddress: string;
}

// Get contract addresses from environment variables
export const getContractAddresses = (): ContractAddresses => {
  // In development, these will be loaded from .env file
  // In production, these should be set as environment variables
  const addresses = {
    lopAddress: process.env.REACT_APP_LOP_ADDRESS || '',
    optionsNFTAddress: process.env.REACT_APP_OPTIONS_NFT_ADDRESS || '',
    dummyTokenAddress: process.env.REACT_APP_DUMMY_TOKEN_ADDRESS || '',
    mockUSDCAddress: process.env.REACT_APP_MOCK_USDC_ADDRESS || '',
    mockETHAddress: process.env.REACT_APP_MOCK_ETH_ADDRESS || '',
  };

  // Validate that all addresses are present
  const missingAddresses = Object.entries(addresses)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingAddresses.length > 0) {
    const networkConfig = getNetworkConfig();
    console.warn('⚠️ Missing contract addresses:', missingAddresses);
    
    if (networkConfig.chainId === 84532) {
      console.warn('Please deploy contracts first: npm run deploy:base-sepolia');
    } else {
      console.warn('Please run the deployment script first: npx hardhat run scripts/deploy.js --network localhost');
    }
  }

  return addresses;
};

// Validate contract addresses
export const validateContractAddresses = (addresses: ContractAddresses): boolean => {
  const requiredAddresses = [
    'lopAddress',
    'optionsNFTAddress', 
    'dummyTokenAddress',
    'mockUSDCAddress',
    'mockETHAddress'
  ];

  for (const addressKey of requiredAddresses) {
    const address = addresses[addressKey as keyof ContractAddresses];
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      console.error(`❌ Invalid or missing address for ${addressKey}:`, address);
      return false;
    }
  }

  return true;
};

// Get network configuration
export const getNetworkConfig = () => {
  const chainId = parseInt(process.env.REACT_APP_CHAIN_ID || '31337');
  
  return {
    chainId,
    rpcUrl: process.env.REACT_APP_RPC_URL || 'http://localhost:8545',
    networkName: process.env.REACT_APP_NETWORK || 'localhost'
  };
}; 
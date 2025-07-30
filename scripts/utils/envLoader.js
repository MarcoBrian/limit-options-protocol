const fs = require('fs');
const path = require('path');

/**
 * Load environment variables from .env file
 * @param {string} envPath - Path to .env file (default: project root)
 * @returns {Object} Environment variables
 */
function loadEnv(envPath = null) {
  const envFile = envPath || path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envFile)) {
    throw new Error(`Environment file not found: ${envFile}`);
  }

  const envContent = fs.readFileSync(envFile, 'utf8');
  const env = {};

  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return env;
}

/**
 * Load and validate contract addresses from .env file
 * @param {Object} options - Configuration options
 * @param {boolean} options.required - Whether to throw error if addresses are missing
 * @param {string} options.envPath - Path to .env file
 * @returns {Object} Contract addresses and configuration
 */
function loadContractAddresses(options = {}) {
  const { required = true, envPath = null } = options;
  
  try {
    const env = loadEnv(envPath);
    
    const addresses = {
      // Core contracts
      lopAddress: env.LOP_ADDRESS,
      optionsNFTAddress: env.OPTIONS_NFT_ADDRESS,
      
      // Token addresses
      mockETHAddress: env.MOCK_ETH_ADDRESS,
      mockUSDCAddress: env.MOCK_USDC_ADDRESS,
      wethAddress: env.WETH_ADDRESS,
      dummyTokenAddress: env.DUMMY_TOKEN_ADDRESS,
      
      // Network configuration
      chainId: parseInt(env.CHAIN_ID || '31337'),
      rpcUrl: env.RPC_URL || 'http://localhost:8545',
      
      // Backend configuration
      backendUrl: env.BACKEND_URL || 'http://localhost:3000',
      port: parseInt(env.PORT || '3000'),
      
      // Database configuration
      databasePath: env.DATABASE_PATH || './data/orders.db',
      
      // Security configuration
      rateLimitWindow: parseInt(env.RATE_LIMIT_WINDOW_MS || '900000'),
      rateLimitMax: parseInt(env.RATE_LIMIT_MAX || '100'),
      
      // Logging configuration
      logLevel: env.LOG_LEVEL || 'info',
      enableConsoleLog: env.ENABLE_CONSOLE_LOG !== 'false',
      enableFileLog: env.ENABLE_FILE_LOG === 'true'
    };

    // Validate required addresses if required is true
    if (required) {
      const missingAddresses = [];
      
      if (!addresses.lopAddress) missingAddresses.push('LOP_ADDRESS');
      if (!addresses.optionsNFTAddress) missingAddresses.push('OPTIONS_NFT_ADDRESS');
      if (!addresses.mockETHAddress) missingAddresses.push('MOCK_ETH_ADDRESS');
      if (!addresses.mockUSDCAddress) missingAddresses.push('MOCK_USDC_ADDRESS');
      
      if (missingAddresses.length > 0) {
        throw new Error(`Missing required contract addresses in .env file: ${missingAddresses.join(', ')}`);
      }
    }

    return addresses;
  } catch (error) {
    if (required) {
      throw error;
    }
    console.warn('⚠️  Warning: Could not load contract addresses from .env file:', error.message);
    return {};
  }
}

/**
 * Validate that addresses are valid Ethereum addresses
 * @param {Object} addresses - Contract addresses object
 * @returns {Object} Validation result
 */
function validateAddresses(addresses) {
  const errors = [];
  const warnings = [];
  
  // Ethereum address regex
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  
  Object.entries(addresses).forEach(([key, value]) => {
    if (key.includes('Address') && value) {
      if (!addressRegex.test(value)) {
        errors.push(`${key}: Invalid Ethereum address format`);
      }
    }
  });

  // Check for duplicate addresses
  const addressValues = Object.values(addresses).filter(v => v && addressRegex.test(v));
  const uniqueAddresses = new Set(addressValues);
  
  if (addressValues.length !== uniqueAddresses.size) {
    warnings.push('Duplicate contract addresses detected');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Print contract addresses in a formatted way
 * @param {Object} addresses - Contract addresses object
 * @param {boolean} showValidation - Whether to show validation results
 */
function printAddresses(addresses, showValidation = true) {
  console.log('\n📋 Contract Addresses from .env:');
  console.log('=====================================');
  
  Object.entries(addresses).forEach(([key, value]) => {
    if (key.includes('Address') && value) {
      console.log(`   ${key}: ${value}`);
    }
  });
  
  console.log('\n⚙️  Configuration:');
  console.log('==================');
  console.log(`   Chain ID: ${addresses.chainId}`);
  console.log(`   RPC URL: ${addresses.rpcUrl}`);
  console.log(`   Backend URL: ${addresses.backendUrl}`);
  console.log(`   Port: ${addresses.port}`);
  
  if (showValidation) {
    const validation = validateAddresses(addresses);
    
    if (validation.errors.length > 0) {
      console.log('\n❌ Validation Errors:');
      validation.errors.forEach(error => console.log(`   ${error}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Validation Warnings:');
      validation.warnings.forEach(warning => console.log(`   ${warning}`));
    }
    
    if (validation.isValid && validation.warnings.length === 0) {
      console.log('\n✅ All addresses are valid!');
    }
  }
}

/**
 * Get contract addresses for a specific network
 * @param {string} network - Network name (localhost, mainnet, etc.)
 * @returns {Object} Contract addresses for the network
 */
function getNetworkAddresses(network = 'localhost') {
  const addresses = loadContractAddresses({ required: false });
  
  // Network-specific overrides
  const networkOverrides = {
    localhost: {
      chainId: 31337,
      rpcUrl: 'http://localhost:8545'
    },
    mainnet: {
      chainId: 1,
      rpcUrl: process.env.MAINNET_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/your-api-key'
    },
    sepolia: {
      chainId: 11155111,
      rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.alchemyapi.io/v2/your-api-key'
    }
  };
  
  const networkConfig = networkOverrides[network] || networkOverrides.localhost;
  
  return {
    ...addresses,
    ...networkConfig
  };
}

/**
 * Create a sample .env file with placeholder values
 * @param {string} outputPath - Path to save the sample .env file
 */
function createSampleEnv(outputPath = '.env.example') {
  const sampleEnv = `# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DATABASE_PATH=./data/orders.db

# Blockchain Configuration
CHAIN_ID=31337
RPC_URL=http://localhost:8545
LOP_ADDRESS=0x0000000000000000000000000000000000000000
OPTIONS_NFT_ADDRESS=0x0000000000000000000000000000000000000000

# Contract Addresses (for contract loader)
MOCK_ETH_ADDRESS=0x0000000000000000000000000000000000000000
MOCK_USDC_ADDRESS=0x0000000000000000000000000000000000000000
DUMMY_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000
WETH_ADDRESS=0x0000000000000000000000000000000000000000

# Security Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
CORS_ORIGIN=*

# Logging Configuration
LOG_LEVEL=info
ENABLE_CONSOLE_LOG=true
ENABLE_FILE_LOG=false

# Backend Configuration
BACKEND_URL=http://localhost:3000
`;

  fs.writeFileSync(outputPath, sampleEnv);
  console.log(`✅ Sample .env file created: ${outputPath}`);
}

module.exports = {
  loadEnv,
  loadContractAddresses,
  validateAddresses,
  printAddresses,
  getNetworkAddresses,
  createSampleEnv
}; 
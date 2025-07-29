require('dotenv').config();

const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database configuration
  database: {
    path: process.env.DATABASE_PATH || './data/orders.db'
  },
  
  // Blockchain configuration
  blockchain: {
    chainId: parseInt(process.env.CHAIN_ID) || 1,
    rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
    lopAddress: process.env.LOP_ADDRESS || '',
    optionsNFTAddress: process.env.OPTIONS_NFT_ADDRESS || ''
  },
  
  // Security configuration
  security: {
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    corsOrigin: process.env.CORS_ORIGIN || '*'
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.ENABLE_CONSOLE_LOG !== 'false',
    enableFile: process.env.ENABLE_FILE_LOG === 'true'
  }
};

// Validate required environment variables
const requiredEnvVars = [
  'LOP_ADDRESS',
  'OPTIONS_NFT_ADDRESS'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0 && config.nodeEnv === 'production') {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

module.exports = config; 
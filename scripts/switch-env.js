#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Setup frontend environment based on current .env
 */
function setupFrontendEnv() {
  try {
    const rootEnvPath = '.env';
    const frontendEnvPath = path.join('frontend', '.env');
    
    // Read the root .env file
    const rootEnvContent = fs.readFileSync(rootEnvPath, 'utf8');
    
    // Parse the .env file
    const envVars = {};
    rootEnvContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          envVars[key] = valueParts.join('=');
        }
      }
    });

    // Create frontend .env content with REACT_APP_ prefix
    const frontendEnvContent = `# Frontend Environment Variables
# Contract addresses from root .env file
# Generated automatically by switch-env.js

REACT_APP_LOP_ADDRESS=${envVars.LOP_ADDRESS || ''}
REACT_APP_OPTIONS_NFT_ADDRESS=${envVars.OPTIONS_NFT_ADDRESS || ''}
REACT_APP_DUMMY_TOKEN_ADDRESS=${envVars.DUMMY_TOKEN_ADDRESS || ''}
REACT_APP_MOCK_USDC_ADDRESS=${envVars.MOCK_USDC_ADDRESS || ''}
REACT_APP_MOCK_ETH_ADDRESS=${envVars.MOCK_ETH_ADDRESS || ''}

# Network Configuration
REACT_APP_CHAIN_ID=${envVars.CHAIN_ID || '31337'}
REACT_APP_RPC_URL=${envVars.RPC_URL || 'http://localhost:8545'}
REACT_APP_NETWORK=${envVars.NETWORK || 'localhost'}

# Backend API URL
REACT_APP_API_URL=http://localhost:3000
`;

    // Write to frontend .env file
    fs.writeFileSync(frontendEnvPath, frontendEnvContent);
  } catch (error) {
    console.log(`⚠️  Could not update frontend .env: ${error.message}`);
  }
}

/**
 * Simple environment switcher
 * Copies template files to active .env
 */
function switchEnvironment() {
  const mode = process.argv[2];
  
  console.log('🔄 Environment Switcher\n');
  
  if (!mode || !['hardhat', 'base-sepolia'].includes(mode)) {
    showHelp();
    return;
  }
  
  const templateFile = `.env.${mode}`;
  const activeFile = '.env';
  
  // Check if template exists
  if (!fs.existsSync(templateFile)) {
    console.log(`❌ Template file ${templateFile} not found!`);
    console.log('Available templates:');
    console.log('  .env.hardhat - Local development with Hardhat');
    console.log('  .env.base-sepolia - Base Sepolia testnet');
    return;
  }
  
  // Backup current .env if it exists and has content
  if (fs.existsSync(activeFile)) {
    const currentContent = fs.readFileSync(activeFile, 'utf8');
    if (currentContent.trim() && !currentContent.includes('automatically managed by switch scripts')) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `.env.backup.${timestamp}`;
      fs.copyFileSync(activeFile, backupFile);
      console.log(`📦 Backed up current .env to ${backupFile}`);
    }
  }
  
  // Copy template to active .env (this will load network-specific contract addresses)
  fs.copyFileSync(templateFile, activeFile);
  
  // Check if template has contract addresses
  const templateContent = fs.readFileSync(activeFile, 'utf8');
  const contractKeys = ['LOP_ADDRESS', 'OPTIONS_NFT_ADDRESS', 'DUMMY_TOKEN_ADDRESS', 'MOCK_USDC_ADDRESS', 'MOCK_ETH_ADDRESS'];
  const foundAddresses = [];
  
  templateContent.split('\n').forEach(line => {
    const [key, value] = line.split('=', 2);
    if (key && contractKeys.includes(key.trim()) && value && value.trim() !== '') {
      foundAddresses.push(key.trim());
    }
  });
  
  if (foundAddresses.length > 0) {
    console.log(`📋 Loaded ${foundAddresses.length} contract addresses from ${templateFile}`);
  }
  
  // Also setup frontend environment
  setupFrontendEnv();
  
  // Show success message with current configuration
  console.log(`✅ Switched to ${mode} configuration (frontend also updated)\n`);
  
  // Read and display key settings
  const envContent = fs.readFileSync(activeFile, 'utf8');
  const lines = envContent.split('\n');
  
  console.log('📋 Active Configuration:');
  const importantVars = ['NETWORK', 'CHAIN_ID', 'RPC_URL', 'PRIVATE_KEY'];
  
  importantVars.forEach(varName => {
    const line = lines.find(l => l.startsWith(`${varName}=`));
    if (line) {
      let [key, value] = line.split('=', 2);
      
      // Hide private key for security
      if (key === 'PRIVATE_KEY' && value && value !== 'your_private_key_here' && value.length > 10) {
        value = value.substring(0, 6) + '...' + value.substring(value.length - 4);
      }
      
      console.log(`   ${key}: ${value}`);
    }
  });
  
  console.log('\n🚀 Next Steps:');
  if (mode === 'hardhat') {
    console.log('   1. npm run hardhat-start    # Start local Hardhat node');
    console.log('   2. npm run deploy           # Deploy contracts locally');
    console.log('   3. npm run setup:demo       # Setup demo data');
  } else if (mode === 'base-sepolia') {
    console.log('   1. Edit .env.base-sepolia to add your private keys');
    console.log('   2. npm run deploy:base-sepolia  # Deploy to testnet');
    console.log('   3. Fund your accounts at: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet');
  }
}

function showHelp() {
  console.log('🎯 Environment Switcher - Simple 3-file system');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/switch-env.js [mode]');
  console.log('');
  console.log('Modes:');
  console.log('  hardhat      Switch to local Hardhat development');
  console.log('  base-sepolia Switch to Base Sepolia testnet');
  console.log('');
  console.log('Files:');
  console.log('  .env              ← Active configuration (auto-managed)');
  console.log('  .env.hardhat      ← Hardhat template');
  console.log('  .env.base-sepolia ← Base Sepolia template');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/switch-env.js hardhat       # Local development');
  console.log('  node scripts/switch-env.js base-sepolia  # Testnet deployment');
}

switchEnvironment();
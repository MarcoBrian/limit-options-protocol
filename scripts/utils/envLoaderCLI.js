#!/usr/bin/env node

const { 
  loadContractAddresses, 
  validateAddresses, 
  printAddresses, 
  getNetworkAddresses, 
  createSampleEnv 
} = require('./envLoader');

/**
 * CLI script to manage environment variables and contract addresses
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log('🔧 Environment Loader CLI');
    console.log('==========================');
    console.log('');
    console.log('Usage: node scripts/utils/envLoaderCLI.js <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  show        - Show all contract addresses and configuration');
    console.log('  validate    - Validate contract addresses');
    console.log('  network     - Show addresses for specific network');
    console.log('  sample      - Create sample .env file');
    console.log('  help        - Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/utils/envLoaderCLI.js show');
    console.log('  node scripts/utils/envLoaderCLI.js validate');
    console.log('  node scripts/utils/envLoaderCLI.js network localhost');
    console.log('  node scripts/utils/envLoaderCLI.js sample');
    return;
  }

  try {
    switch (command) {
      case 'show':
        await showAddresses();
        break;
      
      case 'validate':
        await validateAddressesCommand();
        break;
      
      case 'network':
        const network = args[1] || 'localhost';
        await showNetworkAddresses(network);
        break;
      
      case 'sample':
        const outputPath = args[1] || '.env.example';
        createSampleEnv(outputPath);
        break;
      
      case 'help':
        console.log('🔧 Environment Loader CLI Help');
        console.log('==============================');
        console.log('');
        console.log('This utility helps manage contract addresses and configuration from .env files.');
        console.log('');
        console.log('Commands:');
        console.log('  show        - Display all contract addresses and configuration');
        console.log('  validate    - Validate Ethereum address format and check for duplicates');
        console.log('  network     - Show addresses for a specific network (localhost, mainnet, sepolia)');
        console.log('  sample      - Create a sample .env file with placeholder values');
        console.log('  help        - Show this help message');
        break;
      
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Run "node scripts/utils/envLoaderCLI.js help" for usage information.');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

/**
 * Show all contract addresses and configuration
 */
async function showAddresses() {
  console.log('🔍 Loading contract addresses from .env file...');
  
  try {
    const addresses = loadContractAddresses({ required: false });
    printAddresses(addresses, true);
  } catch (error) {
    console.error('❌ Failed to load addresses:', error.message);
    console.log('');
    console.log('💡 Try running: node scripts/utils/envLoaderCLI.js sample');
    console.log('   This will create a sample .env file with placeholder values.');
  }
}

/**
 * Validate contract addresses
 */
async function validateAddressesCommand() {
  console.log('🔍 Validating contract addresses...');
  
  try {
    const addresses = loadContractAddresses({ required: false });
    const validation = validateAddresses(addresses);
    
    console.log('\n📋 Validation Results:');
    console.log('======================');
    
    if (validation.isValid) {
      console.log('✅ All addresses are valid!');
    } else {
      console.log('❌ Validation failed:');
      validation.errors.forEach(error => console.log(`   ${error}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      validation.warnings.forEach(warning => console.log(`   ${warning}`));
    }
    
    // Show address count
    const addressCount = Object.values(addresses).filter(v => v && /^0x[a-fA-F0-9]{40}$/.test(v)).length;
    console.log(`\n📊 Found ${addressCount} valid contract addresses`);
    
  } catch (error) {
    console.error('❌ Failed to validate addresses:', error.message);
  }
}

/**
 * Show addresses for a specific network
 */
async function showNetworkAddresses(network) {
  console.log(`🔍 Loading addresses for network: ${network}`);
  
  try {
    const addresses = getNetworkAddresses(network);
    
    console.log(`\n🌐 Network Configuration (${network}):`);
    console.log('=====================================');
    console.log(`   Chain ID: ${addresses.chainId}`);
    console.log(`   RPC URL: ${addresses.rpcUrl}`);
    console.log(`   Backend URL: ${addresses.backendUrl}`);
    
    console.log('\n📋 Contract Addresses:');
    console.log('=======================');
    
    Object.entries(addresses).forEach(([key, value]) => {
      if (key.includes('Address') && value) {
        console.log(`   ${key}: ${value}`);
      }
    });
    
    // Validate addresses for this network
    const validation = validateAddresses(addresses);
    if (!validation.isValid) {
      console.log('\n⚠️  Some addresses may be invalid for this network');
    }
    
  } catch (error) {
    console.error(`❌ Failed to load addresses for network ${network}:`, error.message);
  }
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  main,
  showAddresses,
  validateAddressesCommand,
  showNetworkAddresses
}; 
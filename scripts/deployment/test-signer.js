const hre = require('hardhat');
require('dotenv').config();

async function testSignerSetup() {
  console.log('🧪 Testing Signer Configuration...\n');

  // Check environment
  console.log('📋 Environment Check:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`   PRIVATE_KEY: ${process.env.PRIVATE_KEY ? '✅ Set (64 chars)' : '❌ Not set'}`);
  
  if (!process.env.PRIVATE_KEY) {
    console.error('\n❌ PRIVATE_KEY not found in .env file');
    console.log('Add your private key to .env:');
    console.log('PRIVATE_KEY=0x1234567890abcdef...');
    process.exit(1);
  }

  // Test your wallet
  console.log('\n🔑 Your Wallet:');
  const yourWallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY);
  console.log(`   Address: ${yourWallet.address}`);

  // Test available networks
  const networks = Object.keys(hre.config.networks);
  console.log(`\n🌐 Available Networks: ${networks.join(', ')}`);
  console.log(`   Current Network: ${hre.network.name}`);

  // Test current network's signer
  console.log(`\n🔍 Testing Current Network (${hre.network.name}):`);
  try {
    const signers = await hre.ethers.getSigners();
    console.log(`   Available signers: ${signers.length}`);
    
    if (signers.length > 0) {
      const firstSigner = signers[0];
      console.log(`   First signer: ${firstSigner.address}`);
      
      // Check if it matches your wallet
      if (firstSigner.address.toLowerCase() === yourWallet.address.toLowerCase()) {
        console.log('   ✅ Matches your private key - PERFECT!');
      } else {
        console.log('   ⚠️  Different from your private key');
        if (hre.network.name === 'base-sepolia') {
          console.log('   🚨 This might be a problem for deployment!');
        } else if (hre.network.name === 'localhost' || hre.network.name === 'hardhat') {
          console.log('   ℹ️  This is normal for local networks (uses hardhat accounts)');
        }
      }
    } else {
      console.log('   ❌ No signers available');
    }
    
  } catch (error) {
    console.log(`   ❌ Error getting signers: ${error.message}`);
  }

  // Check network configurations
  console.log('\n⚙️  Network Configurations:');
  
  // Check Base Sepolia config
  if (hre.config.networks['base-sepolia']) {
    const baseSepoliaConfig = hre.config.networks['base-sepolia'];
    console.log('   base-sepolia:');
    console.log(`     URL: ${baseSepoliaConfig.url}`);
    console.log(`     Chain ID: ${baseSepoliaConfig.chainId}`);
    console.log(`     Accounts: ${baseSepoliaConfig.accounts ? baseSepoliaConfig.accounts.length : 0} configured`);
    
    if (baseSepoliaConfig.accounts && baseSepoliaConfig.accounts.length > 0) {
      // Check if first account matches your private key
      const firstAccount = baseSepoliaConfig.accounts[0];
      if (firstAccount === process.env.PRIVATE_KEY) {
        console.log('     ✅ First account is your PRIVATE_KEY');
      } else {
        console.log('     ❌ First account is NOT your PRIVATE_KEY');
        console.log('     🔧 Fix: Check hardhat.config.js base-sepolia accounts array');
      }
    } else {
      console.log('     ❌ No accounts configured for base-sepolia!');
    }
  } else {
    console.log('   ❌ base-sepolia network not found in hardhat.config.js');
  }

  // Check localhost config  
  if (hre.config.networks['localhost']) {
    const localhostConfig = hre.config.networks['localhost'];
    console.log('   localhost:');
    console.log(`     URL: ${localhostConfig.url}`);
    console.log(`     Chain ID: ${localhostConfig.chainId}`);
    console.log('     ℹ️  Uses Hardhat default accounts (20 test accounts)');
  }

  console.log('\n🎯 Summary:');
  console.log('For deployment to work correctly:');
  console.log('1. ✅ Your private key should be in .env');
  console.log('2. ✅ hardhat.config.js base-sepolia should use [process.env.PRIVATE_KEY]');
  console.log('3. ✅ When deploying to base-sepolia, it will use your account');
  console.log('4. ✅ When deploying to localhost, it will use Hardhat test accounts');
  
  console.log('\n🚀 To test base-sepolia specifically:');
  console.log('   npx hardhat run scripts/deploy-production.js --network base-sepolia');
  console.log('\n🏠 To test localhost:');
  console.log('   npx hardhat run scripts/deploy.js --network localhost');
}

testSignerSetup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
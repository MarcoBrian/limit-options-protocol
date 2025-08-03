const { ethers } = require('ethers');
require('dotenv').config();

async function checkDeployerSetup() {
  console.log('🔍 Checking Deployer Configuration...\n');

  // Check if private key is set
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not found in .env file');
    console.log('\n📋 To fix this:');
    console.log('1. Edit your .env file');
    console.log('2. Add: PRIVATE_KEY=0x1234...(your 64-character private key)');
    console.log('3. Make sure the private key starts with 0x');
    process.exit(1);
  }

  console.log('✅ PRIVATE_KEY found in environment');

  // Validate private key format
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
    console.error('❌ Invalid private key format');
    console.log('Private key should:');
    console.log('- Start with 0x');
    console.log('- Be exactly 66 characters long (0x + 64 hex chars)');
    console.log(`- Current length: ${privateKey.length}`);
    process.exit(1);
  }

  console.log('✅ Private key format is valid');

  // Get wallet from private key
  let wallet;
  try {
    wallet = new ethers.Wallet(privateKey);
    console.log('✅ Private key can create valid wallet');
  } catch (error) {
    console.error('❌ Invalid private key:', error.message);
    process.exit(1);
  }

  console.log(`🔑 Deployer Address: ${wallet.address}`);

  // Check balance on Base Sepolia
  console.log('\n💰 Checking Balance on Base Sepolia...');
  try {
    const provider = new ethers.JsonRpcProvider(
      process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
    );
    
    const balance = await provider.getBalance(wallet.address);
    const balanceETH = ethers.formatEther(balance);
    
    console.log(`   Balance: ${balanceETH} ETH`);
    
    if (parseFloat(balanceETH) < 0.001) {
      console.log('⚠️  Low balance for deployment');
      console.log('📋 Get more testnet ETH:');
      console.log('   1. Visit: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet');
      console.log(`   2. Enter your address: ${wallet.address}`);
      console.log('   3. Claim free testnet ETH');
    } else {
      console.log('✅ Sufficient balance for deployment');
    }

    // Check latest block to verify RPC connection
    const blockNumber = await provider.getBlockNumber();
    console.log(`   Latest Block: ${blockNumber}`);
    console.log('✅ RPC connection working');

  } catch (error) {
    console.error('❌ Error checking balance:', error.message);
    console.log('This might be a temporary network issue');
  }

  // Show what will happen during deployment
  console.log('\n🚀 Deployment Preview:');
  console.log(`   Network: Base Sepolia (Chain ID: 84532)`);
  console.log(`   Deployer: ${wallet.address}`);
  console.log(`   RPC: ${process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'}`);
  
  console.log('\n✅ Ready for deployment!');
  console.log('Run: npm run deploy:base-sepolia');
}

checkDeployerSetup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Setup check failed:', error);
    process.exit(1);
  });
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function updateEnvFile(addresses, network) {
  const envPath = path.join(__dirname, '..', '.env');
  
  // Read existing .env file if it exists
  let envContent = '';
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch (error) {
    console.error('❌ .env file not found. Please copy .env.example to .env and configure it.');
    process.exit(1);
  }

  // Split into lines and create a map of existing variables
  const lines = envContent.split('\n');
  const envVars = new Map();
  
  lines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && key.trim() && !key.trim().startsWith('#')) {
      envVars.set(key.trim(), valueParts.join('='));
    }
  });

  // Update with new contract addresses
  envVars.set('LOP_ADDRESS', addresses.limitOrderProtocol);
  envVars.set('OPTIONS_NFT_ADDRESS', addresses.optionNFT);
  envVars.set('MOCK_USDC_ADDRESS', addresses.mockUSDC || '');
  envVars.set('MOCK_ETH_ADDRESS', addresses.mockETH || '');
  envVars.set('DUMMY_TOKEN_ADDRESS', addresses.dummyToken || '');
  envVars.set('NETWORK', network);

  // Write back to .env file, preserving comments and structure
  const newLines = lines.map(line => {
    if (line.trim().startsWith('#') || !line.includes('=')) {
      return line; // Keep comments and empty lines
    }
    
    const [key] = line.split('=');
    const trimmedKey = key.trim();
    if (envVars.has(trimmedKey)) {
      return `${trimmedKey}=${envVars.get(trimmedKey)}`;
    }
    return line;
  });

  fs.writeFileSync(envPath, newLines.join('\n'));
  console.log('✅ Updated .env file with new contract addresses');
}

async function deployToNetwork(network) {
  console.log(`🚀 Deploying Options Protocol Contracts to ${network}...\n`);

  // Verify private key is set
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not found in environment variables');
    console.error('Please set PRIVATE_KEY in your .env file');
    process.exit(1);
  }

  console.log('🔑 Deployer Configuration:');
  
  // Show what private key we're expecting to use
  const expectedWallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY);
  console.log(`   Your Account Address: ${expectedWallet.address}`);
  console.log(`   Network: ${network}`);
  
  // Get the signer that Hardhat will use for this network
  const [deployer] = await hre.ethers.getSigners();
  console.log(`   Hardhat Signer Address: ${deployer.address}`);
  
  // For Base Sepolia, these should match because hardhat.config.js uses your PRIVATE_KEY
  if (network === 'base-sepolia') {
    if (deployer.address.toLowerCase() === expectedWallet.address.toLowerCase()) {
      console.log('✅ Perfect! Hardhat is using your private key for deployment');
    } else {
      console.error('❌ ERROR: Hardhat signer does not match your private key!');
      console.error('This means hardhat.config.js is not properly configured.');
      console.error('Check that base-sepolia network uses process.env.PRIVATE_KEY');
      process.exit(1);
    }
  } else {
    console.log(`ℹ️  Using Hardhat's default signer for ${network} network`);
  }
  console.log('Deploying contracts with account:', deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', hre.ethers.formatEther(balance), 'ETH');

  // Check if we have sufficient balance for deployment
  const minBalance = hre.ethers.parseEther('0.001'); // Minimum 0.001 ETH for testnet
  if (balance < minBalance) {
    console.error('❌ Insufficient balance for deployment. Need at least 0.001 ETH');
    process.exit(1);
  }

  const addresses = {};

  if (network === 'localhost') {
    // Deploy mock tokens for local testing
    console.log('\n📦 Deploying MockERC20 tokens...');
    const MockERC20 = await hre.ethers.getContractFactory('MockERC20');
    
    const mockUSDC = await MockERC20.deploy('Mock USDC', 'USDC', 6);
    await mockUSDC.waitForDeployment();
    addresses.mockUSDC = await mockUSDC.getAddress();
    console.log('✅ MockUSDC deployed to:', addresses.mockUSDC);

    const mockETH = await MockERC20.deploy('Mock ETH', 'ETH', 18);
    await mockETH.waitForDeployment();
    addresses.mockETH = await mockETH.getAddress();
    console.log('✅ MockETH deployed to:', addresses.mockETH);

    // Deploy DummyOptionToken
    console.log('\n📦 Deploying DummyOptionToken...');
    const DummyOptionToken = await hre.ethers.getContractFactory('DummyOptionToken');
    const dummyToken = await DummyOptionToken.deploy();
    await dummyToken.waitForDeployment();
    addresses.dummyToken = await dummyToken.getAddress();
    console.log('✅ DummyOptionToken deployed to:', addresses.dummyToken);
  } else if (network === 'base-sepolia') {
    // For Base Sepolia testnet, deploy mock tokens for testing
    console.log('\n📦 Deploying test tokens for Base Sepolia...');
    const MockERC20 = await hre.ethers.getContractFactory('MockERC20');
    
    const mockUSDC = await MockERC20.deploy('Test USDC', 'USDC', 6);
    await mockUSDC.waitForDeployment();
    addresses.mockUSDC = await mockUSDC.getAddress();
    console.log('✅ Test USDC deployed to:', addresses.mockUSDC);

    const mockETH = await MockERC20.deploy('Test WETH', 'WETH', 18);
    await mockETH.waitForDeployment();
    addresses.mockETH = await mockETH.getAddress();
    console.log('✅ Test WETH deployed to:', addresses.mockETH);

    // Deploy DummyOptionToken
    console.log('\n📦 Deploying DummyOptionToken...');
    const DummyOptionToken = await hre.ethers.getContractFactory('DummyOptionToken');
    const dummyToken = await DummyOptionToken.deploy();
    await dummyToken.waitForDeployment();
    addresses.dummyToken = await dummyToken.getAddress();
    console.log('✅ DummyOptionToken deployed to:', addresses.dummyToken);
  } else {
    console.error(`❌ Unsupported network: ${network}`);
    process.exit(1);
  }

  // Deploy LimitOrderProtocol
  console.log('\n📦 Deploying LimitOrderProtocol...');
  const LimitOrderProtocol = await hre.ethers.getContractFactory('LimitOrderProtocol');
  const limitOrderProtocol = await LimitOrderProtocol.deploy(addresses.mockETH);
  await limitOrderProtocol.waitForDeployment();
  addresses.limitOrderProtocol = await limitOrderProtocol.getAddress();
  console.log('✅ LimitOrderProtocol deployed to:', addresses.limitOrderProtocol);

  // Deploy OptionNFT
  console.log('\n📦 Deploying OptionNFT...');
  const OptionNFT = await hre.ethers.getContractFactory('OptionNFT');
  const optionNFT = await OptionNFT.deploy(addresses.limitOrderProtocol);
  await optionNFT.waitForDeployment();
  addresses.optionNFT = await optionNFT.getAddress();
  console.log('✅ OptionNFT deployed to:', addresses.optionNFT);

  console.log('\n🎉 Deployment Complete!');
  console.log('\n📋 Contract Addresses:');
  Object.entries(addresses).forEach(([key, address]) => {
    console.log(`${key}: ${address}`);
  });

  // Update .env file with new addresses
  console.log('\n📝 Updating .env file...');
  await updateEnvFile(addresses, network);

  console.log('\n📋 Next Steps:');
  console.log('1. Run: npm run setup:production-env');
  console.log('2. Test the deployment on Base Sepolia');
  console.log('3. Build frontend: npm run build:frontend');
  console.log('4. Start backend: npm start');

  return addresses;
}

async function main() {
  const network = hre.network.name;
  
  if (network === 'localhost') {
    console.log('⚠️  Deploying to localhost. For testnet deployment, use: --network base-sepolia');
  } else if (network === 'base-sepolia') {
    console.log(`🌐 Deploying to ${network} testnet`);
  } else {
    console.error(`❌ Unsupported network: ${network}`);
    console.error('Supported networks: localhost, base-sepolia');
    process.exit(1);
  }

  await deployToNetwork(network);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
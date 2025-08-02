const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function updateEnvFile(addresses) {
  const envPath = path.join(__dirname, '..', '.env');
  
  // Read existing .env file if it exists
  let envContent = '';
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch (error) {
    // File doesn't exist, start with empty content
    envContent = '';
  }

  // Split into lines and create a map of existing variables
  const lines = envContent.split('\n').filter(line => line.trim() !== '');
  const envVars = new Map();
  
  lines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars.set(key.trim(), valueParts.join('=').trim());
    }
  });

  // Update with new contract addresses
  envVars.set('LOP_ADDRESS', addresses.limitOrderProtocol);
  envVars.set('OPTIONS_NFT_ADDRESS', addresses.optionNFT);
  envVars.set('MOCK_USDC_ADDRESS', addresses.mockUSDC);
  envVars.set('MOCK_ETH_ADDRESS', addresses.mockETH);
  envVars.set('DUMMY_TOKEN_ADDRESS', addresses.dummyToken);
  envVars.set('NETWORK', 'localhost');
  envVars.set('RPC_URL', 'http://localhost:8545');
  envVars.set('PORT', '3000');
  envVars.set('NODE_ENV', 'development');

  // Write back to .env file
  const newEnvContent = Array.from(envVars.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('\n') + '\n';

  fs.writeFileSync(envPath, newEnvContent);
  console.log('✅ Updated .env file with new contract addresses');
}

async function main() {
  console.log('🚀 Deploying Options Protocol Contracts...\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);
  console.log('Account balance:', (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy MockERC20 tokens for testing
  console.log('\n📦 Deploying MockERC20 tokens...');
  const MockERC20 = await hre.ethers.getContractFactory('MockERC20');
  
  const mockUSDC = await MockERC20.deploy('Mock USDC', 'USDC', 6);
  await mockUSDC.waitForDeployment();
  console.log('✅ MockUSDC deployed to:', await mockUSDC.getAddress());

  const mockETH = await MockERC20.deploy('Mock ETH', 'ETH', 18);
  await mockETH.waitForDeployment();
  console.log('✅ MockETH deployed to:', await mockETH.getAddress());

  // Deploy DummyOptionToken
  console.log('\n📦 Deploying DummyOptionToken...');
  const DummyOptionToken = await hre.ethers.getContractFactory('DummyOptionToken');
  const dummyToken = await DummyOptionToken.deploy();
  await dummyToken.waitForDeployment();
  console.log('✅ DummyOptionToken deployed to:', await dummyToken.getAddress());

  // Deploy LimitOrderProtocol first (needed for OptionNFT)
  console.log('\n📦 Deploying LimitOrderProtocol...');
  const LimitOrderProtocol = await hre.ethers.getContractFactory('LimitOrderProtocol');
  const limitOrderProtocol = await LimitOrderProtocol.deploy(await mockETH.getAddress()); // Use mockETH as WETH
  await limitOrderProtocol.waitForDeployment();
  console.log('✅ LimitOrderProtocol deployed to:', await limitOrderProtocol.getAddress());

  // Deploy OptionNFT
  console.log('\n📦 Deploying OptionNFT...');
  const OptionNFT = await hre.ethers.getContractFactory('OptionNFT');
  const optionNFT = await OptionNFT.deploy(await limitOrderProtocol.getAddress());
  await optionNFT.waitForDeployment();
  console.log('✅ OptionNFT deployed to:', await optionNFT.getAddress());

  // Mint some tokens to deployer for testing
  console.log('\n💰 Minting tokens to deployer...');
  await mockUSDC.mint(deployer.address, hre.ethers.parseUnits('10000', 6)); // 10,000 USDC
  await mockETH.mint(deployer.address, hre.ethers.parseEther('100')); // 100 ETH
  await dummyToken.mint(deployer.address, hre.ethers.parseEther('1000')); // 1,000 dummy tokens
  console.log('✅ Tokens minted to deployer');

  // Setup dummy tokens for maker
  console.log('\n🔧 Setting up dummy tokens for maker...');
  await dummyToken.approve(await limitOrderProtocol.getAddress(), hre.ethers.MaxUint256);
  console.log('✅ Dummy tokens approved for LOP');

  // Collect all addresses
  const addresses = {
    mockUSDC: await mockUSDC.getAddress(),
    mockETH: await mockETH.getAddress(),
    dummyToken: await dummyToken.getAddress(),
    optionNFT: await optionNFT.getAddress(),
    limitOrderProtocol: await limitOrderProtocol.getAddress()
  };

  console.log('\n🎉 Deployment Complete!');
  console.log('\n📋 Contract Addresses:');
  console.log('MockUSDC:', addresses.mockUSDC);
  console.log('MockETH:', addresses.mockETH);
  console.log('DummyOptionToken:', addresses.dummyToken);
  console.log('OptionNFT:', addresses.optionNFT);
  console.log('LimitOrderProtocol:', addresses.limitOrderProtocol);

  // Update .env file with new addresses
  console.log('\n📝 Updating .env file...');
  await updateEnvFile(addresses);

  console.log('\n🧪 Test the deployment:');
  console.log('npx hardhat run scripts/test-options-advanced.js --network localhost');
  console.log('\n🚀 Start the backend:');
  console.log('npm run dev');

  return addresses;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }); 
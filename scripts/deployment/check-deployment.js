const { ethers } = require('ethers');
require('dotenv').config();

async function checkDeploymentStatus() {
  console.log('🔍 Checking Base Sepolia Deployment Status...\n');

  if (!process.env.BASE_SEPOLIA_RPC_URL && !process.env.RPC_URL) {
    console.error('❌ No RPC URL found in environment');
    console.log('Make sure you have BASE_SEPOLIA_RPC_URL or RPC_URL set');
    return;
  }

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.RPC_URL || 'https://sepolia.base.org';
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  console.log(`🌐 Checking contracts on Base Sepolia...`);
  console.log(`📡 RPC: ${rpcUrl}\n`);

  const contracts = [
    { name: 'LimitOrderProtocol', env: 'LOP_ADDRESS', required: true },
    { name: 'OptionsNFT', env: 'OPTIONS_NFT_ADDRESS', required: true },
    { name: 'Mock USDC', env: 'MOCK_USDC_ADDRESS', required: false },
    { name: 'Mock WETH/ETH', env: 'MOCK_ETH_ADDRESS', required: false },
    { name: 'DummyOptionToken', env: 'DUMMY_TOKEN_ADDRESS', required: false }
  ];

  let allDeployed = true;
  let deployedCount = 0;
  let totalExpected = 0;

  console.log('📄 Contract Status:');

  for (const contract of contracts) {
    const address = process.env[contract.env];
    
    if (!address) {
      if (contract.required) {
        console.log(`❌ ${contract.name}: No address in environment`);
        allDeployed = false;
      } else {
        console.log(`⚪ ${contract.name}: Not configured (optional)`);
      }
      continue;
    }

    totalExpected++;

    try {
      const code = await provider.getCode(address);
      
      if (code === '0x') {
        console.log(`❌ ${contract.name}: Contract not found at ${address}`);
        allDeployed = false;
      } else {
        console.log(`✅ ${contract.name}: Deployed at ${address}`);
        deployedCount++;

        // Try to get contract info if it's a token
        if (contract.name.includes('Mock') || contract.name.includes('Dummy')) {
          try {
            const tokenInterface = new ethers.Interface([
              'function symbol() view returns (string)',
              'function name() view returns (string)',
              'function decimals() view returns (uint8)'
            ]);
            const tokenContract = new ethers.Contract(address, tokenInterface, provider);
            
            const [symbol, name, decimals] = await Promise.all([
              tokenContract.symbol(),
              tokenContract.name(), 
              tokenContract.decimals()
            ]);
            
            console.log(`   → ${name} (${symbol}) - ${decimals} decimals`);
          } catch (e) {
            // Token info not readable, that's okay
          }
        }

        // For OptionsNFT, try to verify it's properly linked to LOP
        if (contract.name === 'OptionsNFT' && process.env.LOP_ADDRESS) {
          try {
            const nftInterface = new ethers.Interface([
              'function limitOrderProtocol() view returns (address)'
            ]);
            const nftContract = new ethers.Contract(address, nftInterface, provider);
            const lopAddress = await nftContract.limitOrderProtocol();
            
            if (lopAddress.toLowerCase() === process.env.LOP_ADDRESS.toLowerCase()) {
              console.log(`   → ✅ Correctly linked to LimitOrderProtocol`);
            } else {
              console.log(`   → ⚠️  Linked to different LOP: ${lopAddress}`);
            }
          } catch (e) {
            // Can't read LOP address, might be different interface
          }
        }
      }
    } catch (error) {
      console.log(`❌ ${contract.name}: Error checking ${address} - ${error.message}`);
      allDeployed = false;
    }
  }

  // Summary
  console.log(`\n📊 Deployment Summary:`);
  console.log(`   Contracts Found: ${deployedCount}/${totalExpected}`);
  
  if (allDeployed && deployedCount > 0) {
    console.log('🎉 All contracts are deployed and accessible!');
    console.log('\n✅ You DO NOT need to deploy again');
    console.log('\n🚀 Next steps:');
    console.log('1. npm run setup:production-env  # Setup frontend');
    console.log('2. npm start                     # Start backend');
    console.log('3. npm run frontend              # Start frontend');
    
    // Show BaseScan links
    console.log('\n🔗 View on BaseScan:');
    contracts.forEach(contract => {
      const address = process.env[contract.env];
      if (address) {
        console.log(`   ${contract.name}: https://sepolia.basescan.org/address/${address}`);
      }
    });
    
  } else if (deployedCount === 0) {
    console.log('❌ No contracts found - you need to deploy');
    console.log('\n🚀 To deploy:');
    console.log('npm run deploy:base-sepolia');
    
  } else {
    console.log('⚠️  Partial deployment detected');
    console.log('\n🚀 To complete deployment:');
    console.log('npm run deploy:base-sepolia  # Will skip existing contracts');
  }

  return { allDeployed, deployedCount, totalExpected };
}

checkDeploymentStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
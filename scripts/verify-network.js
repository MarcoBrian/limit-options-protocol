const { ethers } = require('ethers');
require('dotenv').config();

async function verifyNetworkConnections() {
  console.log('🔍 Verifying Network Connections...\n');

  // Check environment variables
  console.log('📋 Environment Configuration:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`   NETWORK: ${process.env.NETWORK || 'not set'}`);
  console.log(`   CHAIN_ID: ${process.env.CHAIN_ID || 'not set'}`);
  console.log(`   RPC_URL: ${process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || 'not set'}`);
  console.log(`   LOP_ADDRESS: ${process.env.LOP_ADDRESS || 'not set'}`);
  console.log(`   OPTIONS_NFT_ADDRESS: ${process.env.OPTIONS_NFT_ADDRESS || 'not set'}\n`);

  // Test RPC Connection
  const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || 'http://localhost:8545';
  console.log('🌐 Testing RPC Connection...');
  console.log(`   Connecting to: ${rpcUrl}`);

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Get network info
    const network = await provider.getNetwork();
    console.log(`✅ Connected successfully!`);
    console.log(`   Network Name: ${network.name}`);
    console.log(`   Chain ID: ${network.chainId}`);
    
    // Get latest block
    const blockNumber = await provider.getBlockNumber();
    console.log(`   Latest Block: ${blockNumber}`);
    
    // Verify expected network
    const expectedChainId = parseInt(process.env.CHAIN_ID || '31337');
    if (Number(network.chainId) === expectedChainId) {
      console.log(`✅ Chain ID matches expected: ${expectedChainId}`);
    } else {
      console.log(`⚠️  Chain ID mismatch! Expected: ${expectedChainId}, Got: ${network.chainId}`);
    }

  } catch (error) {
    console.error('❌ RPC Connection failed:', error.message);
    return false;
  }

  // Test Contract Connections
  console.log('\n📄 Testing Contract Connections...');
  
  const contracts = [
    { name: 'LimitOrderProtocol', envVar: 'LOP_ADDRESS', required: true },
    { name: 'OptionsNFT', envVar: 'OPTIONS_NFT_ADDRESS', required: true },
    { name: 'Mock USDC', envVar: 'MOCK_USDC_ADDRESS', required: false },
    { name: 'Mock ETH/WETH', envVar: 'MOCK_ETH_ADDRESS', required: false },
    { name: 'DummyOptionToken', envVar: 'DUMMY_TOKEN_ADDRESS', required: false }
  ];

  let contractsFound = 0;
  let contractsExpected = 0;

  for (const contract of contracts) {
    const address = process.env[contract.envVar];
    
    if (address) {
      contractsExpected++;
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const code = await provider.getCode(address);
        
        if (code === '0x') {
          console.log(`❌ ${contract.name} contract not found at address: ${address}`);
        } else {
          console.log(`✅ ${contract.name} contract found at: ${address}`);
          contractsFound++;
          
          // Try to get some basic info if possible
          if (contract.name.includes('Mock') || contract.name.includes('Dummy')) {
            try {
              // Try to call a basic ERC20 function to verify it's working
              const contractInterface = new ethers.Interface([
                'function symbol() view returns (string)',
                'function name() view returns (string)'
              ]);
              const contractInstance = new ethers.Contract(address, contractInterface, provider);
              
              const symbol = await contractInstance.symbol();
              const name = await contractInstance.name();
              console.log(`   → Name: ${name}, Symbol: ${symbol}`);
            } catch (tokenError) {
              // Don't worry if we can't read token info
              console.log(`   → Contract deployed (token info not readable)`);
            }
          }
        }
      } catch (error) {
        console.log(`❌ Error checking ${contract.name} contract:`, error.message);
      }
    } else if (contract.required) {
      console.log(`⚠️  ${contract.name} address not set (${contract.envVar})`);
    } else {
      console.log(`ℹ️  ${contract.name} address not set (${contract.envVar}) - optional`);
    }
  }

  // Summary
  console.log(`\n📊 Contract Summary: ${contractsFound}/${contractsExpected} contracts found and verified`);
  
  if (contractsExpected === 0) {
    console.log('⚠️  No contract addresses configured. Deploy contracts first!');
  } else if (contractsFound === contractsExpected) {
    console.log('🎉 All configured contracts are deployed and accessible!');
  } else {
    console.log('⚠️  Some contracts may need to be redeployed or addresses updated.');
  }

  // Network identification
  console.log('\n🏷️  Network Identification:');
  const chainId = parseInt(process.env.CHAIN_ID || '31337');
  
  switch (chainId) {
    case 31337:
      console.log('🏠 Current Network: Local Hardhat');
      console.log('   RPC: http://localhost:8545');
      console.log('   Explorer: N/A (local)');
      break;
    case 84532:
      console.log('🧪 Current Network: Base Sepolia Testnet');
      console.log('   RPC: https://sepolia.base.org');
      console.log('   Explorer: https://sepolia.basescan.org');
      break;
    case 8453:
      console.log('🌐 Current Network: Base Mainnet');
      console.log('   RPC: https://mainnet.base.org');
      console.log('   Explorer: https://basescan.org');
      break;
    default:
      console.log(`❓ Unknown Network: Chain ID ${chainId}`);
  }

  console.log('\n✅ Network verification complete!\n');
}

verifyNetworkConnections()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
const fs = require('fs');
const path = require('path');

function switchNetwork(targetNetwork) {
  console.log(`🔄 Switching to ${targetNetwork} network...\n`);

  const envFiles = {
    'localhost': '.env.localhost',
    'hardhat': '.env.localhost', 
    'local': '.env.localhost',
    'base-sepolia': '.env.base-sepolia',
    'sepolia': '.env.base-sepolia',
    'testnet': '.env.base-sepolia'
  };

  const sourceFile = envFiles[targetNetwork.toLowerCase()];
  
  if (!sourceFile) {
    console.error('❌ Unknown network:', targetNetwork);
    console.log('Available networks: localhost, base-sepolia');
    process.exit(1);
  }

  const sourcePath = path.join(__dirname, '..', sourceFile);
  const targetPath = path.join(__dirname, '..', '.env');

  // Check if source file exists
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Environment file not found: ${sourceFile}`);
    console.log('Available files:');
    Object.values(envFiles).forEach(file => {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        console.log(`   ✅ ${file}`);
      } else {
        console.log(`   ❌ ${file} (missing)`);
      }
    });
    process.exit(1);
  }

  try {
    // Read source environment file
    const sourceContent = fs.readFileSync(sourcePath, 'utf8');
    
    // Handle existing .env file
    let currentContent = '';
    if (fs.existsSync(targetPath)) {
      currentContent = fs.readFileSync(targetPath, 'utf8');
      console.log('📋 Backing up current .env to .env.backup');
      fs.writeFileSync(targetPath + '.backup', currentContent);
    }

    // Copy source to .env (complete file copy)
    fs.writeFileSync(targetPath, sourceContent);
    
    console.log(`✅ Switched to ${targetNetwork} network`);
    console.log(`📁 Environment file: ${sourceFile} → .env`);

    // Parse and display ALL copied variables
    const envVars = {};
    let variableCount = 0;
    sourceContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          envVars[key] = valueParts.join('=');
          variableCount++;
        }
      }
    });

    console.log(`\n📋 Copied ${variableCount} environment variables:`);

    // Show all important variables that were copied
    const importantVars = [
      'NETWORK', 'CHAIN_ID', 'RPC_URL', 'BASE_SEPOLIA_RPC_URL',
      'LOP_ADDRESS', 'OPTIONS_NFT_ADDRESS', 'MOCK_USDC_ADDRESS', 'MOCK_ETH_ADDRESS', 'DUMMY_TOKEN_ADDRESS',
      'PRIVATE_KEY', 'PORT', 'REACT_APP_CHAIN_ID', 'REACT_APP_RPC_URL', 'REACT_APP_API_URL'
    ];

    importantVars.forEach(varName => {
      if (envVars[varName]) {
        let displayValue = envVars[varName];
        
        // Hide sensitive data
        if (varName === 'PRIVATE_KEY' && displayValue.length > 10) {
          displayValue = displayValue.substring(0, 6) + '...' + displayValue.substring(displayValue.length - 4);
        }
        
        console.log(`   ✅ ${varName}: ${displayValue}`);
      }
    });

    console.log('\n📋 Network Configuration:');
    console.log(`   Network: ${envVars.NETWORK || 'not set'}`);
    console.log(`   Chain ID: ${envVars.CHAIN_ID || 'not set'}`);
    console.log(`   RPC URL: ${envVars.RPC_URL || envVars.BASE_SEPOLIA_RPC_URL || 'not set'}`);

    // Show next steps
    console.log('\n🚀 Next Steps:');
    
    if (targetNetwork.toLowerCase().includes('localhost') || targetNetwork.toLowerCase().includes('hardhat')) {
      console.log('1. Start Hardhat node: npm run hardhat-start');
      console.log('2. Deploy contracts: npm run deploy');
      console.log('3. Setup frontend: npm run setup:frontend-env');
    } else if (targetNetwork.toLowerCase().includes('sepolia')) {
      console.log('1. Ensure you have testnet ETH in your wallet');
      console.log('2. Deploy contracts: npm run deploy:base-sepolia');  
      console.log('3. Setup frontend: npm run setup:production-env');
    }
    
    console.log('4. Verify connection: npm run verify:network');
    console.log('5. Restart backend: npm start');
    console.log('6. Restart frontend: npm run frontend');

  } catch (error) {
    console.error('❌ Error switching network:', error.message);
    process.exit(1);
  }
}

// Get target network from command line argument
const targetNetwork = process.argv[2];

if (!targetNetwork) {
  console.log('🔧 Network Switcher');
  console.log('\nUsage: npm run switch:network <network>');
  console.log('\nAvailable networks:');
  console.log('  localhost     - Local Hardhat development');
  console.log('  base-sepolia  - Base Sepolia testnet');
  console.log('\nExamples:');
  console.log('  npm run switch:localhost');
  console.log('  npm run switch:base-sepolia');
  process.exit(0);
}

switchNetwork(targetNetwork);
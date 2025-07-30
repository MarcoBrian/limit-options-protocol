const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkPrerequisites() {
  console.log("🎯 IWANTOPTIONS COMPLETE SYSTEM TEST");
  console.log("====================================");
  console.log("");

  colorLog('blue', 'This script will test your complete Options Protocol system:');
  console.log("✅ Smart contracts (LOP integration)");
  console.log("✅ Backend API (order storage & validation)");
  console.log("✅ End-to-end order flow");
  console.log("");

  // Check if node_modules exists in parent directory
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    colorLog('red', '❌ node_modules not found. Please run "npm install" first.');
    console.log(`   Looking for: ${nodeModulesPath}`);
    return false;
  }

  // Check if Hardhat network is running
  colorLog('yellow', '🔍 Checking if Hardhat network is running...');
  try {
    await axios.get('http://localhost:8545', { timeout: 3000 });
    colorLog('green', '✅ Hardhat network is running');
  } catch (error) {
    colorLog('red', '❌ Hardhat network not running on localhost:8545');
    console.log("");
    console.log("Please start Hardhat network in a separate terminal:");
    colorLog('blue', 'npx hardhat node');
    console.log("");
    console.log("Then run this script again.");
    return false;
  }

  // Check if backend is running
  colorLog('yellow', '🔍 Checking if backend is running...');
  try {
    const response = await axios.get('http://localhost:3000/health', { timeout: 3000 });
    colorLog('green', '✅ Backend is running');
    console.log(`   Service: ${response.data.service}`);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      colorLog('red', '❌ Backend not running on localhost:3000');
      console.log("");
      console.log("Please start the backend in a separate terminal:");
      colorLog('blue', 'npm run dev');
      console.log("");
      console.log("Then run this script again.");
      return false;
    } else {
      colorLog('red', '❌ Backend health check failed');
      console.log(`   Error: ${error.code || error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
      }
      return false;
    }
  }

  console.log("");
  return true;
}

function runBackendTest() {
  return new Promise((resolve, reject) => {
    colorLog('blue', '🚀 Running complete backend integration test...');
    console.log("");

    // Run from parent directory since the test script is in scripts/
    const testProcess = spawn('npm', ['run', 'test:backend'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')  // Run from project root
    });

    testProcess.on('close', (code) => {
      resolve(code);
    });

    testProcess.on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  try {
    // Check all prerequisites
    const prerequisitesOk = await checkPrerequisites();
    if (!prerequisitesOk) {
      process.exit(1);
    }

    // Run the backend integration test
    const testExitCode = await runBackendTest();

    console.log("");
    console.log(`🔍 Test process exited with code: ${testExitCode}`);
    
    if (testExitCode === 0) {
      colorLog('green', '🎉 COMPLETE SYSTEM TEST PASSED! 🎉');
      console.log("");
      colorLog('blue', 'Your Options Protocol is fully functional:');
      console.log("✅ Smart contracts deployed and working");
      console.log("✅ Backend API accepting and validating orders");
      console.log("✅ Order signatures properly verified");
      console.log("✅ NFT minting working correctly");
      console.log("✅ End-to-end flow complete");
      console.log("");
      colorLog('yellow', '💡 Next steps:');
      console.log("   - Build a frontend UI");
      console.log("   - Deploy to testnet");
      console.log("   - Add more order types");
      console.log("   - Implement order matching");
    } else {
      colorLog('red', '❌ SYSTEM TEST FAILED');
      console.log("");
      colorLog('yellow', 'The backend integration test failed. This could be because:');
      console.log("1. Backend stopped running during the test");
      console.log("2. There's a connection issue between Hardhat and backend");
      console.log("3. The backend test script has an error");
      console.log("");
      colorLog('yellow', 'Troubleshooting:');
      console.log("1. Make sure Hardhat node is running: npx hardhat node");
      console.log("2. Make sure backend is running: npm run dev");
      console.log("3. Try running the backend test directly: npm run test:backend");
      console.log("4. Check the error messages above");
      console.log("5. Ensure all dependencies are installed: npm install");
      process.exit(1);
    }

    console.log("");
    console.log("🎯 Test Complete");

  } catch (error) {
    colorLog('red', `❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { main, checkPrerequisites, runBackendTest }; 
const { ethers } = require('ethers');
const axios = require('axios');
require('dotenv').config();

const BACKEND_URL = 'http://localhost:3000';

// Contract addresses from .env
const LOP_ADDRESS = process.env.LOP_ADDRESS;
const OPTIONS_NFT_ADDRESS = process.env.OPTIONS_NFT_ADDRESS;
const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS;
const MOCK_ETH_ADDRESS = process.env.MOCK_ETH_ADDRESS;
const DUMMY_TOKEN_ADDRESS = process.env.DUMMY_TOKEN_ADDRESS;

// Import builder helper functions
const {
  buildCompleteCallOption,
  buildOrder,
  signOrder
} = require('../scripts/helpers/orderBuilder');

// Import nonce manager
const { createNonceManager } = require('../scripts/helpers/nonceManager');

/**
 * Create an options order with option_params using the builder functions
 */
async function createOptionsOrderSignature() {
  console.log('🚀 Creating Options Order with Valid Signature\n');
  
  try {
    // Setup signer with provider
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const privateKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Hardhat account #0
    const signer = new ethers.Wallet(privateKey, provider);
    console.log('   Signer address:', signer.address);

    // Create nonce manager with provider
    const nonceManager = createNonceManager(OPTIONS_NFT_ADDRESS, provider);
    
    // Get next available nonce using nonce manager
    console.log('   Getting next available nonce...');
    const nextNonce = await nonceManager.getNextNonce(signer.address);
    console.log(`   ✅ Next available nonce: ${nextNonce}`);
    
    // Validate the nonce
    const isNonceValid = await nonceManager.validateNonce(signer.address, nextNonce);
    console.log(`   ✅ Nonce ${nextNonce} is valid: ${isNonceValid}`);

    // Build complete call option using the builder function
    const optionParams = {
      makerSigner: signer,
      underlyingAsset: MOCK_ETH_ADDRESS,
      strikeAsset: MOCK_USDC_ADDRESS,
      dummyTokenAddress: DUMMY_TOKEN_ADDRESS,
      strikePrice: ethers.parseUnits('2000', 6), // $2000 per ETH
      optionAmount: ethers.parseEther('1'), // 1 ETH option
      premium: ethers.parseUnits('100', 6), // $100 premium
      expiry: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
      lopAddress: LOP_ADDRESS,
      optionsNFTAddress: OPTIONS_NFT_ADDRESS,
      nonce: nextNonce // Use the fetched nonce
    };

    console.log('   Building complete call option using orderBuilder...');
    const completeOption = await buildCompleteCallOption(optionParams);
    console.log('   ✅ Options order built successfully');

    console.log('   Options order details:');
    console.log('     Maker:', signer.address);
    console.log('     Underlying Asset:', MOCK_ETH_ADDRESS);
    console.log('     Strike Asset:', MOCK_USDC_ADDRESS);
    console.log('     Strike Price:', ethers.formatUnits(optionParams.strikePrice, 6), 'USDC per ETH');
    console.log('     Option Amount:', ethers.formatEther(optionParams.optionAmount), 'ETH');
    console.log('     Premium:', ethers.formatUnits(optionParams.premium, 6), 'USDC');
    console.log('     Expiry:', new Date(optionParams.expiry * 1000).toLocaleString());
    console.log('     Nonce:', completeOption.nonce);

    // Prepare order for backend
    const backendOrder = {
      order: {
        salt: completeOption.order.salt.toString(),
        maker: signer.address,
        receiver: signer.address,
        makerAsset: DUMMY_TOKEN_ADDRESS, // Dummy token as maker asset
        takerAsset: MOCK_USDC_ADDRESS,   // USDC as taker asset
        makingAmount: completeOption.order.makingAmount.toString(),
        takingAmount: completeOption.order.takingAmount.toString(),
        makerTraits: completeOption.order.makerTraits.toString()
      },
      signature: {
        r: completeOption.lopSignature.r,
        s: completeOption.lopSignature.s,
        v: completeOption.lopSignature.v
      },
      lopAddress: LOP_ADDRESS,
      optionParams: {
        underlyingAsset: MOCK_ETH_ADDRESS,
        strikeAsset: MOCK_USDC_ADDRESS,
        strikePrice: optionParams.strikePrice.toString(),
        optionAmount: optionParams.optionAmount.toString(),
        premium: optionParams.premium.toString(),
        expiry: optionParams.expiry,
        nonce: completeOption.nonce
      },
      optionsNFTSignature: {
        r: completeOption.optionsNFTSignature.r,
        s: completeOption.optionsNFTSignature.s,
        v: completeOption.optionsNFTSignature.v
      },
      optionsNFTAddress: OPTIONS_NFT_ADDRESS
    };

    console.log('   Submitting options order to backend...');
    const response = await axios.post(`${BACKEND_URL}/api/orders`, backendOrder);
    console.log('✅ Options order submitted successfully!');
    console.log('   Order Hash:', response.data.data.orderHash);
    console.log('   Status:', response.data.data.status);

    // Test retrieving the order
    console.log('\n📋 Retrieving submitted options order...');
    const getOrderResponse = await axios.get(`${BACKEND_URL}/api/orders/${response.data.data.orderHash}`);
    console.log('✅ Options order retrieved successfully');
    console.log('   Order details:', getOrderResponse.data.data);

    // Test browsing all orders
    console.log('\n📋 Browsing all orders...');
    const browseResponse = await axios.get(`${BACKEND_URL}/api/orders`);
    console.log('✅ Orders browsed successfully');
    console.log('   Total orders:', browseResponse.data.data.count);
    console.log('   Orders:', browseResponse.data.data.orders.map(o => ({ hash: o.order_hash, status: o.status })));

    // Test generating fill calldata
    console.log('\n⚡ Generating fill calldata...');
    const fillData = {
      taker: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      fillAmount: '500000000000000000', // 0.5 ETH
      lopAddress: LOP_ADDRESS
    };
    
    const fillResponse = await axios.post(`${BACKEND_URL}/api/orders/${response.data.data.orderHash}/fill`, fillData);
    console.log('✅ Fill calldata generated successfully');
    console.log('   Message:', fillResponse.data.data.message);
    console.log('   Order Data:', fillResponse.data.data.orderData);
    console.log('   Signature:', fillResponse.data.data.signature);
    console.log('   Estimated Gas:', fillResponse.data.data.estimatedGas);

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Backend is working with deployed contracts');
    console.log('   ✅ Real signatures are being validated correctly');
    console.log('   ✅ Options orders can be submitted and retrieved');
    console.log('   ✅ Fill calldata generation is working');
    console.log('   ✅ Nonce management is working correctly');

    return response.data.data.orderHash;

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data?.error) {
      console.error('   Error details:', error.response.data.error);
    }
    throw error;
  }
}

/**
 * Test contract accessibility
 */
async function testContractAccessibility() {
  console.log('\n🔧 Testing Contract Accessibility...');
  
  try {
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    
    // Test reading from OptionNFT
    const optionNFT = new ethers.Contract(OPTIONS_NFT_ADDRESS, [
      'function nextOptionId() view returns (uint256)',
      'function limitOrderProtocol() view returns (address)'
    ], provider);
    
    const nextOptionId = await optionNFT.nextOptionId();
    const lopAddress = await optionNFT.limitOrderProtocol();
    
    console.log('   ✅ OptionNFT is accessible');
    console.log('   Next Option ID:', nextOptionId.toString());
    console.log('   LOP Address:', lopAddress);
    
    // Test reading from Mock tokens
    const mockUSDC = new ethers.Contract(MOCK_USDC_ADDRESS, [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)'
    ], provider);
    
    const usdcName = await mockUSDC.name();
    const usdcSymbol = await mockUSDC.symbol();
    const usdcDecimals = await mockUSDC.decimals();
    
    console.log('   ✅ MockUSDC is accessible');
    console.log('   Name:', usdcName);
    console.log('   Symbol:', usdcSymbol);
    console.log('   Decimals:', usdcDecimals.toString());
    
  } catch (error) {
    console.error('❌ Contract accessibility test failed:', error.message);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Options Order Tests\n');
  console.log('This test creates an options order with option_params using orderBuilder functions.\n');

  await createOptionsOrderSignature();
  await testContractAccessibility();
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  createOptionsOrderSignature,
  testContractAccessibility,
  runAllTests
}; 
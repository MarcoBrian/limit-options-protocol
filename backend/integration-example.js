const { ethers } = require('ethers');
const axios = require('axios');

// Import builder helper functions
const {
  buildCompleteCallOption,
  buildOrder,
  signOrder
} = require('../scripts/helpers/orderBuilder');

const BACKEND_URL = 'http://localhost:3000';

/**
 * Example: Create and submit a call option order using the backend
 */
async function createAndSubmitCallOption() {
  console.log('🚀 Creating and submitting call option order...\n');

  try {
    // Setup parameters
    const makerPrivateKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Example private key
    const makerWallet = new ethers.Wallet(makerPrivateKey);
    
    const params = {
      makerSigner: makerWallet,
      underlyingAsset: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // ETH
      strikeAsset: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // USDC
      dummyTokenAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0', // Dummy token
      strikePrice: ethers.parseUnits('2000', 6), // 2000 USDC per ETH
      optionAmount: ethers.parseEther('1'), // 1 ETH
      premium: ethers.parseUnits('100', 6), // 100 USDC
      expiry: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      lopAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      optionsNFTAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
    };

    // Build complete call option using helper functions
    console.log('📦 Building call option order...');
    const orderData = await buildCompleteCallOption(params);
    
    console.log('✅ Order built successfully');
    console.log(`   Maker: ${orderData.order.maker}`);
    console.log(`   Premium: ${ethers.formatUnits(orderData.optionParams.premium, 6)} USDC`);
    console.log(`   Strike Price: ${ethers.formatUnits(orderData.optionParams.strikePrice, 6)} USDC per ETH`);
    console.log(`   Expiry: ${new Date(Number(orderData.optionParams.expiry) * 1000).toISOString()}`);

    // Prepare order for backend submission
    const backendOrder = {
      order: {
        salt: orderData.order.salt.toString(),
        maker: orderData.order.maker,
        receiver: orderData.order.receiver,
        makerAsset: orderData.order.makerAsset,
        takerAsset: orderData.order.takerAsset,
        makingAmount: orderData.order.makingAmount.toString(),
        takingAmount: orderData.order.takingAmount.toString(),
        makerTraits: orderData.order.makerTraits.toString()
      },
      signature: {
        r: orderData.lopSignature.r,
        s: orderData.lopSignature.s,
        v: orderData.lopSignature.v
      },
      lopAddress: params.lopAddress,
      optionParams: {
        underlyingAsset: orderData.optionParams.underlyingAsset,
        strikeAsset: orderData.optionParams.strikeAsset,
        strikePrice: orderData.optionParams.strikePrice.toString(),
        optionAmount: orderData.optionParams.optionAmount.toString(),
        premium: orderData.optionParams.premium.toString(),
        expiry: Number(orderData.optionParams.expiry),
        nonce: orderData.nonce
      },
      optionsNFTSignature: {
        r: orderData.optionsNFTSignature.r,
        s: orderData.optionsNFTSignature.s,
        v: orderData.optionsNFTSignature.v
      },
      optionsNFTAddress: params.optionsNFTAddress
    };

    // Submit order to backend
    console.log('\n📤 Submitting order to backend...');
    const response = await axios.post(`${BACKEND_URL}/api/orders`, backendOrder);
    
    console.log('✅ Order submitted successfully!');
    console.log(`   Order Hash: ${response.data.data.orderHash}`);
    console.log(`   Status: ${response.data.data.status}`);

    return response.data.data.orderHash;

  } catch (error) {
    console.error('❌ Error creating and submitting order:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Example: Browse open orders
 */
async function browseOpenOrders() {
  console.log('\n📋 Browsing open orders...\n');

  try {
    const response = await axios.get(`${BACKEND_URL}/api/orders?status=open&limit=10`);
    
    console.log(`Found ${response.data.data.count} open orders:\n`);
    
    response.data.data.orders.forEach((order, index) => {
      console.log(`${index + 1}. Order Hash: ${order.orderHash}`);
      console.log(`   Maker: ${order.maker}`);
      console.log(`   Making Amount: ${order.makingAmount}`);
      console.log(`   Taking Amount: ${order.takingAmount}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Created: ${new Date(order.createdAt).toLocaleString()}`);
      
      if (order.optionParams) {
        console.log(`   Type: Call Option`);
        console.log(`   Strike Price: ${ethers.formatUnits(order.optionParams.strikePrice, 6)} USDC per ETH`);
        console.log(`   Premium: ${ethers.formatUnits(order.optionParams.premium, 6)} USDC`);
        console.log(`   Expiry: ${new Date(order.optionParams.expiry * 1000).toLocaleString()}`);
      }
      console.log('');
    });

    return response.data.data.orders;

  } catch (error) {
    console.error('❌ Error browsing orders:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Example: Generate fill calldata for an order
 */
async function generateFillCalldata(orderHash) {
  console.log(`\n⚡ Generating fill calldata for order: ${orderHash}...\n`);

  try {
    const fillData = {
      taker: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      fillAmount: '50000000', // 50 USDC
      lopAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
    };

    const response = await axios.post(`${BACKEND_URL}/api/orders/${orderHash}/fill`, fillData);
    
    console.log('✅ Fill calldata generated successfully!');
    console.log(`   To: ${response.data.data.fillCalldata.to}`);
    console.log(`   Data: ${response.data.data.fillCalldata.data.substring(0, 66)}...`);
    console.log(`   Value: ${response.data.data.fillCalldata.value}`);
    console.log(`   Estimated Gas: ${response.data.data.estimatedGas}`);

    return response.data.data.fillCalldata;

  } catch (error) {
    console.error('❌ Error generating fill calldata:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Example: Cancel an order
 */
async function cancelOrder(orderHash, makerAddress) {
  console.log(`\n❌ Cancelling order: ${orderHash}...\n`);

  try {
    const cancelData = {
      maker: makerAddress
    };

    const response = await axios.post(`${BACKEND_URL}/api/orders/${orderHash}/cancel`, cancelData);
    
    console.log('✅ Order cancelled successfully!');
    console.log(`   Status: ${response.data.data.status}`);

    return response.data.data;

  } catch (error) {
    console.error('❌ Error cancelling order:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Run complete integration example
 */
async function runIntegrationExample() {
  console.log('🎯 Options Protocol Backend Integration Example\n');
  console.log('This example demonstrates:');
  console.log('1. Creating a call option order using builder helpers');
  console.log('2. Submitting the order to the backend');
  console.log('3. Browsing open orders');
  console.log('4. Generating fill calldata');
  console.log('5. Cancelling orders\n');

  try {
    // Step 1: Create and submit order
    const orderHash = await createAndSubmitCallOption();
    
    // Step 2: Browse orders
    await browseOpenOrders();
    
    // Step 3: Generate fill calldata
    await generateFillCalldata(orderHash);
    
    // Step 4: Cancel order (optional)
    // await cancelOrder(orderHash, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
    
    console.log('\n🎉 Integration example completed successfully!');

  } catch (error) {
    console.error('\n❌ Integration example failed:', error.message);
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  runIntegrationExample().catch(console.error);
}

module.exports = {
  createAndSubmitCallOption,
  browseOpenOrders,
  generateFillCalldata,
  cancelOrder,
  runIntegrationExample
}; 
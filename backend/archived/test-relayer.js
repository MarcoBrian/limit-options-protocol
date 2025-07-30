const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Sample order data for testing (without valid signatures)
const sampleOrder = {
  order: {
    salt: "123456789",
    maker: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    receiver: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    makerAsset: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    takerAsset: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    makingAmount: "1000000000000000000",
    takingAmount: "2000000000",
    makerTraits: "0"
  },
  signature: {
    r: "0x1234567890123456789012345678901234567890123456789012345678901234",
    s: "0x1234567890123456789012345678901234567890123456789012345678901234",
    v: 27
  },
  lopAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  optionParams: {
    underlyingAsset: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    strikeAsset: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    strikePrice: "2000000000",
    optionAmount: "1000000000000000000",
    premium: "100000000",
    expiry: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
    nonce: 1
  },
  optionsNFTSignature: {
    r: "0x1234567890123456789012345678901234567890123456789012345678901234",
    s: "0x1234567890123456789012345678901234567890123456789012345678901234",
    v: 27
  },
  optionsNFTAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3"
};

async function testHealthCheck() {
  console.log('🏥 Testing health check...');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testSubmitOrder() {
  console.log('\n📝 Testing order submission...');
  console.log('⚠️  Skipping signature validation test (requires valid ECDSA signatures)');
  console.log('   Use the integration example for testing with real signatures');
  return null;
}

async function testGetOrders() {
  console.log('\n📋 Testing get orders...');
  try {
    const response = await axios.get(`${BASE_URL}/api/orders?status=open&limit=10`);
    console.log('✅ Orders retrieved successfully:');
    console.log(`   Found ${response.data.data.count} orders`);
    response.data.data.orders.forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.orderHash} (${order.status})`);
    });
    return response.data.data.orders;
  } catch (error) {
    console.error('❌ Get orders failed:', error.response?.data || error.message);
    return [];
  }
}

async function testGetSpecificOrder(orderHash) {
  console.log(`\n🔍 Testing get specific order: ${orderHash}...`);
  try {
    const response = await axios.get(`${BASE_URL}/api/orders/${orderHash}`);
    console.log('✅ Order retrieved successfully:', response.data.data.orderHash);
    return response.data.data;
  } catch (error) {
    console.error('❌ Get specific order failed:', error.response?.data || error.message);
    return null;
  }
}

async function testGenerateFillCalldata(orderHash) {
  console.log(`\n⚡ Testing fill calldata generation for: ${orderHash}...`);
  try {
    const fillData = {
      taker: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      fillAmount: "50000000",
      lopAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    };
    
    const response = await axios.post(`${BASE_URL}/api/orders/${orderHash}/fill`, fillData);
    console.log('✅ Fill calldata generated successfully:');
    console.log(`   To: ${response.data.data.fillCalldata.to}`);
    console.log(`   Data: ${response.data.data.fillCalldata.data.substring(0, 66)}...`);
    console.log(`   Estimated Gas: ${response.data.data.estimatedGas}`);
    return response.data.data;
  } catch (error) {
    console.error('❌ Fill calldata generation failed:', error.response?.data || error.message);
    return null;
  }
}

async function testCancelOrder(orderHash) {
  console.log(`\n❌ Testing order cancellation for: ${orderHash}...`);
  try {
    const cancelData = {
      maker: sampleOrder.order.maker
    };
    
    const response = await axios.post(`${BASE_URL}/api/orders/${orderHash}/cancel`, cancelData);
    console.log('✅ Order cancelled successfully:', response.data.data.status);
    return response.data.data;
  } catch (error) {
    console.error('❌ Order cancellation failed:', error.response?.data || error.message);
    return null;
  }
}

async function testAPIEndpoints() {
  console.log('\n🔧 Testing API endpoints without signature validation...');
  
  // Test GET /api/orders with various filters
  const testCases = [
    { query: '?status=open&limit=5', description: 'Open orders with limit' },
    { query: '?maker=0x1234567890123456789012345678901234567890', description: 'Filter by maker' },
    { query: '?makerAsset=0x1234567890123456789012345678901234567890', description: 'Filter by maker asset' },
    { query: '?takerAsset=0x1234567890123456789012345678901234567890', description: 'Filter by taker asset' }
  ];

  for (const testCase of testCases) {
    try {
      const response = await axios.get(`${BASE_URL}/api/orders${testCase.query}`);
      console.log(`✅ ${testCase.description}: ${response.data.data.count} orders found`);
    } catch (error) {
      console.error(`❌ ${testCase.description} failed:`, error.response?.data || error.message);
    }
  }
}

async function runAllTests() {
  console.log('🚀 Starting Options Protocol Relayer Tests\n');
  
  // Test 1: Health check
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log('\n❌ Health check failed. Make sure the server is running on port 3000.');
    return;
  }
  
  // Test 2: API endpoints (without signature validation)
  await testAPIEndpoints();
  
  // Test 3: Get all orders
  await testGetOrders();
  
  // Test 4: Skip signature-dependent tests
  console.log('\n📝 Note: Signature validation tests skipped');
  console.log('   To test with real signatures, run:');
  console.log('   node backend/integration-example.js');
  
  console.log('\n🎉 Basic API tests completed!');
  console.log('\n💡 For full testing with real signatures:');
  console.log('   1. Deploy your contracts');
  console.log('   2. Update .env with contract addresses');
  console.log('   3. Run: node backend/integration-example.js');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testHealthCheck,
  testSubmitOrder,
  testGetOrders,
  testGetSpecificOrder,
  testGenerateFillCalldata,
  testCancelOrder,
  testAPIEndpoints,
  runAllTests
}; 
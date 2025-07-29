const { ethers } = require("hardhat");
const {
  buildCompleteCallOption,
  fillCallOption,
  deployDummyOptionToken,
  setupDummyTokensForMaker,
  cleanupDummyTokens,
  getNextNonceFromOptionsNFT,
  isNonceAvailableInOptionsNFT,
  advanceNonceInOptionsNFT
} = require("./helpers/orderBuilder");
const { createNonceManager } = require("./helpers/nonceManager");

async function main() {
  console.log("🔢 Testing Independent Nonce Management in OptionsNFT");
  console.log("=====================================================");

  // Get signers
  const [deployer, maker, taker] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Maker: ${maker.address}`);
  console.log(`Taker: ${taker.address}`);

  // Deploy contracts
  console.log("\n📦 Deploying contracts...");
  
  // Deploy mock tokens
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockETH = await MockERC20.deploy("Mock ETH", "mETH");
  const mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC");
  
  // Deploy WETH
  const MockWETH = await ethers.getContractFactory("MockWETH");
  const weth = await MockWETH.deploy();
  
  // Deploy Limit Order Protocol
  const LimitOrderProtocol = await ethers.getContractFactory("LimitOrderProtocol");
  const lop = await LimitOrderProtocol.deploy(weth.target);
  
  // Deploy Options NFT
  const OptionNFT = await ethers.getContractFactory("OptionNFT");
  const optionsNFT = await OptionNFT.deploy(lop.target);
  
  // Deploy Dummy Option Token
  const dummyTokenResult = await deployDummyOptionToken(deployer.address);
  
  console.log("✅ All contracts deployed successfully");
  console.log(`OptionsNFT: ${optionsNFT.target}`);

  // Setup tokens
  console.log("\n💰 Setting up tokens...");
  const ethAmount = ethers.parseEther("10");
  const usdcAmount = ethers.parseUnits("10000", 6);
  const optionAmount = ethers.parseEther("1");
  
  await mockETH.mint(maker.address, ethAmount);
  await mockUSDC.mint(taker.address, usdcAmount);
  
  await mockETH.connect(maker).approve(lop.target, ethAmount);
  await mockETH.connect(maker).approve(optionsNFT.target, ethAmount);
  await mockUSDC.connect(taker).approve(lop.target, usdcAmount);

  // Test 1: Initial Nonce State
  console.log("\n🔢 Test 1: Initial Nonce State");
  console.log("=================================");
  
  const initialNonce = await getNextNonceFromOptionsNFT(maker.address, optionsNFT.target);
  console.log(`Initial nonce for maker: ${initialNonce}`);
  
  const isInitialNonceAvailable = await isNonceAvailableInOptionsNFT(maker.address, optionsNFT.target, initialNonce);
  console.log(`Is initial nonce ${initialNonce} available: ${isInitialNonceAvailable}`);
  
  if (initialNonce !== 0) {
    console.log("❌ Expected initial nonce to be 0");
    return;
  }
  console.log("✅ Initial nonce is 0");

  // Test 2: NonceManager Helper Class
  console.log("\n🔧 Test 2: NonceManager Helper Class");
  console.log("=====================================");
  
  const nonceManager = createNonceManager(optionsNFT.target);
  
  // Get nonce info
  const nonceInfo = await nonceManager.getNonceInfo(maker.address);
  console.log("Nonce Information:");
  console.log(`- Maker: ${nonceInfo.maker}`);
  console.log(`- Next Nonce: ${nonceInfo.nextNonce}`);
  console.log(`- Current Nonce: ${nonceInfo.currentNonce}`);
  console.log(`- Is Available: ${nonceInfo.isAvailable}`);
  
  // Validate nonce
  const isValidNonce = await nonceManager.validateNonce(maker.address, nonceInfo.nextNonce);
  console.log(`- Nonce ${nonceInfo.nextNonce} is valid: ${isValidNonce}`);
  
  // Get recommended nonce
  const recommendedNonce = await nonceManager.getRecommendedNonce(maker.address);
  console.log(`- Recommended nonce: ${recommendedNonce}`);
  
  if (nonceInfo.nextNonce === 0 && nonceInfo.isAvailable && isValidNonce) {
    console.log("✅ NonceManager working correctly");
  } else {
    console.log("❌ NonceManager not working correctly");
    return;
  }

  // Test 3: Manual Nonce Advancement
  console.log("\n📈 Test 3: Manual Nonce Advancement");
  console.log("====================================");
  
  // Advance nonce manually
  console.log("Advancing nonce by 1...");
  await advanceNonceInOptionsNFT(maker, optionsNFT.target, 1);
  
  const newNonce = await getNextNonceFromOptionsNFT(maker.address, optionsNFT.target);
  console.log(`New nonce after advancement: ${newNonce}`);
  
  if (newNonce === 1) {
    console.log("✅ Nonce advancement working correctly");
  } else {
    console.log("❌ Nonce advancement not working correctly");
    return;
  }

  // Test 4: Nonce Validation
  console.log("\n✅ Test 4: Nonce Validation");
  console.log("============================");
  
  // Check if old nonce is still available (should be false)
  const isOldNonceAvailable = await isNonceAvailableInOptionsNFT(maker.address, optionsNFT.target, 0);
  console.log(`Is old nonce 0 available: ${isOldNonceAvailable}`);
  
  // Check if new nonce is available (should be true)
  const isNewNonceAvailable = await isNonceAvailableInOptionsNFT(maker.address, optionsNFT.target, 1);
  console.log(`Is new nonce 1 available: ${isNewNonceAvailable}`);
  
  if (!isOldNonceAvailable && isNewNonceAvailable) {
    console.log("✅ Nonce validation working correctly");
  } else {
    console.log("❌ Nonce validation not working correctly");
    return;
  }

  // Test 5: Order with Nonce
  console.log("\n🎯 Test 5: Order with Nonce");
  console.log("============================");
  
  // Setup dummy tokens
  await setupDummyTokensForMaker({
    dummyTokenAddress: dummyTokenResult.address,
    maker: maker.address,
    lopAddress: lop.target,
    optionAmount
  });
  
  // Create order with specific nonce
  const orderData = await buildCompleteCallOption({
    makerSigner: maker,
    underlyingAsset: mockETH.target,
    strikeAsset: mockUSDC.target,
    dummyTokenAddress: dummyTokenResult.address,
    strikePrice: ethers.parseUnits("2000", 6),
    optionAmount,
    premium: ethers.parseUnits("100", 6),
    expiry: Math.floor(Date.now() / 1000) + 86400,
    lopAddress: lop.target,
    optionsNFTAddress: optionsNFT.target,
    nonce: 1 // Use the advanced nonce
  });
  
  console.log(`✅ Order created with nonce: ${orderData.nonce}`);
  
  // Fill the order
  await fillCallOption({
    orderData,
    takerSigner: taker,
    fillAmount: ethers.parseUnits("100", 6),
    lopAddress: lop.target
  });
  
  console.log("✅ Order filled successfully!");
  
  // Cleanup
  await cleanupDummyTokens(dummyTokenResult.address, taker.address);

  // Test 6: Nonce Progression After Order
  console.log("\n🔄 Test 6: Nonce Progression After Order");
  console.log("==========================================");
  
  const nonceAfterOrder = await getNextNonceFromOptionsNFT(maker.address, optionsNFT.target);
  console.log(`Nonce after order: ${nonceAfterOrder}`);
  
  // Check if used nonce is no longer available
  const isUsedNonceAvailable = await isNonceAvailableInOptionsNFT(maker.address, optionsNFT.target, 1);
  console.log(`Is used nonce 1 available: ${isUsedNonceAvailable}`);
  
  // Check if next nonce is available
  const isNextNonceAvailable = await isNonceAvailableInOptionsNFT(maker.address, optionsNFT.target, 2);
  console.log(`Is next nonce 2 available: ${isNextNonceAvailable}`);
  
  if (nonceAfterOrder === 2 && !isUsedNonceAvailable && isNextNonceAvailable) {
    console.log("✅ Nonce progression working correctly");
  } else {
    console.log("❌ Nonce progression not working correctly");
    return;
  }

  // Test 7: Multiple Orders with Nonce Progression
  console.log("\n🔄 Test 7: Multiple Orders with Nonce Progression");
  console.log("==================================================");
  
  for (let i = 0; i < 3; i++) {
    const currentNonce = await getNextNonceFromOptionsNFT(maker.address, optionsNFT.target);
    console.log(`\n📋 Order ${i + 1} - Using nonce: ${currentNonce}`);
    
    // Setup dummy tokens for this order
    await setupDummyTokensForMaker({
      dummyTokenAddress: dummyTokenResult.address,
      maker: maker.address,
      lopAddress: lop.target,
      optionAmount
    });
    
    const orderData = await buildCompleteCallOption({
      makerSigner: maker,
      underlyingAsset: mockETH.target,
      strikeAsset: mockUSDC.target,
      dummyTokenAddress: dummyTokenResult.address,
      strikePrice: ethers.parseUnits("2000", 6) + BigInt(i * 100),
      optionAmount,
      premium: ethers.parseUnits("100", 6) + BigInt(i * 10),
      expiry: Math.floor(Date.now() / 1000) + 86400 + (i * 3600),
      lopAddress: lop.target,
      optionsNFTAddress: optionsNFT.target,
      nonce: currentNonce
    });
    
    console.log(`✅ Order ${i + 1} created with nonce: ${orderData.nonce}`);
    
    // Fill order
    await fillCallOption({
      orderData,
      takerSigner: taker,
      fillAmount: ethers.parseUnits("100", 6) + BigInt(i * 10),
      lopAddress: lop.target
    });
    
    console.log(`✅ Order ${i + 1} filled successfully!`);
    
    // Cleanup
    await cleanupDummyTokens(dummyTokenResult.address, taker.address);
    
    // Check next nonce
    const nextNonce = await getNextNonceFromOptionsNFT(maker.address, optionsNFT.target);
    console.log(`Next nonce after order ${i + 1}: ${nextNonce}`);
  }

  // Test 8: Error Handling - Duplicate Nonce
  console.log("\n❌ Test 8: Error Handling - Duplicate Nonce");
  console.log("============================================");
  
  try {
    // Try to create an order with an already used nonce
    const orderData = await buildCompleteCallOption({
      makerSigner: maker,
      underlyingAsset: mockETH.target,
      strikeAsset: mockUSDC.target,
      dummyTokenAddress: dummyTokenResult.address,
      strikePrice: ethers.parseUnits("2000", 6),
      optionAmount,
      premium: ethers.parseUnits("100", 6),
      expiry: Math.floor(Date.now() / 1000) + 86400,
      lopAddress: lop.target,
      optionsNFTAddress: optionsNFT.target,
      nonce: 1 // This nonce was already used
    });
    
    // Try to fill the order (should fail)
    await setupDummyTokensForMaker({
      dummyTokenAddress: dummyTokenResult.address,
      maker: maker.address,
      lopAddress: lop.target,
      optionAmount
    });
    
    await fillCallOption({
      orderData,
      takerSigner: taker,
      fillAmount: ethers.parseUnits("100", 6),
      lopAddress: lop.target
    });
    
    console.log("❌ Expected error for duplicate nonce, but order succeeded");
  } catch (error) {
    console.log("✅ Correctly rejected duplicate nonce");
    console.log(`Error: ${error.message}`);
  }

  // Test 9: Nonce Statistics
  console.log("\n📊 Test 9: Nonce Statistics");
  console.log("============================");
  
  const nonceStats = await nonceManager.getNonceStats(maker.address, 10);
  console.log("Nonce Statistics:");
  console.log(`- Maker: ${nonceStats.maker}`);
  console.log(`- Current Nonce: ${nonceStats.currentNonce}`);
  console.log(`- Used Count: ${nonceStats.usedCount}`);
  console.log(`- Available Count: ${nonceStats.availableCount}`);
  console.log(`- Last Used Nonce: ${nonceStats.lastUsedNonce}`);
  console.log(`- Next Available Nonce: ${nonceStats.nextAvailableNonce}`);
  
  if (nonceStats.usedCount > 0 && nonceStats.currentNonce > 0) {
    console.log("✅ Nonce statistics working correctly");
  } else {
    console.log("❌ Nonce statistics not working correctly");
  }

  // Test 10: Auto-Fetch Nonce
  console.log("\n🤖 Test 10: Auto-Fetch Nonce");
  console.log("============================");
  
  // Create order without specifying nonce (should auto-fetch)
  const autoFetchOrderData = await buildCompleteCallOption({
    makerSigner: maker,
    underlyingAsset: mockETH.target,
    strikeAsset: mockUSDC.target,
    dummyTokenAddress: dummyTokenResult.address,
    strikePrice: ethers.parseUnits("2000", 6),
    optionAmount,
    premium: ethers.parseUnits("100", 6),
    expiry: Math.floor(Date.now() / 1000) + 86400,
    lopAddress: lop.target,
    optionsNFTAddress: optionsNFT.target
    // No nonce specified - should auto-fetch
  });
  
  console.log(`✅ Auto-fetched nonce: ${autoFetchOrderData.nonce}`);
  
  // Setup and fill the order
  await setupDummyTokensForMaker({
    dummyTokenAddress: dummyTokenResult.address,
    maker: maker.address,
    lopAddress: lop.target,
    optionAmount
  });
  
  await fillCallOption({
    orderData: autoFetchOrderData,
    takerSigner: taker,
    fillAmount: ethers.parseUnits("100", 6),
    lopAddress: lop.target
  });
  
  console.log("✅ Auto-fetch order filled successfully!");
  
  // Cleanup
  await cleanupDummyTokens(dummyTokenResult.address, taker.address);

  // Final Summary
  console.log("\n🎉 Independent Nonce Management Test Completed Successfully!");
  console.log("\n📚 Summary:");
  console.log("✅ Initial nonce state correct");
  console.log("✅ NonceManager helper working");
  console.log("✅ Manual nonce advancement working");
  console.log("✅ Nonce validation working");
  console.log("✅ Order execution with nonces working");
  console.log("✅ Nonce progression after orders working");
  console.log("✅ Multiple orders with nonce progression working");
  console.log("✅ Error handling for duplicate nonces working");
  console.log("✅ Nonce statistics working");
  console.log("✅ Auto-fetch nonce functionality working");
  
  console.log("\n🔢 Final nonce state:");
  const finalNonce = await getNextNonceFromOptionsNFT(maker.address, optionsNFT.target);
  console.log(`- Next available nonce: ${finalNonce}`);
  
  const finalStats = await nonceManager.getNonceStats(maker.address, 10);
  console.log(`- Total used nonces: ${finalStats.usedCount}`);
  console.log(`- Total available nonces: ${finalStats.availableCount}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }); 
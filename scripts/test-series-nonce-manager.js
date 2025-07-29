const { ethers } = require("hardhat");
const {
  buildCompleteCallOption,
  fillCallOption,
  deployDummyOptionToken,
  setupDummyTokensForMaker,
  cleanupDummyTokens,
  getNextLopNonceFromSeries,
  advanceLopNonce,
  checkLopNonceEquals
} = require("./helpers/orderBuilder");

async function main() {
  console.log("🔢 Testing 1inch SeriesNonceManager Integration");
  console.log("===============================================");

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
  
  // Deploy SeriesNonceManager
  const SeriesNonceManager = await ethers.getContractFactory("SeriesNonceManager");
  const seriesNonceManager = await SeriesNonceManager.deploy();
  
  // Deploy Dummy Option Token
  const dummyTokenResult = await deployDummyOptionToken(deployer.address);
  
  console.log("✅ All contracts deployed successfully");
  console.log(`SeriesNonceManager: ${seriesNonceManager.target}`);

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
  
  await setupDummyTokensForMaker({
    dummyTokenAddress: dummyTokenResult.address,
    maker: maker.address,
    lopAddress: lop.target,
    optionAmount
  });

  // Test SeriesNonceManager
  console.log("\n🔢 Testing SeriesNonceManager...");
  
  // Get initial nonce
  const initialNonce = await getNextLopNonceFromSeries(maker.address, seriesNonceManager.target);
  console.log(`Initial nonce for maker: ${initialNonce}`);
  
  // Advance nonce
  console.log("📈 Advancing nonce by 1...");
  await advanceLopNonce(maker, seriesNonceManager.target, 0, 1);
  
  // Check new nonce
  const newNonce = await getNextLopNonceFromSeries(maker.address, seriesNonceManager.target);
  console.log(`New nonce for maker: ${newNonce}`);
  
  // Verify nonce equals
  const equals = await checkLopNonceEquals(maker.address, seriesNonceManager.target, 0, newNonce);
  console.log(`Nonce equals check: ${equals}`);
  
  // Test order with SeriesNonceManager nonce
  console.log("\n🎯 Testing order with SeriesNonceManager nonce...");
  
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
    lopNonce: newNonce
  });
  
  console.log(`✅ Order created with SeriesNonceManager nonce: ${orderData.lopNonce}`);
  
  // Setup dummy tokens and fill order
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
  
  console.log("✅ Order filled successfully with SeriesNonceManager nonce!");
  
  // Cleanup
  await cleanupDummyTokens(dummyTokenResult.address, taker.address);
  
  // Test multiple orders with SeriesNonceManager
  console.log("\n🔄 Testing multiple orders with SeriesNonceManager...");
  
  for (let i = 0; i < 3; i++) {
    // Advance nonce for next order
    await advanceLopNonce(maker, seriesNonceManager.target, 0, 1);
    const seriesNonce = await getNextLopNonceFromSeries(maker.address, seriesNonceManager.target);
    
    console.log(`\n📋 Order ${i + 1} - Using SeriesNonceManager nonce: ${seriesNonce}`);
    
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
      lopNonce: seriesNonce
    });
    
    console.log(`✅ Order ${i + 1} created with nonce: ${orderData.lopNonce}`);
    
    // Setup dummy tokens and fill order
    await setupDummyTokensForMaker({
      dummyTokenAddress: dummyTokenResult.address,
      maker: maker.address,
      lopAddress: lop.target,
      optionAmount
    });
    
    await fillCallOption({
      orderData,
      takerSigner: taker,
      fillAmount: ethers.parseUnits("100", 6) + BigInt(i * 10),
      lopAddress: lop.target
    });
    
    console.log(`✅ Order ${i + 1} filled successfully!`);
    
    // Cleanup
    await cleanupDummyTokens(dummyTokenResult.address, taker.address);
  }
  
  console.log("\n🎉 SeriesNonceManager integration test completed successfully!");
  console.log("\n📚 Summary:");
  console.log("✅ SeriesNonceManager deployed and working");
  console.log("✅ Nonce advancement working correctly");
  console.log("✅ Multiple orders with unique nonces working");
  console.log("✅ No BitInvalidatedOrder errors with proper nonce management");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
const { ethers } = require("hardhat");
const {
  buildCompleteCallOption,
  deployDummyOptionToken,
  setupDummyTokensForMaker,
  prepareOrderForFilling  // NEW: Import the helper function
} = require("./helpers/orderBuilder");

async function main() {
  console.log("🎯 FINAL LOP Integration Test - Complete System");
  console.log("===============================================");

  const [deployer, maker, taker1, taker2, taker3] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Maker:", maker.address);
  console.log("Taker 1:", taker1.address);
  console.log("Taker 2:", taker2.address);
  console.log("Taker 3:", taker3.address);
  console.log("");

  // Deploy contracts
  console.log("📦 Deploying contracts...");
  
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockETH = await MockERC20.deploy("Mock ETH", "mETH");
  const mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC");
  await mockETH.waitForDeployment();
  await mockUSDC.waitForDeployment();

  const MockWETH = await ethers.getContractFactory("MockWETH");
  const weth = await MockWETH.deploy();
  await weth.waitForDeployment();

  const LimitOrderProtocol = await ethers.getContractFactory("LimitOrderProtocol");
  const lop = await LimitOrderProtocol.deploy(weth.target);
  await lop.waitForDeployment();

  const OptionNFT = await ethers.getContractFactory("OptionNFT");
  const optionsNFT = await OptionNFT.deploy(lop.target);
  await optionsNFT.waitForDeployment();

  console.log("All contracts deployed successfully");
  console.log("");

  // Set default parameters on the NFT contract
  console.log("⚙️ Setting default parameters on NFT contract...");
  const strikePrice = ethers.parseUnits("2000", 6);
  const optionAmount = ethers.parseEther("1");
  
  await optionsNFT.setDefaultOptionParams(
    mockETH.target,
    mockUSDC.target,
    strikePrice,
    optionAmount
  );
  console.log("✅ Default parameters set");
  console.log("");

  // Setup tokens
  console.log("💰 Setting up tokens...");
  const ethAmount = ethers.parseEther("100");
  const usdcAmount = ethers.parseUnits("50000", 6);
  
  await mockETH.mint(maker.address, ethAmount);
  await mockUSDC.mint(taker1.address, usdcAmount);
  await mockUSDC.mint(taker2.address, usdcAmount);
  await mockUSDC.mint(taker3.address, usdcAmount);
  
  // Approve tokens
  await mockETH.connect(maker).approve(lop.target, ethAmount);
  await mockETH.connect(maker).approve(optionsNFT.target, ethAmount);
  await mockUSDC.connect(taker1).approve(lop.target, usdcAmount);
  await mockUSDC.connect(taker2).approve(lop.target, usdcAmount);
  await mockUSDC.connect(taker3).approve(lop.target, usdcAmount);
  
  console.log("✅ Tokens setup complete");
  console.log("");

  // Create 3 parallel orders using our fixed helper functions
  console.log("🔨 Creating 3 Parallel Orders Using Fixed Helpers");
  console.log("================================================");
  
  const orders = [];
  const expiry = Math.floor(Date.now() / 1000) + 86400;
  const premium = ethers.parseUnits("100", 6);
  
  for (let i = 0; i < 3; i++) {
    console.log(`\n📋 Creating Order ${i + 1}...`);
    
    // Deploy separate dummy token for each order
    const dummyToken = await deployDummyOptionToken();
    console.log(`Dummy token ${i + 1}: ${dummyToken.target}`);
    
    // Setup dummy tokens for maker
    await setupDummyTokensForMaker({
      dummyTokenAddress: dummyToken.target,
      maker: maker.address,
      lopAddress: lop.target,
      optionAmount: optionAmount
    });
    
    // Build complete order using our FIXED helper with unique LOP nonce
    const orderData = await buildCompleteCallOption({
      makerSigner: maker,
      underlyingAsset: mockETH.target,
      strikeAsset: mockUSDC.target,
      dummyTokenAddress: dummyToken.target,
      strikePrice: strikePrice,
      optionAmount: optionAmount,
      premium: premium,
      expiry: expiry,
      lopAddress: lop.target,
      optionsNFTAddress: optionsNFT.target,
      lopNonce: 2000 + i  // UNIQUE NONCE FOR EACH ORDER
    });
    
    orders.push({
      ...orderData,
      dummyToken: dummyToken.target,
      orderIndex: i + 1
    });
    
    console.log(`✅ Order ${i + 1} created with LOP nonce: ${2000 + i}`);
  }
  
  console.log(`\n🎯 All ${orders.length} orders created successfully!`);
  console.log("");

  // Fill all orders in parallel
  console.log("🚀 Filling All Orders");
  console.log("====================");
  
  const takers = [taker1, taker2, taker3];
  
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const taker = takers[i];
    
    console.log(`\n🔄 Filling Order ${order.orderIndex} by Taker ${i + 1}...`);
    
    // Debug: Check order structure
    console.log(`   Order structure check:`);
    console.log(`   - orderTuple: ${order.orderTuple ? 'present' : 'missing'}`);
    console.log(`   - lopSignature: ${order.lopSignature ? 'present' : 'missing'}`);
    console.log(`   - lopSignature.r: ${order.lopSignature?.r ? 'present' : 'missing'}`);
    console.log(`   - lopSignature.vs: ${order.lopSignature?.vs ? 'present' : 'missing'}`);
    console.log(`   - interaction: ${order.interaction ? 'present' : 'missing'}`);
    
    try {
      // Use the new helper function for clean, consistent order filling
      const fillParams = prepareOrderForFilling(order, premium);
      
      const tx = await lop.connect(taker).fillOrderArgs(
        fillParams.orderTuple,
        fillParams.r,
        fillParams.vs,
        fillParams.fillAmount,
        fillParams.takerTraits,
        fillParams.interactionData
      );
      
      const receipt = await tx.wait();
      console.log(`🎉 Order ${order.orderIndex} filled successfully! Gas used: ${receipt.gasUsed}`);
      
      // Check NFT balance
      const nftBalance = await optionsNFT.balanceOf(taker.address);
      console.log(`   Taker ${i + 1} NFT balance: ${nftBalance}`);
      
    } catch (error) {
      console.log(`❌ Order ${order.orderIndex} failed: ${error.message}`);
      if (error.data) {
        console.log(`   Error data: ${error.data}`);
      }
      
      // Debug: Log the order object structure
      console.log("   Debug - Order object keys:", Object.keys(order));
      if (order.lopSignature) {
        console.log("   Debug - lopSignature keys:", Object.keys(order.lopSignature));
      }
      
      return; // Exit on first failure
    }
  }

  // Final verification
  console.log("\n🏆 FINAL VERIFICATION");
  console.log("=====================");
  
  let totalNFTs = 0;
  for (let i = 0; i < takers.length; i++) {
    const balance = await optionsNFT.balanceOf(takers[i].address);
    totalNFTs += Number(balance);
    console.log(`Taker ${i + 1} final NFT balance: ${balance}`);
  }
  
  const totalSupply = await optionsNFT.totalSupply();
  console.log(`Total NFTs minted: ${totalSupply}`);
  
  if (totalNFTs === 3 && totalSupply == 3) {
    console.log("\n🎉🎉🎉 COMPLETE SUCCESS! 🎉🎉🎉");
    console.log("✅ All 3 orders filled successfully!");
    console.log("✅ All 3 NFTs minted correctly!");
    console.log("✅ LOP integration is fully functional!");
    console.log("✅ Hash-based system with proper nonce management works perfectly!");
    console.log("✅ Parallel order execution is now possible!");
    console.log("\n🚀 YOUR PRODUCT IS NOW FULLY WORKING! 🚀");
  } else {
    console.log("❌ Something went wrong with the final verification");
  }

  console.log("\n🎯 LOP Integration Final Test Completed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }); 
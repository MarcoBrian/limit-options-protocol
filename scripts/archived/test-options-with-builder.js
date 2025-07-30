const { ethers } = require("hardhat");
const {
  buildCompleteCallOption,
  fillCallOption,
  deployDummyOptionToken,
  setupDummyTokensForMaker,
  cleanupDummyTokens
} = require("./helpers/orderBuilder");
const { createOrderHashManager } = require("./helpers/nonceManager");

async function main() {
  console.log("🚀 Testing ETH Call Option with OrderBuilder (Dummy Token Approach)");
  console.log("==================================================================");

  // Get signers
  const [deployer, maker, taker] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Maker: ${maker.address}`);
  console.log(`Taker: ${taker.address}`);

  // Deploy mock tokens
  console.log("\n📦 Deploying Mock Tokens...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockETH = await MockERC20.deploy("Mock ETH", "mETH");
  const mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC");
  
  console.log(`Mock ETH deployed: ${mockETH.target}`);
  console.log(`Mock USDC deployed: ${mockUSDC.target}`);

  // Deploy WETH
  console.log("\n📦 Deploying Mock WETH...");
  const MockWETH = await ethers.getContractFactory("MockWETH");
  const weth = await MockWETH.deploy();
  console.log(`WETH deployed: ${weth.target}`);

  // Deploy Limit Order Protocol
  console.log("\n📦 Deploying Limit Order Protocol...");
  const LimitOrderProtocol = await ethers.getContractFactory("LimitOrderProtocol");
  const lop = await LimitOrderProtocol.deploy(weth.target);
  console.log(`LOP deployed: ${lop.target}`);

  // Deploy Options NFT
  console.log("\n📦 Deploying Options NFT...");
  const OptionNFT = await ethers.getContractFactory("OptionNFT");
  const optionsNFT = await OptionNFT.deploy(lop.target);
  console.log(`Options NFT deployed: ${optionsNFT.target}`);

  // Deploy Dummy Option Token using helper
  console.log("\n📦 Deploying Dummy Option Token...");
  const dummyTokenResult = await deployDummyOptionToken(deployer.address);
  console.log(`Dummy Option Token deployed: ${dummyTokenResult.address}`);

  // Mint tokens to maker and taker
  console.log("\n💰 Minting tokens...");
  const ethAmount = ethers.parseEther("10"); // 10 ETH to maker
  const usdcAmount = ethers.parseUnits("10000", 6); // 10,000 USDC to taker
  
  await mockETH.mint(maker.address, ethAmount);
  await mockUSDC.mint(taker.address, usdcAmount);
  
  console.log(`Minted ${ethers.formatEther(ethAmount)} Mock ETH to maker`);
  console.log(`Minted ${ethers.formatUnits(usdcAmount, 6)} Mock USDC to taker`);

  // Approve tokens
  console.log("\n✅ Approving tokens...");
  await mockETH.connect(maker).approve(lop.target, ethAmount);
  await mockETH.connect(maker).approve(optionsNFT.target, ethAmount); // For collateral
  await mockUSDC.connect(taker).approve(lop.target, usdcAmount);
  console.log("Tokens approved for LOP and OptionsNFT");

  // Option parameters
  const optionAmount = ethers.parseEther("1"); // 1 ETH call option
  const strikePrice = ethers.parseUnits("2000", 6); // Strike price: 2000 USDC per ETH
  const premium = ethers.parseUnits("100", 6); // 100 USDC premium
  const expiry = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

  // Set default parameters on the NFT contract
  console.log("\n⚙️ Setting default parameters on NFT contract...");
  await optionsNFT.setDefaultOptionParams(
    mockETH.target,    // underlyingAsset
    mockUSDC.target,   // strikeAsset  
    strikePrice,       // strikePrice
    optionAmount       // amount
  );
  console.log("Default parameters set on NFT contract");

  // Setup dummy tokens for maker using helper
  console.log("\n🔧 Setting up dummy tokens for maker...");
  await setupDummyTokensForMaker({
    dummyTokenAddress: dummyTokenResult.address,
    maker: maker.address,
    lopAddress: lop.target,
    optionAmount
  });

  // Demonstrate order hash management
  console.log("\n🔢 Testing order hash management...");
  const orderHashManager = createOrderHashManager(optionsNFT.target);
  
  // Generate a sample salt
  const sampleSalt = orderHashManager.generateUniqueSalt(maker.address, {
    underlyingAsset: mockETH.target,
    strikeAsset: mockUSDC.target,
    strikePrice: strikePrice,
    expiry: expiry,
    optionAmount: optionAmount
  });
  console.log(`Generated sample salt: ${sampleSalt}`);

  // Build complete call option using orderBuilder
  console.log("\n📝 Building complete call option order...");
  const orderData = await buildCompleteCallOption({
    makerSigner: maker,
    underlyingAsset: mockETH.target,
    strikeAsset: mockUSDC.target,
    dummyTokenAddress: dummyTokenResult.address,
    strikePrice,
    optionAmount,
    premium,
    expiry,
    lopAddress: lop.target,
    optionsNFTAddress: optionsNFT.target,
    salt: 1  // Changed from nonce to salt
  });

  console.log("Call Option Order parameters:");
  console.log(`- Strike Price: ${ethers.formatUnits(strikePrice, 6)} USDC per ETH`);
  console.log(`- Expiry: ${new Date(expiry * 1000).toISOString()}`);
  console.log(`- Option Amount: ${ethers.formatEther(optionAmount)} ETH`);
  console.log(`- Premium: ${ethers.formatUnits(premium, 6)} USDC`);
  console.log(`- Dummy Token: ${dummyTokenResult.address}`);

  // Check balances before
  console.log("\n💰 Checking balances before fill...");
  const makerETHBefore = await mockETH.balanceOf(maker.address);
  const makerUSDCBefore = await mockUSDC.balanceOf(maker.address);
  const makerDummyBefore = await dummyTokenResult.contract.balanceOf(maker.address);
  const takerETHBefore = await mockETH.balanceOf(taker.address);
  const takerUSDCBefore = await mockUSDC.balanceOf(taker.address);
  const takerDummyBefore = await dummyTokenResult.contract.balanceOf(taker.address);
  
  console.log(`Maker ETH: ${ethers.formatEther(makerETHBefore)}`);
  console.log(`Maker USDC: ${ethers.formatUnits(makerUSDCBefore, 6)}`);
  console.log(`Maker Dummy: ${ethers.formatEther(makerDummyBefore)}`);
  console.log(`Taker ETH: ${ethers.formatEther(takerETHBefore)}`);
  console.log(`Taker USDC: ${ethers.formatUnits(takerUSDCBefore, 6)}`);
  console.log(`Taker Dummy: ${ethers.formatEther(takerDummyBefore)}`);

  // Fill the order using orderBuilder
  console.log("\n🔄 Filling order with NFT minting...");
  try {
    const tx = await fillCallOption({
      orderData,
      takerSigner: taker,
      fillAmount: premium, // Fill complete premium
      lopAddress: lop.target
    });
    
    const receipt = await tx.wait();
    console.log(`✅ Order filled successfully with NFT minting!`);
    console.log(`Transaction hash: ${receipt.hash}`);
    
    // Check balances after
    console.log("\n💰 Checking balances after fill...");
    const makerETHAfter = await mockETH.balanceOf(maker.address);
    const makerUSDCAfter = await mockUSDC.balanceOf(maker.address);
    const makerDummyAfter = await dummyTokenResult.contract.balanceOf(maker.address);
    const takerETHAfter = await mockETH.balanceOf(taker.address);
    const takerUSDCAfter = await mockUSDC.balanceOf(taker.address);
    const takerDummyAfter = await dummyTokenResult.contract.balanceOf(taker.address);
    
    console.log(`Maker ETH: ${ethers.formatEther(makerETHAfter)} (${ethers.formatEther(makerETHAfter - makerETHBefore)})`);
    console.log(`Maker USDC: ${ethers.formatUnits(makerUSDCAfter, 6)} (${ethers.formatUnits(makerUSDCAfter - makerUSDCBefore, 6)})`);
    console.log(`Maker Dummy: ${ethers.formatEther(makerDummyAfter)} (${ethers.formatEther(makerDummyAfter - makerDummyBefore)})`);
    console.log(`Taker ETH: ${ethers.formatEther(takerETHAfter)} (${ethers.formatEther(takerETHAfter - takerETHBefore)})`);
    console.log(`Taker USDC: ${ethers.formatUnits(takerUSDCAfter, 6)} (${ethers.formatUnits(takerUSDCAfter - takerUSDCBefore, 6)})`);
    console.log(`Taker Dummy: ${ethers.formatEther(takerDummyAfter)} (${ethers.formatEther(takerDummyAfter - takerDummyBefore)})`);

    // Check NFT ownership
    console.log("\n🖼️ Checking NFT ownership...");
    const takerNFTCount = await optionsNFT.balanceOf(taker.address);
    console.log(`Taker NFT count: ${takerNFTCount}`);
    
    if (takerNFTCount > 0) {
      const tokenId = await optionsNFT.tokenOfOwnerByIndex(taker.address, 0);
      console.log(`Taker's first NFT ID: ${tokenId}`);
      
      // Get option details
      const option = await optionsNFT.getOption(tokenId);
      console.log(`Option details:`);
      console.log(`- Underlying Asset: ${option.underlyingAsset}`);
      console.log(`- Strike Asset: ${option.strikeAsset}`);
      console.log(`- Maker: ${option.maker}`);
      console.log(`- Strike Price: ${ethers.formatUnits(option.strikePrice, 6)} USDC`);
      console.log(`- Expiry: ${new Date(Number(option.expiry) * 1000).toISOString()}`);
      console.log(`- Amount: ${ethers.formatEther(option.amount)} ETH`);
      console.log(`- Exercised: ${option.exercised}`);
      
      console.log("✅ NFT successfully minted with full option data!");
    }
    
    // Cleanup dummy tokens using helper
    console.log("\n🔥 Cleaning up dummy tokens...");
    await cleanupDummyTokens(dummyTokenResult.address, taker.address);
    
    console.log("\n🎉 ETH Call Option test completed successfully!");
    
  } catch (error) {
    console.error("❌ Error filling order:", error.message);
    console.error("Full error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
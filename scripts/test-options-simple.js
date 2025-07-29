const { ethers } = require("hardhat");
const { 
  buildCompleteCallOption, 
  fillCallOption 
} = require("./helpers/orderBuilder");

async function main() {
  console.log("🚀 Simple Call Option Example");
  console.log("===============================");

  // Get signers
  const [deployer, maker, taker] = await ethers.getSigners();
  console.log(`Maker: ${maker.address}`);
  console.log(`Taker: ${taker.address}`);

  // Deploy contracts (simplified)
  console.log("\n📦 Deploying contracts...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockETH = await MockERC20.deploy("Mock ETH", "mETH");
  const mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC");
  
  const MockWETH = await ethers.getContractFactory("MockWETH");
  const weth = await MockWETH.deploy();
  
  const LimitOrderProtocol = await ethers.getContractFactory("LimitOrderProtocol");
  const lop = await LimitOrderProtocol.deploy(weth.target);
  
  const OptionNFT = await ethers.getContractFactory("OptionNFT");
  const optionsNFT = await OptionNFT.deploy(lop.target);

  console.log(`Mock ETH: ${mockETH.target}`);
  console.log(`Mock USDC: ${mockUSDC.target}`);
  console.log(`LOP: ${lop.target}`);
  console.log(`OptionsNFT: ${optionsNFT.target}`);

  // Mint tokens
  console.log("\n💰 Minting tokens...");
  await mockETH.mint(maker.address, ethers.parseEther("10"));
  await mockUSDC.mint(taker.address, ethers.parseUnits("10000", 6));
  
  // Approve tokens
  console.log("\n✅ Approving tokens...");
  await mockETH.connect(maker).approve(lop.target, ethers.parseEther("10"));
  await mockETH.connect(maker).approve(optionsNFT.target, ethers.parseEther("10"));
  await mockUSDC.connect(taker).approve(lop.target, ethers.parseUnits("10000", 6));

  // Set default parameters on NFT contract
  console.log("\n⚙️ Setting default parameters...");
  await optionsNFT.setDefaultOptionParams(
    mockETH.target,
    mockUSDC.target,
    ethers.parseUnits("2000", 6),
    ethers.parseEther("1")
  );

  // 🎯 SUPER SIMPLE: Build complete call option with one function call!
  console.log("\n🎯 Building call option order...");
  const orderData = await buildCompleteCallOption({
    maker: maker.address,
    underlyingAsset: mockETH.target,
    strikeAsset: mockUSDC.target,
    strikePrice: ethers.parseUnits("2000", 6),  // 2000 USDC per ETH
    optionAmount: ethers.parseEther("1"),       // 1 ETH option
    premium: ethers.parseUnits("100", 6),       // 100 USDC premium
    expiry: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    lopAddress: lop.target,
    optionsNFTAddress: optionsNFT.target,
    nonce: 1
  });

  console.log("✅ Order built successfully!");
  console.log(`- Strike Price: ${ethers.formatUnits(orderData.optionParams.strikePrice, 6)} USDC`);
  console.log(`- Option Amount: ${ethers.formatEther(orderData.optionParams.optionAmount)} ETH`);
  console.log(`- Premium: ${ethers.formatUnits(orderData.optionParams.premium, 6)} USDC`);
  console.log(`- Expiry: ${new Date(Number(orderData.optionParams.expiry) * 1000).toISOString()}`);

  // Check balances before
  console.log("\n💰 Balances before fill:");
  const makerETHBefore = await mockETH.balanceOf(maker.address);
  const makerUSDCBefore = await mockUSDC.balanceOf(maker.address);
  const takerETHBefore = await mockETH.balanceOf(taker.address);
  const takerUSDCBefore = await mockUSDC.balanceOf(taker.address);
  
  console.log(`Maker ETH: ${ethers.formatEther(makerETHBefore)}`);
  console.log(`Maker USDC: ${ethers.formatUnits(makerUSDCBefore, 6)}`);
  console.log(`Taker ETH: ${ethers.formatEther(takerETHBefore)}`);
  console.log(`Taker USDC: ${ethers.formatUnits(takerUSDCBefore, 6)}`);

  // 🎯 SUPER SIMPLE: Fill the order with one function call!
  console.log("\n🔄 Filling call option order...");
  const fillAmount = orderData.optionParams.premium; // Fill complete premium (100 USDC)
  
  const tx = await fillCallOption({
    orderData,
    taker: taker.address,
    fillAmount,
    lopAddress: lop.target
  });

  const receipt = await tx.wait();
  console.log(`✅ Order filled successfully!`);
  console.log(`Transaction hash: ${receipt.hash}`);

  // Check balances after
  console.log("\n💰 Balances after fill:");
  const makerETHAfter = await mockETH.balanceOf(maker.address);
  const makerUSDCAfter = await mockUSDC.balanceOf(maker.address);
  const takerETHAfter = await mockETH.balanceOf(taker.address);
  const takerUSDCAfter = await mockUSDC.balanceOf(taker.address);
  
  console.log(`Maker ETH: ${ethers.formatEther(makerETHAfter)} (${ethers.formatEther(makerETHAfter - makerETHBefore)})`);
  console.log(`Maker USDC: ${ethers.formatUnits(makerUSDCAfter, 6)} (${ethers.formatUnits(makerUSDCAfter - makerUSDCBefore, 6)})`);
  console.log(`Taker ETH: ${ethers.formatEther(takerETHAfter)} (${ethers.formatEther(takerETHAfter - takerETHBefore)})`);
  console.log(`Taker USDC: ${ethers.formatUnits(takerUSDCAfter, 6)} (${ethers.formatUnits(takerUSDCAfter - takerUSDCBefore, 6)})`);

  // Check NFT ownership
  console.log("\n🖼️ Checking NFT ownership...");
  const takerNFTCount = await optionsNFT.balanceOf(taker.address);
  console.log(`Taker NFT count: ${takerNFTCount}`);
  
  if (takerNFTCount > 0) {
    const tokenId = await optionsNFT.tokenOfOwnerByIndex(taker.address, 0);
    console.log(`Taker's first NFT ID: ${tokenId}`);
    
    const option = await optionsNFT.getOption(tokenId);
    console.log(`Option details:`);
    console.log(`- Strike Price: ${ethers.formatUnits(option.strikePrice, 6)} USDC`);
    console.log(`- Amount: ${ethers.formatEther(option.amount)} ETH`);
    console.log(`- Expiry: ${new Date(Number(option.expiry) * 1000).toISOString()}`);
    console.log(`- Exercised: ${option.exercised}`);
    
    console.log("✅ NFT successfully minted!");
  }
  
  console.log("\n🎉 Simple call option test completed!");
  console.log("\n📝 Summary:");
  console.log("- Maker created a call option order with automatic signature");
  console.log("- Taker filled the order and received an NFT");
  console.log("- No direct ETH transfer (makingAmount = 0)");
  console.log("- Only premium payment and NFT minting");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
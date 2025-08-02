const { ethers } = require('hardhat');
const { loadContractAddresses } = require('../scripts/utils/envLoader');

async function mintTokensToMaker() {
  console.log('💰 Minting tokens to maker...');
  
  try {
    // Load contract addresses from environment
    const addresses = loadContractAddresses({ 
      required: true, 
      envPath: require('path').join(__dirname, '..', '.env') 
    });
    
    console.log('✅ Using contract addresses from .env:');
    console.log(`   DummyToken: ${addresses.dummyTokenAddress}`);
    console.log(`   MockETH: ${addresses.mockETHAddress}`);
    console.log(`   MockUSDC: ${addresses.mockUSDCAddress}`);
    console.log(`   LOP: ${addresses.lopAddress}`);
    console.log(`   OptionsNFT: ${addresses.optionsNFTAddress}`);
    
    // Get contract instances
    const dummyToken = await ethers.getContractAt("MockERC20", addresses.dummyTokenAddress);
    const mockETH = await ethers.getContractAt("MockERC20", addresses.mockETHAddress);
    const mockUSDC = await ethers.getContractAt("MockERC20", addresses.mockUSDCAddress);
    
    // Maker address (the one who created the order)
    const makerAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    
    console.log('\n🔍 Checking current balances...');
    const dummyBalance = await dummyToken.balanceOf(makerAddress);
    const ethBalance = await mockETH.balanceOf(makerAddress);
    const usdcBalance = await mockUSDC.balanceOf(makerAddress);
    
    console.log(`   DummyToken Balance: ${ethers.formatEther(dummyBalance)} tokens`);
    console.log(`   MockETH Balance: ${ethers.formatEther(ethBalance)} tokens`);
    console.log(`   MockUSDC Balance: ${ethers.formatUnits(usdcBalance, 6)} tokens`);
    
    // Mint tokens to maker
    console.log('\n💰 Minting tokens to maker...');
    const mintAmount = ethers.parseEther("10"); // 10 tokens
    const usdcMintAmount = ethers.parseUnits("1000000", 6); // 1M USDC
    
    await dummyToken.mint(makerAddress, mintAmount);
    await mockETH.mint(makerAddress, mintAmount);
    await mockUSDC.mint(makerAddress, usdcMintAmount);
    
    console.log('✅ Tokens minted successfully');
    
    // Check new balances
    console.log('\n🔍 Checking new balances...');
    const newDummyBalance = await dummyToken.balanceOf(makerAddress);
    const newEthBalance = await mockETH.balanceOf(makerAddress);
    const newUsdcBalance = await mockUSDC.balanceOf(makerAddress);
    
    console.log(`   DummyToken Balance: ${ethers.formatEther(newDummyBalance)} tokens`);
    console.log(`   MockETH Balance: ${ethers.formatEther(newEthBalance)} tokens`);
    console.log(`   MockUSDC Balance: ${ethers.formatUnits(newUsdcBalance, 6)} tokens`);
    
    // Approve LOP to spend tokens
    console.log('\n🔐 Approving LOP to spend tokens...');
    await dummyToken.connect(await ethers.getSigner(makerAddress)).approve(addresses.lopAddress, mintAmount);
    await mockETH.connect(await ethers.getSigner(makerAddress)).approve(addresses.lopAddress, mintAmount);
    await mockUSDC.connect(await ethers.getSigner(makerAddress)).approve(addresses.lopAddress, usdcMintAmount);
    
    console.log('✅ Approvals completed');
    
    console.log('\n🎉 Maker is now ready to fulfill orders!');
    
  } catch (error) {
    console.error('❌ Error minting tokens:', error.message);
  }
}

mintTokensToMaker(); 
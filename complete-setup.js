const { ethers } = require('hardhat');

async function completeSetup() {
  console.log('🚀 COMPLETE OPTIONS PROTOCOL SETUP\n');
  
  try {
    // Step 1: Load existing contract addresses
    console.log('📦 Step 1: Loading existing contract addresses from .env...');
    require('dotenv').config();
    
    console.log('✅ Using existing deployed contracts:');
    console.log('   LOP:', process.env.LOP_ADDRESS);
    console.log('   OptionsNFT:', process.env.OPTIONS_NFT_ADDRESS);
    console.log('   MockETH:', process.env.MOCK_ETH_ADDRESS);
    console.log('   MockUSDC:', process.env.MOCK_USDC_ADDRESS);
    
    // Step 2: Get signers and contract instances
    console.log('\n📋 Step 2: Getting signers and contract instances...');
    const [deployer, secondAccount, thirdAccount] = await ethers.getSigners();
    
    // Use specific addresses as requested
    const maker = deployer;        // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
    const taker = secondAccount;   // 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
    
    console.log('   Deployer:', deployer.address);
    console.log('   Maker:', maker.address);
    console.log('   Taker:', taker.address);
    
    const mockETH = await ethers.getContractAt('MockERC20', process.env.MOCK_ETH_ADDRESS);
    const mockUSDC = await ethers.getContractAt('MockERC20', process.env.MOCK_USDC_ADDRESS);
    const dummyToken = await ethers.getContractAt('MockERC20', process.env.DUMMY_TOKEN_ADDRESS);
    
    console.log('   MockETH:', process.env.MOCK_ETH_ADDRESS);
    console.log('   MockUSDC:', process.env.MOCK_USDC_ADDRESS);
    console.log('   DummyToken:', process.env.DUMMY_TOKEN_ADDRESS);
    console.log('   LOP:', process.env.LOP_ADDRESS);
    console.log('   OptionsNFT:', process.env.OPTIONS_NFT_ADDRESS);
    
    // Step 3: Use the signer objects (not string addresses)  
    console.log('\n👥 Step 3: Account setup...');
    console.log('   Maker (order creator):', maker.address);
    console.log('   Taker (option buyer):', taker.address); 
    
    // Step 4: Mint tokens
    console.log('\n💰 Step 4: Minting tokens...');
    const mintAmount = ethers.parseEther("100");
    const usdcMintAmount = ethers.parseUnits("1000000", 6);
    
    // Mint to maker (needs ETH for collateral, dummy tokens for orders)
    await mockETH.connect(deployer).mint(maker.address, mintAmount);
    await dummyToken.connect(deployer).mint(maker.address, mintAmount);
    console.log('   ✅ Minted ETH and dummy tokens to maker');
    
    // Mint to taker (needs USDC for premiums)
    await mockUSDC.connect(deployer).mint(taker.address, usdcMintAmount);
    console.log('   ✅ Minted USDC to taker');
    
    // Maker approvals
    await dummyToken.connect(maker).approve(process.env.LOP_ADDRESS, mintAmount);
    await mockETH.connect(maker).approve(process.env.OPTIONS_NFT_ADDRESS, mintAmount); 
    console.log('   ✅ Maker approved LOP for dummy tokens');
    console.log('   ✅ Maker approved OptionsNFT for ETH collateral');
    
    // Taker approvals
    await mockUSDC.connect(taker).approve(process.env.LOP_ADDRESS, usdcMintAmount);
    console.log('   ✅ Taker approved LOP for USDC premiums');
    
    // Step 6: Verify setup
    console.log('\n🔍 Step 6: Verifying setup...');
    const makerETH = await mockETH.balanceOf(maker.address);
    const takerUSDC = await mockUSDC.balanceOf(taker.address);
    // const ethApproval = await mockETH.allowance(maker.address, process.env.OPTIONS_NFT_ADDRESS);
    
    console.log('   Maker ETH balance:', ethers.formatEther(makerETH));
    console.log('   Taker USDC balance:', ethers.formatUnits(takerUSDC, 6));
    // console.log('   ETH approval to OptionsNFT:', ethers.formatEther(ethApproval));
    
    // if (ethApproval > 0) {
    //   console.log('\n🎉 SUCCESS! All approvals are set correctly!');
    //   console.log('💡 The maker can now provide ETH collateral when options are bought');
    //   console.log('💡 You can now create and buy options without balance errors');
    // }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

completeSetup();
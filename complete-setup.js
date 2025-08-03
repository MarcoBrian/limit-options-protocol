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
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    
    // Check how many signers we have and assign accounts accordingly
    console.log(`   Available signers: ${signers.length}`);
    
    // Set up maker and taker based on available signers
    const maker = deployer;
    const taker = signers.length >= 2 ? signers[1] : deployer;
    
    console.log('   Deployer:', deployer.address);
    console.log('   Maker:', maker.address);
    console.log('   Taker:', taker.address);
    
    if (maker.address === taker.address) {
      console.log('   ℹ️  Note: Using same account for maker and taker (testnet setup)');
    }
    
    const mockETH = await ethers.getContractAt('MockERC20', process.env.MOCK_ETH_ADDRESS);
    const mockUSDC = await ethers.getContractAt('MockERC20', process.env.MOCK_USDC_ADDRESS);
    const dummyToken = await ethers.getContractAt('MockERC20', process.env.DUMMY_TOKEN_ADDRESS);
    
    console.log('   MockETH:', process.env.MOCK_ETH_ADDRESS);
    console.log('   MockUSDC:', process.env.MOCK_USDC_ADDRESS);
    console.log('   DummyToken:', process.env.DUMMY_TOKEN_ADDRESS);
    console.log('   LOP:', process.env.LOP_ADDRESS);
    console.log('   OptionsNFT:', process.env.OPTIONS_NFT_ADDRESS);
    
    // Step 3: Account setup verification
    console.log('\n👥 Step 3: Account setup verification...');
    console.log('   Ready to proceed with maker and taker accounts'); 
    
    // Step 4: Mint tokens
    console.log('\n💰 Step 4: Minting tokens...');
    const mintAmount = ethers.parseEther("100");
    const usdcMintAmount = ethers.parseUnits("1000000", 6);
    
    // Mint to maker (needs ETH for collateral)
    await mockETH.connect(deployer).mint(maker.address, mintAmount);
    // Note: DummyToken (ERC20True) always returns balance for any address, no minting needed
    console.log('   ✅ Minted ETH to maker, dummy tokens always available');
    
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
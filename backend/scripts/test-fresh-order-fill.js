const { ethers } = require('hardhat');
const axios = require('axios');
require('dotenv').config();

// Import the new envLoader utility
const { loadContractAddresses } = require('../scripts/utils/envLoader');

// Import builder helper functions
const {
  buildCompleteCallOption,
  deployDummyOptionToken,
  setupDummyTokensForMaker,
  prepareOrderForFilling
} = require('../scripts/helpers/orderBuilder');

// Import nonce manager helpers
const { 
  createOrderHashManager, 
  createRandomNonceManager
} = require('../scripts/helpers/nonceManager');

/**
 * Test filling a fresh order (like the working script)
 */
async function testFreshOrderFill() {
  console.log('🚀 Testing Fresh Order Fill (Like Working Script)\n');
  
  try {
    // Setup provider and signers using Hardhat
    const [deployer, taker] = await ethers.getSigners();
    console.log('   Deployer address:', deployer.address);
    console.log('   Taker address:', taker.address);

    // Use existing deployed contracts from environment
    console.log('\n📦 Loading existing deployed contracts from environment...');
    
    // Use the same approach as the working script
    const addresses = {
      mockETHAddress: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
      mockUSDCAddress: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
      lopAddress: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
      optionsNFTAddress: '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82',
      dummyTokenAddress: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
      backendUrl: 'http://localhost:3000'
    };
    
    console.log('✅ Using existing contracts:');
    console.log(`   MockETH: ${addresses.mockETHAddress}`);
    console.log(`   MockUSDC: ${addresses.mockUSDCAddress}`);
    console.log(`   LOP: ${addresses.lopAddress}`);
    console.log(`   OptionsNFT: ${addresses.optionsNFTAddress}`);

    // Get contract instances
    const mockETH = await ethers.getContractAt("MockERC20", addresses.mockETHAddress);
    const mockUSDC = await ethers.getContractAt("MockERC20", addresses.mockUSDCAddress);
    const lop = await ethers.getContractAt("LimitOrderProtocol", addresses.lopAddress);
    const optionsNFT = await ethers.getContractAt("OptionNFT", addresses.optionsNFTAddress);

    // Setup tokens for taker and maker
    console.log('\n📋 STEP 1: Setting up tokens for taker and maker...');
    const usdcAmount = ethers.parseUnits("50000", 6);
    await mockUSDC.mint(taker.address, usdcAmount);
    await mockUSDC.connect(taker).approve(addresses.lopAddress, usdcAmount);
    await mockUSDC.connect(taker).approve(addresses.optionsNFTAddress, usdcAmount);
    
    console.log('   ✅ Minted USDC to taker:', ethers.formatUnits(usdcAmount, 6));
    console.log('   ✅ Taker approved LOP to spend USDC');
    console.log('   ✅ Taker approved OptionsNFT to spend USDC');
    
    // Setup maker tokens (needed for OptionsNFT interaction)
    const ethAmount = ethers.parseEther("10"); // 10 ETH
    await mockETH.mint(deployer.address, ethAmount);
    await mockETH.connect(deployer).approve(addresses.optionsNFTAddress, ethAmount);
    
    console.log('   ✅ Minted MockETH to maker:', ethers.formatUnits(ethAmount, 18));
    console.log('   ✅ Maker approved OptionsNFT to spend MockETH');
    console.log('');

    // STEP 2: Create a fresh order (like the working script)
    console.log('📋 STEP 2: Creating a fresh order (like the working script)...');
    
    // Create order hash manager for OptionsNFT salt
    const hashManager = createOrderHashManager(addresses.optionsNFTAddress, ethers.provider);
    
    // Generate unique salt using hash manager
    const optionParams = {
      underlyingAsset: addresses.mockETHAddress,
      strikeAsset: addresses.mockUSDCAddress,
      strikePrice: ethers.parseUnits("3000", 6),
      expiry: Math.floor(Date.now() / 1000) + 86400,
      optionAmount: ethers.parseEther("1")
    };
    
    const salt = hashManager.generateUniqueSalt(deployer.address, optionParams);
    console.log('   ✅ Generated OptionsNFT salt:', salt);

    // Get nonce using random approach (1inch pattern)
    const nonceManager = createRandomNonceManager();
    const lopNonce = await nonceManager.getRandomNonce(deployer.address, lop);
    console.log('   ✅ Generated LOP nonce:', lopNonce);

    // Build complete call option using helper function
    const premium = ethers.parseUnits("99.97", 6);
    const expiry = Math.floor(Date.now() / 1000) + 86400;

    const completeOption = await buildCompleteCallOption({
      makerSigner: deployer,
      underlyingAsset: addresses.mockETHAddress,
      strikeAsset: addresses.mockUSDCAddress,
      dummyTokenAddress: addresses.dummyTokenAddress,
      strikePrice: optionParams.strikePrice,
      optionAmount: optionParams.optionAmount,
      premium: premium,
      expiry: expiry,
      lopAddress: addresses.lopAddress,
      optionsNFTAddress: addresses.optionsNFTAddress,
      salt: salt,
      lopNonce: lopNonce
    });

    console.log('   ✅ Fresh order created successfully');
    console.log('   ✅ Order salt:', completeOption.order.salt.toString());
    console.log('   ✅ Maker:', completeOption.originalAddresses.maker);
    console.log('   ✅ Making Amount:', completeOption.order.makingAmount.toString());
    console.log('   ✅ Taking Amount:', completeOption.order.takingAmount.toString());
    console.log('');

    // STEP 3: Prepare order for filling using helper (like working script)
    console.log('📋 STEP 3: Preparing order for filling using helper (like working script)...');
    const fillParams = prepareOrderForFilling(completeOption, premium);
    console.log('   ✅ Fill parameters prepared');
    console.log('   🔍 Order Tuple length:', fillParams.orderTuple.length);
    console.log('   🔍 R:', fillParams.r);
    console.log('   🔍 VS:', fillParams.vs);
    console.log('   🔍 Fill Amount:', fillParams.fillAmount.toString());
    console.log('   🔍 Taker Traits:', fillParams.takerTraits.toString());
    console.log('   🔍 Interaction Data length:', fillParams.interactionData.length);
    console.log('fillParams', fillParams);

    // STEP 4: Fill the order on-chain (like working script)
    console.log('📋 STEP 4: Filling order on-chain (like working script)...');
    const lopContract = await ethers.getContractAt("LimitOrderProtocol", addresses.lopAddress, taker);
    
    console.log('   🔍 Contract address:', addresses.lopAddress);
    console.log('   🔍 Taker address:', taker.address);
    console.log('   🔍 About to call fillOrderArgs...');
    
    // Use fresh interaction data from helper (like working script)
    console.log('   🔍 Using fresh interaction data from helper (like working script)...');
    
    // First, let's simulate the transaction to see what's happening
    console.log('   🔍 Simulating transaction first...');
    try {
      const simulation = await lopContract.fillOrderArgs.staticCall(
        fillParams.orderTuple,
        fillParams.r,
        fillParams.vs,
        fillParams.fillAmount,
        fillParams.takerTraits, // Use fresh taker traits from helper
        fillParams.interactionData // Use fresh interaction data from helper
      );
      console.log('   ✅ Simulation successful:', simulation);
    } catch (simError) {
      console.log('   ❌ Simulation failed:', simError.message);
      if (simError.data) {
        console.log('   🔍 Simulation error data:', simError.data);
      }
    }
    
    // Now try the actual transaction
    console.log('   🔍 Attempting actual transaction...');
    const tx = await lopContract.fillOrderArgs(
      fillParams.orderTuple,
      fillParams.r,
      fillParams.vs,
      fillParams.fillAmount,
      fillParams.takerTraits, // Use fresh taker traits from helper
      fillParams.interactionData // Use fresh interaction data from helper
    );
    
    console.log('   ✅ Transaction sent:', tx.hash);
    console.log('   🔍 Waiting for confirmation...');
    
    try {
      const receipt = await tx.wait();
      console.log('   ✅ Transaction confirmed!');
      console.log('   🔍 Gas used:', receipt.gasUsed.toString());
      
      // Check for events
      if (receipt.logs && receipt.logs.length > 0) {
        console.log('   🔍 Transaction events:');
        for (let i = 0; i < receipt.logs.length; i++) {
          console.log(`      Event ${i}:`, receipt.logs[i]);
        }
      }
      
      // Check NFT balance
      const nftBalance = await optionsNFT.balanceOf(taker.address);
      console.log(`   Taker NFT balance: ${nftBalance}`);
      
    } catch (error) {
      console.log('   ❌ Transaction failed:', error.message);
      
      // Try to get more detailed error information
      if (error.data) {
        console.log('   🔍 Error data:', error.data);
      }
      
      // Check if it's a revert with reason
      if (error.reason) {
        console.log('   🔍 Revert reason:', error.reason);
      }
      
      throw error;
    }
    console.log('');

    console.log('🎉 Fresh Order Fill Test Completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Created fresh order using buildCompleteCallOption()');
    console.log('   ✅ Used fresh interaction data from helper');
    console.log('   ✅ Used fresh taker traits from helper');
    console.log('   ✅ Filled order immediately after creation');
    console.log('   ✅ Used same approach as working script');

    return {
      completeOption,
      fillParams,
      contracts: {
        lop: addresses.lopAddress,
        optionsNFT: addresses.optionsNFTAddress,
        mockETH: addresses.mockETHAddress,
        mockUSDC: addresses.mockUSDCAddress
      }
    };

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('   Backend error:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Run fresh order test
 */
async function runFreshOrderTest() {
  console.log('🚀 Starting Fresh Order Fill Test\n');
  console.log('This test creates a fresh order like the working script\n');
  console.log('Using fresh interaction data instead of stored data\n');

  await testFreshOrderFill();
}

// Run tests if this file is executed directly
if (require.main === module) {
  runFreshOrderTest().catch(console.error);
}

module.exports = {
  testFreshOrderFill,
  runFreshOrderTest
}; 
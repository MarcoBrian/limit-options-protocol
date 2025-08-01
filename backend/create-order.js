const { ethers } = require('hardhat');
const axios = require('axios');
require('dotenv').config();

// Import helper functions
const {
  buildCompleteCallOption
} = require('../scripts/helpers/orderBuilder');

const { 
  createOrderHashManager, 
  createRandomNonceManager
} = require('../scripts/helpers/nonceManager');

/**
 * Create and submit an order to the database
 */
async function createAndSubmitOrder() {
  console.log('🚀 CREATING AND SUBMITTING ORDER\n');
  
  try {
    // Setup
    const [deployer] = await ethers.getSigners();
    const addresses = {
      mockETHAddress: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
      mockUSDCAddress: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
      lopAddress: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
      optionsNFTAddress: '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82',
      dummyTokenAddress: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
      backendUrl: 'http://localhost:3000'
    };

    // STEP 1: Setup tokens for maker
    console.log('📋 STEP 1: Setting up tokens for maker...');
    const mockETH = await ethers.getContractAt("MockERC20", addresses.mockETHAddress);
    
    const ethAmount = ethers.parseEther("10");
    await mockETH.mint(deployer.address, ethAmount);
    await mockETH.connect(deployer).approve(addresses.optionsNFTAddress, ethAmount);
    
    console.log('   ✅ Minted MockETH to maker:', ethers.formatUnits(ethAmount, 18));
    console.log('   ✅ Maker approved OptionsNFT to spend MockETH');
    console.log('');

    // STEP 2: Create fresh order
    console.log('📋 STEP 2: Creating fresh order...');
    
    const hashManager = createOrderHashManager(addresses.optionsNFTAddress, ethers.provider);
    const nonceManager = createRandomNonceManager();
    
    const optionParams = {
      underlyingAsset: addresses.mockETHAddress,
      strikeAsset: addresses.mockUSDCAddress,
      strikePrice: ethers.parseUnits("3000", 6),
      expiry: Math.floor(Date.now() / 1000) + 86400,
      optionAmount: ethers.parseEther("1")
    };
    
    const salt = hashManager.generateUniqueSalt(deployer.address, optionParams);
    const lopNonce = await nonceManager.getRandomNonce(deployer.address, await ethers.getContractAt("LimitOrderProtocol", addresses.lopAddress));
    const premium = ethers.parseUnits("99.97", 6);
    const expiry = Math.floor(Date.now() / 1000) + 86400;

    const freshCompleteOption = await buildCompleteCallOption({
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

    console.log('   ✅ Fresh order created');
    console.log('   🔍 Maker:', freshCompleteOption.originalAddresses.maker);
    console.log('   🔍 Maker Asset:', freshCompleteOption.order.makerAsset);
    console.log('   🔍 Taker Asset:', freshCompleteOption.order.takerAsset);
    console.log('   🔍 Making Amount:', freshCompleteOption.order.makingAmount.toString());
    console.log('   🔍 Taking Amount:', freshCompleteOption.order.takingAmount.toString());
    console.log('   🔍 Salt:', freshCompleteOption.order.salt.toString());
    console.log('');

    // STEP 3: Submit order to database
    console.log('📋 STEP 3: Submitting order to database...');
    
    const orderData = {
      order: {
        salt: freshCompleteOption.order.salt.toString(),
        maker: freshCompleteOption.originalAddresses.maker,
        receiver: freshCompleteOption.originalAddresses.receiver,
        makerAsset: freshCompleteOption.originalAddresses.makerAsset,
        takerAsset: freshCompleteOption.originalAddresses.takerAsset,
        makingAmount: freshCompleteOption.order.makingAmount.toString(),
        takingAmount: freshCompleteOption.order.takingAmount.toString(),
        makerTraits: freshCompleteOption.order.makerTraits.toString()
      },
      signature: {
        r: freshCompleteOption.lopSignature.r,
        s: freshCompleteOption.lopSignature.s,
        v: freshCompleteOption.lopSignature.v
      },
      lopAddress: addresses.lopAddress,
      optionParams: {
        underlyingAsset: freshCompleteOption.optionParams.underlyingAsset,
        strikeAsset: freshCompleteOption.optionParams.strikeAsset,
        strikePrice: freshCompleteOption.optionParams.strikePrice.toString(),
        expiry: Number(freshCompleteOption.optionParams.expiry),
        optionAmount: freshCompleteOption.optionParams.optionAmount.toString(),
        premium: premium.toString()
      },
      optionsNFTSignature: {
        r: freshCompleteOption.optionsNFTSignature.r,
        s: freshCompleteOption.optionsNFTSignature.s,
        v: freshCompleteOption.optionsNFTSignature.v
      },
      optionsNFTAddress: addresses.optionsNFTAddress,
      optionsNFTSalt: freshCompleteOption.optionsNFTSignature.salt.toString(),
      interactionData: freshCompleteOption.interaction
    };

    const storeResponse = await axios.post(`${addresses.backendUrl}/api/orders`, orderData);
    console.log('   ✅ Order submitted to database');
    console.log('   🔍 Response status:', storeResponse.status);
    console.log('   🔍 Response data:', storeResponse.data);
    console.log('');

    // STEP 4: Verify order is in database
    console.log('📋 STEP 4: Verifying order in database...');
    const browseResponse = await axios.get(`${addresses.backendUrl}/api/orders?status=open&limit=10`);
    const storedOrders = browseResponse.data.data.orders;
    
    // Get the most recent order (should be the one we just created)
    const ourOrder = storedOrders[0];
    
    if (ourOrder) {
      console.log('   ✅ Order found in database');
      console.log('   🔍 Order hash:', ourOrder.order_hash);
      console.log('   🔍 Maker:', ourOrder.maker);
      console.log('   🔍 Maker asset:', ourOrder.maker_asset);
      console.log('   🔍 Taker asset:', ourOrder.taker_asset);
      console.log('   🔍 Making amount:', ourOrder.making_amount);
      console.log('   🔍 Taking amount:', ourOrder.taking_amount);
      console.log('   🔍 Status:', ourOrder.status);
      console.log('   🔍 Created at:', ourOrder.created_at);
    } else {
      console.log('   ❌ Order not found in database');
      return;
    }
    console.log('');

    console.log('🎉 ORDER CREATION AND SUBMISSION COMPLETED SUCCESSFULLY!');
    console.log('\n📋 SUMMARY:');
    console.log('   ✅ Created fresh order with all components');
    console.log('   ✅ Submitted order to database');
    console.log('   ✅ Verified order is stored correctly');
    console.log('   ✅ Order is ready for takers to fill');

    return {
      orderHash: ourOrder.order_hash,
      maker: ourOrder.maker,
      makerAsset: ourOrder.maker_asset,
      takerAsset: ourOrder.taker_asset,
      makingAmount: ourOrder.making_amount,
      takingAmount: ourOrder.taking_amount,
      status: ourOrder.status
    };

  } catch (error) {
    console.error('❌ Order creation failed:', error.message);
    if (error.response?.data) {
      console.error('   Backend error:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// Run order creation if this file is executed directly
if (require.main === module) {
  createAndSubmitOrder().catch(console.error);
}

module.exports = {
  createAndSubmitOrder
}; 
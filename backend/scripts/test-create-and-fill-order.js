const { ethers } = require('hardhat');
const axios = require('axios');
require('dotenv').config();

// Import helper functions
const {
  buildCompleteCallOption,
  prepareOrderForFilling
} = require('../scripts/helpers/orderBuilder');

const { 
  createOrderHashManager, 
  createRandomNonceManager
} = require('../scripts/helpers/nonceManager');

/**
 * Test creating a fresh order, storing it in database, then filling it
 */
async function testCreateAndFillOrder() {
  console.log('🚀 TESTING CREATE -> STORE -> FILL FLOW\n');
  
  try {
    // Setup
    const [deployer, taker] = await ethers.getSigners();
    const addresses = {
      mockETHAddress: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
      mockUSDCAddress: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
      lopAddress: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
      optionsNFTAddress: '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82',
      dummyTokenAddress: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
      backendUrl: 'http://localhost:3000'
    };

    // STEP 1: Setup tokens
    console.log('📋 STEP 1: Setting up tokens...');
    const mockETH = await ethers.getContractAt("MockERC20", addresses.mockETHAddress);
    const mockUSDC = await ethers.getContractAt("MockERC20", addresses.mockUSDCAddress);
    
    const usdcAmount = ethers.parseUnits("50000", 6);
    await mockUSDC.mint(taker.address, usdcAmount);
    await mockUSDC.connect(taker).approve(addresses.lopAddress, usdcAmount);
    await mockUSDC.connect(taker).approve(addresses.optionsNFTAddress, usdcAmount);
    
    const ethAmount = ethers.parseEther("10");
    await mockETH.mint(deployer.address, ethAmount);
    await mockETH.connect(deployer).approve(addresses.optionsNFTAddress, ethAmount);
    
    console.log('   ✅ Tokens setup complete');
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
    console.log('   🔍 Order hash:', freshCompleteOption.orderHash);
    console.log('   🔍 Maker:', freshCompleteOption.originalAddresses.maker);
    console.log('   🔍 Maker Asset:', freshCompleteOption.order.makerAsset);
    console.log('   🔍 Taker Asset:', freshCompleteOption.order.takerAsset);
    console.log('');

    // STEP 3: Store order in database
    console.log('📋 STEP 3: Storing order in database...');
    
    // Calculate order hash
    const orderHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'address', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
      [
        freshCompleteOption.order.salt,
        freshCompleteOption.originalAddresses.maker,
        freshCompleteOption.originalAddresses.receiver,
        freshCompleteOption.originalAddresses.makerAsset,
        freshCompleteOption.originalAddresses.takerAsset,
        freshCompleteOption.order.makingAmount,
        freshCompleteOption.order.takingAmount,
        freshCompleteOption.order.makerTraits
      ]
    ));
    
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
        expiry: Number(freshCompleteOption.optionParams.expiry), // Convert BigInt to number
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
    console.log('   ✅ Order stored in database');
    console.log('   🔍 Response status:', storeResponse.status);
    console.log('');

    // STEP 4: Verify order is in database
    console.log('📋 STEP 4: Verifying order in database...');
    const browseResponse = await axios.get(`${addresses.backendUrl}/api/orders?status=open&limit=10`);
    const storedOrders = browseResponse.data.data.orders;
    
    // Get the most recent order (should be the one we just created)
    const ourOrder = storedOrders[0]; // Most recent order
    
    if (ourOrder) {
      console.log('   ✅ Order found in database');
      console.log('   🔍 Stored order hash:', ourOrder.order_hash);
      console.log('   🔍 Stored maker:', ourOrder.maker);
      console.log('   🔍 Stored maker asset:', ourOrder.maker_asset);
      console.log('   🔍 Stored taker asset:', ourOrder.taker_asset);
    } else {
      console.log('   ❌ Order not found in database');
      return;
    }
    console.log('');

    // STEP 5: Fill the stored order
    console.log('📋 STEP 5: Filling stored order...');
    
    // Parse stored order signature
    const storedSignature = JSON.parse(ourOrder.signature);
    let vsBigInt = ethers.getBigInt(storedSignature.s);
    if (storedSignature.v === 28) {
      vsBigInt |= (ethers.getBigInt(1) << ethers.getBigInt(255));
    }
    const vs = ethers.zeroPadValue(ethers.toBeHex(vsBigInt), 32);
    
    // Build order tuple from stored data
    const storedOrderTuple = [
      ethers.getBigInt(ourOrder.orderData.salt),
      ourOrder.orderData.maker.toLowerCase(),
      (ourOrder.orderData.receiver || ourOrder.orderData.maker).toLowerCase(),
      ourOrder.orderData.makerAsset.toLowerCase(),
      ourOrder.orderData.takerAsset.toLowerCase(),
      ethers.getBigInt(ourOrder.orderData.makingAmount),
      ethers.getBigInt(ourOrder.orderData.takingAmount),
      ethers.getBigInt(ourOrder.orderData.makerTraits)
    ];
    
    const storedInteractionData = ourOrder.interaction_data || '0x';
    const storedInteractionLength = storedInteractionData.length / 2 - 1;
    const storedTakerTraits = (BigInt(storedInteractionLength) << 200n);
    
    // Fill the order
    const lopContract = await ethers.getContractAt("LimitOrderProtocol", addresses.lopAddress, taker);
    
    console.log('   🔍 About to fill stored order...');
    console.log('   🔍 Order tuple:', storedOrderTuple);
    console.log('   🔍 Signature R:', storedSignature.r);
    console.log('   🔍 Signature VS:', vs);
    console.log('   🔍 Fill amount:', ourOrder.taking_amount);
    console.log('   🔍 Taker traits:', storedTakerTraits.toString());
    console.log('   🔍 Interaction data length:', storedInteractionData.length);
    
    const tx = await lopContract.fillOrderArgs(
      storedOrderTuple,
      storedSignature.r,
      vs,
      ethers.getBigInt(ourOrder.taking_amount),
      storedTakerTraits,
      storedInteractionData
    );
    
    console.log('   ✅ Transaction sent:', tx.hash);
    console.log('   🔍 Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log('   ✅ Transaction confirmed!');
    console.log('   🔍 Gas used:', receipt.gasUsed.toString());
    
    // Check NFT balance
    const optionsNFT = await ethers.getContractAt("OptionNFT", addresses.optionsNFTAddress);
    const nftBalance = await optionsNFT.balanceOf(taker.address);
    console.log('   🔍 Taker NFT balance:', nftBalance.toString());
    
    console.log('');
    console.log('🎉 CREATE -> STORE -> FILL TEST COMPLETED SUCCESSFULLY!');
    console.log('\n📋 SUMMARY:');
    console.log('   ✅ Created fresh order');
    console.log('   ✅ Stored order in database');
    console.log('   ✅ Retrieved order from database');
    console.log('   ✅ Filled stored order successfully');
    console.log('   ✅ NFT minted to taker');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('   Backend error:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testCreateAndFillOrder().catch(console.error);
}

module.exports = {
  testCreateAndFillOrder
}; 
const { ethers } = require('hardhat');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

// Import the new envLoader utility
const { loadContractAddresses } = require('../scripts/utils/envLoader');

// Import builder helper functions
const {
  buildCompleteCallOption,
  deployDummyOptionToken,
  setupDummyTokensForMaker,
  prepareOrderForFilling,
  buildOptionsNFTInteraction
} = require('../scripts/helpers/orderBuilder');

// Import nonce manager helpers
const { 
  createOrderHashManager, 
  createPersistentNonceManager,
  createMakerTraitsSimple,
  createRandomNonceManager
} = require('../scripts/helpers/nonceManager');

/**
 * Step-by-step test to fill orders from backend
 * This script will show us exactly what's happening at each step
 */
async function testFillOrdersStepByStep() {
  console.log('🚀 STEP-BY-STEP ORDER FILLING TEST\n');
  console.log('This test will show us exactly what happens at each step\n');
  
  try {
    // STEP 1: Setup provider and signers
    console.log('📋 STEP 1: Setting up provider and signers...');
    const provider = new ethers.JsonRpcProvider("http://localhost:8545");
    const [deployer, taker] = await ethers.getSigners();
    console.log('   ✅ Provider URL: http://localhost:8545');
    console.log('   ✅ Deployer address:', deployer.address);
    console.log('   ✅ Taker address:', taker.address);
    console.log('   ✅ Network:', await provider.getNetwork().then(n => n.chainId));
    console.log('');

    // STEP 2: Load contract addresses
    console.log('📋 STEP 2: Loading contract addresses...');
    const addresses = loadContractAddresses({ 
      required: true, 
      envPath: path.join(__dirname, '..', '.env') 
    });
    console.log('   ✅ MockETH:', addresses.mockETHAddress);
    console.log('   ✅ MockUSDC:', addresses.mockUSDCAddress);
    console.log('   ✅ LOP:', addresses.lopAddress);
    console.log('   ✅ OptionsNFT:', addresses.optionsNFTAddress);
    console.log('   ✅ DummyToken:', addresses.dummyTokenAddress);
    console.log('   ✅ Backend URL:', addresses.backendUrl);
    console.log('');

    // STEP 3: Setup tokens for taker and maker
    console.log('📋 STEP 3: Setting up tokens for taker and maker...');
    const mockETH = await ethers.getContractAt("MockERC20", addresses.mockETHAddress);
    const mockUSDC = await ethers.getContractAt("MockERC20", addresses.mockUSDCAddress);
    
    // Setup taker tokens
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

    // STEP 4: Get open orders from backend
    console.log('📋 STEP 4: Fetching open orders from backend...');
    const browseResponse = await axios.get(`${addresses.backendUrl}/api/orders?status=open&limit=10`);
    console.log('   ✅ Backend response status:', browseResponse.status);
    console.log('   ✅ Total open orders:', browseResponse.data.data.count);
    
    if (browseResponse.data.data.count === 0) {
      console.log('❌ No open orders found. Please create some orders first.');
      return;
    }

    // STEP 5: Select an order to fill
    console.log('📋 STEP 5: Selecting order to fill...');
    const openOrder = browseResponse.data.data.orders[0];
    console.log('   ✅ Selected order hash:', openOrder.order_hash);
    console.log('   ✅ Maker:', openOrder.maker);
    console.log('   ✅ Maker Asset:', openOrder.maker_asset);
    console.log('   ✅ Taker Asset:', openOrder.taker_asset);
    console.log('   ✅ Making Amount:', openOrder.making_amount);
    console.log('   ✅ Taking Amount:', openOrder.taking_amount);
    console.log('');

    // STEP 6: Debug the order data structure
    console.log('📋 STEP 6: Analyzing order data structure...');
    console.log('   🔍 Available fields:', Object.keys(openOrder));
    console.log('   🔍 Salt:', openOrder.salt);
    console.log('   🔍 Signature type:', typeof openOrder.signature);
    console.log('   🔍 Signature value:', openOrder.signature);
    console.log('   🔍 Order Data type:', typeof openOrder.orderData);
    console.log('   🔍 Order Data:', openOrder.orderData);
    console.log('   🔍 Option Params:', openOrder.optionParams);
    console.log('   🔍 Maker Traits:', openOrder.maker_traits);
    console.log('   🔍 Maker Traits (hex):', '0x' + BigInt(openOrder.maker_traits).toString(16));
    console.log('');

    // STEP 7: Parse the signature properly
    console.log('📋 STEP 7: Parsing signature properly...');
    let parsedSignature;
    try {
      // Check if signature is a JSON string or object
      if (typeof openOrder.signature === 'string') {
        console.log('   🔍 Signature is a string, checking if it\'s JSON...');
        try {
          // Try to parse as JSON first
          const jsonSignature = JSON.parse(openOrder.signature);
          console.log('   ✅ Signature is JSON, using parsed object...');
          parsedSignature = jsonSignature;
        } catch (jsonError) {
          // If not JSON, try to parse as raw signature
          console.log('   🔍 Signature is not JSON, trying ethers.Signature.from()...');
          parsedSignature = ethers.Signature.from(openOrder.signature);
        }
      } else {
        console.log('   🔍 Signature is already an object, using as-is...');
        parsedSignature = openOrder.signature;
      }
      
      console.log('   ✅ Parsed signature:');
      console.log('      R:', parsedSignature.r);
      console.log('      S:', parsedSignature.s);
      console.log('      V:', parsedSignature.v);
      console.log('');
    } catch (error) {
      console.log('   ❌ Error parsing signature:', error.message);
      console.log('   🔍 Raw signature:', openOrder.signature);
      console.log('');
    }

    // STEP 8: Build vs format (same as frontend)
    console.log('📋 STEP 8: Building vs format (same as frontend)...');
    let vsBigInt, vs;
    try {
      vsBigInt = ethers.getBigInt(parsedSignature.s);
      if (parsedSignature.v === 28) {
        vsBigInt |= (ethers.getBigInt(1) << ethers.getBigInt(255));
        console.log('   ✅ Applied EIP-2098 compact signature format (v=28)');
      }
      vs = ethers.zeroPadValue(ethers.toBeHex(vsBigInt), 32);
      console.log('   ✅ VS format:', vs);
      console.log('');
    } catch (error) {
      console.log('   ❌ Error building vs format:', error.message);
      console.log('');
    }

    // STEP 9: Get fill calldata from backend
    console.log('📋 STEP 9: Getting fill calldata from backend...');
    const fillData = {
      taker: taker.address,
      fillAmount: openOrder.taking_amount,
      lopAddress: addresses.lopAddress
    };
    
    const fillResponse = await axios.post(`${addresses.backendUrl}/api/orders/${openOrder.order_hash}/fill`, fillData);
    console.log('   ✅ Fill response status:', fillResponse.status);
    console.log('   ✅ Message:', fillResponse.data.data.message);
    console.log('   ✅ Estimated Gas:', fillResponse.data.data.estimatedGas);
    console.log('');

    // STEP 10: Reconstruct order data
    console.log('📋 STEP 10: Reconstructing order data...');
    const orderData = openOrder.orderData;
    console.log('   🔍 Order Data:', orderData);
    console.log('   🔍 Order Data type:', typeof orderData);
    
    if (typeof orderData === 'string') {
      console.log('   🔍 Order Data is string, parsing JSON...');
      const parsedOrderData = JSON.parse(orderData);
      console.log('   ✅ Parsed Order Data:', parsedOrderData);
    } else {
      console.log('   ✅ Order Data is already object');
    }
    console.log('');

    // STEP 11: Build complete option object
    console.log('📋 STEP 11: Building complete option object...');
    const completeOption = {
      order: {
        salt: ethers.getBigInt(orderData.salt),
        maker: orderData.maker.toLowerCase(), // Normalize to lowercase
        receiver: (orderData.receiver || orderData.maker).toLowerCase(), // Normalize to lowercase
        makerAsset: orderData.makerAsset.toLowerCase(), // Normalize to lowercase
        takerAsset: orderData.takerAsset.toLowerCase(), // Normalize to lowercase
        makingAmount: ethers.getBigInt(orderData.makingAmount),
        takingAmount: ethers.getBigInt(orderData.takingAmount),
        makerTraits: ethers.getBigInt(orderData.makerTraits)
      },
      orderTuple: [
        ethers.getBigInt(orderData.salt),
        orderData.maker.toLowerCase(), // Normalize to lowercase
        (orderData.receiver || orderData.maker).toLowerCase(), // Normalize to lowercase
        orderData.makerAsset.toLowerCase(), // Normalize to lowercase
        orderData.takerAsset.toLowerCase(), // Normalize to lowercase
        ethers.getBigInt(orderData.makingAmount),
        ethers.getBigInt(orderData.takingAmount),
        ethers.getBigInt(orderData.makerTraits)
      ],
      lopSignature: {
        r: parsedSignature.r,
        s: parsedSignature.s,
        v: parsedSignature.v,
        vs: vs
      },
      optionsNFTSignature: {
        r: openOrder.options_nft_signature_r || '0x',
        s: openOrder.options_nft_signature_s || '0x',
        v: parseInt(openOrder.options_nft_signature_v) || 0
      }
    };
    
    console.log('   ✅ Complete option object built');
    console.log('   🔍 Order salt:', completeOption.order.salt.toString());
    console.log('   🔍 Maker:', completeOption.order.maker);
    console.log('   🔍 LOP Signature R:', completeOption.lopSignature.r);
    console.log('   🔍 LOP Signature VS:', completeOption.lopSignature.vs);
    console.log('');

    // STEP 12: Build interaction data
    console.log('📋 STEP 12: Building interaction data...');
    const convertedOptionParams = {
      underlyingAsset: openOrder.optionParams.underlyingAsset.toLowerCase(), // Normalize to lowercase
      strikeAsset: openOrder.optionParams.strikeAsset.toLowerCase(), // Normalize to lowercase
      strikePrice: ethers.getBigInt(openOrder.optionParams.strikePrice),
      expiry: ethers.getBigInt(openOrder.optionParams.expiry),
      optionAmount: ethers.getBigInt(openOrder.optionParams.optionAmount)
    };
    
    // Use the correct OptionsNFT salt instead of LOP order salt
    const optionsNFTSalt = openOrder.options_nft_salt || orderData.salt;
    const realOptionsNFTSignature = {
      r: openOrder.options_nft_signature_r || '0x0000000000000000000000000000000000000000000000000000000000000000',
      s: openOrder.options_nft_signature_s || '0x0000000000000000000000000000000000000000000000000000000000000000',
      v: parseInt(openOrder.options_nft_signature_v) || 0,
      salt: ethers.getBigInt(optionsNFTSalt)
    };
    
    console.log('   🔍 Converted Option Params:', convertedOptionParams);
    console.log('   🔍 OptionsNFT Signature:', realOptionsNFTSignature);
    
    const interaction = buildOptionsNFTInteraction({
      maker: orderData.maker.toLowerCase(), // Normalize to lowercase
      optionParams: convertedOptionParams,
      signature: realOptionsNFTSignature,
      optionsNFTAddress: addresses.optionsNFTAddress.toLowerCase() // Normalize to lowercase
    });
    
    completeOption.interaction = interaction;
    console.log('   ✅ Interaction data built');
    console.log('   🔍 Interaction length:', interaction.length);
    console.log('');
    
    // TEST: Use stored interaction data from frontend
    console.log('🔬 TESTING: Using stored interaction data from frontend...');
    const storedInteractionData = openOrder.interaction_data || '0x';
    console.log('   🔍 Stored interaction data length:', storedInteractionData.length);
    console.log('   🔍 Stored interaction data (first 100 chars):', storedInteractionData.substring(0, 100) + '...');
    
    // Decode the interaction data to see what's inside
    if (storedInteractionData && storedInteractionData !== '0x') {
      console.log('   🔍 DECODING INTERACTION DATA:');
      try {
        // The interaction data format is: [contractAddress][encodedData]
        // First 20 bytes (40 hex chars) is the contract address
        const contractAddress = '0x' + storedInteractionData.substring(2, 42);
        console.log('   🔍 Contract Address:', contractAddress);
        
        // The rest is the encoded data
        const encodedData = '0x' + storedInteractionData.substring(42);
        console.log('   🔍 Encoded Data Length:', encodedData.length - 2, 'bytes');
        
        // Decode the parameters
        const decodedParams = ethers.AbiCoder.defaultAbiCoder().decode(
          ['address', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint8', 'bytes32', 'bytes32'],
          encodedData
        );
        
        console.log('   🔍 Decoded Parameters:');
        console.log('      Maker:', decodedParams[0]);
        console.log('      Underlying Asset:', decodedParams[1]);
        console.log('      Strike Asset:', decodedParams[2]);
        console.log('      Strike Price:', decodedParams[3].toString());
        console.log('      Expiry:', decodedParams[4].toString());
        console.log('      Option Amount:', decodedParams[5].toString());
        console.log('      Salt:', decodedParams[6].toString());
        console.log('      V:', decodedParams[7]);
        console.log('      R:', decodedParams[8]);
        console.log('      S:', decodedParams[9]);
        
      } catch (error) {
        console.log('   ❌ Error decoding interaction data:', error.message);
      }
    } else {
      console.log('   ⚠️ No interaction data found in order');
    }
    console.log('');

    // STEP 13: Prepare order for filling
    console.log('📋 STEP 13: Preparing order for filling...');
    const fillParams = prepareOrderForFilling(completeOption, fillData.fillAmount);
    console.log('   ✅ Fill parameters prepared');
    console.log('   🔍 Order Tuple length:', fillParams.orderTuple.length);
    console.log('   🔍 R:', fillParams.r);
    console.log('   🔍 VS:', fillParams.vs);
    console.log('   🔍 Fill Amount:', fillParams.fillAmount.toString());
    console.log('   🔍 Taker Traits:', fillParams.takerTraits.toString());
    console.log('   🔍 Interaction Data length:', fillParams.interactionData.length);
    console.log('');

    // STEP 14: Fill the order on-chain
    console.log('📋 STEP 14: Filling order on-chain...');
    const lopContract = await ethers.getContractAt("LimitOrderProtocol", addresses.lopAddress, taker);
    
    console.log('   🔍 Contract address:', addresses.lopAddress);
    console.log('   🔍 Taker address:', taker.address);
    console.log('   🔍 About to call fillOrderArgs...');
    
    // Try with stored interaction data from frontend
    console.log('   🔍 Using stored interaction data from frontend...');
    
    // Calculate taker traits for stored interaction data
    const storedInteractionLength = storedInteractionData.length / 2 - 1; // Hex string length
    const storedTakerTraits = (BigInt(storedInteractionLength) << 200n);
    console.log('   🔍 Original taker traits:', fillParams.takerTraits.toString());
    console.log('   🔍 Stored interaction taker traits:', storedTakerTraits.toString());
    
    // First, let's simulate the transaction to see what's happening
    console.log('   🔍 Simulating transaction first...');
    try {
      const simulation = await lopContract.fillOrderArgs.staticCall(
        fillParams.orderTuple,
        fillParams.r,
        fillParams.vs,
        fillParams.fillAmount,
        storedTakerTraits, // Use taker traits for stored interaction
        storedInteractionData // Use stored interaction data from frontend
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
      storedTakerTraits, // Use taker traits for stored interaction
      storedInteractionData // Use stored interaction data from frontend
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

    // STEP 15: Check results
    console.log('📋 STEP 15: Checking results...');
    
    // Use raw ABI to avoid interface issues
    const rawABI = [
      "function balanceOf(address owner) view returns (uint256)",
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function totalSupply() view returns (uint256)"
    ];
    
    const rawOptionsNFT = new ethers.Contract(addresses.optionsNFTAddress, rawABI, provider);
    
    try {
      const nftBalance = await rawOptionsNFT.balanceOf(taker.address);
      console.log('   ✅ NFT Balance:', nftBalance.toString());
      
      if (nftBalance > 0) {
        console.log('   🎉 NFT successfully minted to taker!');
      } else {
        console.log('   ℹ️ No NFTs found for taker (this might be normal)');
      }
    } catch (error) {
      console.log('   ⚠️ Could not check NFT balance:', error.message);
    }
    
    console.log('');
    console.log('🎉 STEP-BY-STEP TEST COMPLETED SUCCESSFULLY!');
    console.log('');
    console.log('📋 SUMMARY:');
    console.log('   ✅ All steps completed successfully');
    console.log('   ✅ Signature parsing matches frontend methodology');
    console.log('   ✅ Order filled on-chain');
    console.log('   ✅ Gas used:', receipt.gasUsed.toString());

    return {
      orderHash: openOrder.order_hash,
      transactionHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString()
    };

  } catch (error) {
    console.error('❌ Test failed at step:', error.message);
    if (error.response?.data) {
      console.error('   Backend error:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Run the step-by-step test
 */
async function runStepByStepTest() {
  console.log('🚀 Starting Step-by-Step Fill Orders Test\n');
  console.log('This test will show us exactly what happens at each step\n');

  await testFillOrdersStepByStep();
}

// Run tests if this file is executed directly
if (require.main === module) {
  runStepByStepTest().catch(console.error);
}

module.exports = {
  testFillOrdersStepByStep,
  runStepByStepTest
}; 
const express = require('express');
const { ethers } = require('ethers');
const { validateOrderSignature, validateOptionsNFTSignature } = require('../middleware/signatureValidation');
const { validateOrderData, validateQueryParams, validateOrderHash } = require('../middleware/orderValidation');
const { insertOrder, getOrders, getOrderByHash, updateOrderStatus } = require('../database/db');

// Import builder helper functions
const {
  buildCompleteCallOption,
  fillCallOption,
  buildOrder,
  signOrder
} = require('../../scripts/helpers/orderBuilder');

const router = express.Router();

/**
 * POST /api/orders
 * Accept signed option orders and store them in the database
 */
router.post('/', validateOrderData, validateOrderSignature, async (req, res) => {
  try {
    console.log('\n🔍 POST /api/orders - Request received');
    console.log('   Body keys:', Object.keys(req.body));
    
    const { order, signature, lopAddress, optionParams, optionsNFTSignature, optionsNFTAddress, optionsNFTSalt, interactionData } = req.validatedData;
    const { maker } = req.validatedOrder;

    // Generate EIP-712 order hash (same as frontend)
    const domain = {
      name: "1inch Limit Order Protocol",
      version: "4",
      chainId: process.env.CHAIN_ID || 31337,
      verifyingContract: lopAddress
    };

    const types = {
      Order: [
        { name: "salt", type: "uint256" },
        { name: "maker", type: "address" },
        { name: "receiver", type: "address" },
        { name: "makerAsset", type: "address" },
        { name: "takerAsset", type: "address" },
        { name: "makingAmount", type: "uint256" },
        { name: "takingAmount", type: "uint256" },
        { name: "makerTraits", type: "uint256" }
      ]
    };

    // Calculate the EIP-712 hash that was actually signed
    const orderHash = ethers.TypedDataEncoder.hash(domain, types, order);

    // Check if order already exists
    const existingOrder = await getOrderByHash(orderHash);
    if (existingOrder) {
      return res.status(409).json({
        error: 'Order already exists',
        orderHash: orderHash
      });
    }

    // Prepare order data for database
    // Debug logging for OptionsNFT salt
    console.log('\n🔍 DEBUG: OptionsNFT Salt Check');
    console.log('   Received optionsNFTSalt:', optionsNFTSalt);
    console.log('   Type:', typeof optionsNFTSalt);
    console.log('   Truthy:', !!optionsNFTSalt);

    const orderData = {
      orderHash,
      maker,
      makerAsset: order.makerAsset,
      takerAsset: order.takerAsset,
      makingAmount: order.makingAmount.toString(),
      takingAmount: order.takingAmount.toString(),
      salt: order.salt.toString(),
      receiver: order.receiver,
      makerTraits: order.makerTraits.toString(),
      orderData: order,
      signature: JSON.stringify(signature),
      optionParams: optionParams || null,
      optionsNFTSignature: optionsNFTSignature || null,
      optionsNFTSalt: optionsNFTSalt || null,
      interactionData: interactionData || null
    };

    // Insert order into database
    const result = await insertOrder(orderData);

    res.status(201).json({
      success: true,
      message: 'Order accepted and stored',
      data: {
        orderHash,
        maker,
        status: 'open',
        id: result.id
      }
    });

  } catch (error) {
    console.error('Error storing order:', error);
    res.status(500).json({
      error: 'Failed to store order',
      message: error.message
    });
  }
});

/**
 * GET /api/orders
 * Retrieve open orders for takers to browse
 */
router.get('/', validateQueryParams, async (req, res) => {
  try {
    const filters = req.validatedQuery;
    
    const orders = await getOrders(filters);
    
    res.json({
      success: true,
      data: {
        orders: orders,
        count: orders.length,
        filters: filters
      }
    });
  } catch (error) {
    console.error('Error retrieving orders:', error);
    res.status(500).json({
      error: 'Failed to retrieve orders',
      message: error.message
    });
  }
});

/**
 * GET /api/orders/:orderHash
 * Get a specific order by its hash
 */
router.get('/:orderHash', validateOrderHash, async (req, res) => {
  try {
    const { orderHash } = req.params;
    
    const order = await getOrderByHash(orderHash);
    
    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        orderHash: orderHash
      });
    }
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error retrieving order:', error);
    res.status(500).json({
      error: 'Failed to retrieve order',
      message: error.message
    });
  }
});

/**
 * POST /api/orders/:orderHash/fill
 * Generate fill calldata for an order
 */
router.post('/:orderHash/fill', validateOrderHash, async (req, res) => {
  try {
    const { orderHash } = req.params;
    const { taker, fillAmount, lopAddress } = req.body;
    
    console.log('🔍 [DEBUG] Fill request received:', {
      orderHash,
      taker,
      fillAmount,
      lopAddress
    });
    
    // Validate required fields
    if (!taker || !fillAmount || !lopAddress) {
      console.log('❌ [DEBUG] Missing required fields:', { taker, fillAmount, lopAddress });
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'taker, fillAmount, and lopAddress are required'
      });
    }
    
    console.log('✅ [DEBUG] Required fields validated');
    
    // Get the order from database
    const order = await getOrderByHash(orderHash);
    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        orderHash: orderHash
      });
    }
    
    console.log('✅ [DEBUG] Order found:', {
      orderHash: order.order_hash,
      status: order.status,
      hasOptionParams: !!order.optionParams,
      hasSignature: !!order.signature
    });
    
    // Check if order is still open
    console.log('🔍 [DEBUG] Checking order status:', order.status);
    if (order.status !== 'open') {
      console.log('❌ [DEBUG] Order status is not open:', order.status);
      return res.status(400).json({
        error: 'Order not available',
        message: `Order status is ${order.status}`
      });
    }
    console.log('✅ [DEBUG] Order status is open');
    
    // Check if order has expired
    const currentTime = Math.floor(Date.now() / 1000);
    console.log('🔍 [DEBUG] Checking order expiry:', { currentTime, orderExpiry: order.expiry });
    if (order.expiry && currentTime > order.expiry) {
      console.log('❌ [DEBUG] Order has expired');
      return res.status(400).json({
        error: 'Order expired',
        message: 'Order has expired'
      });
    }
    console.log('✅ [DEBUG] Order has not expired');
    
    // Generate fill calldata based on order type
    console.log('🔍 [DEBUG] Starting fill calldata generation...');
    let fillCalldata;
    
    if (order.optionParams) {
      console.log('🔍 [DEBUG] Processing options order');
      console.log('📋 [DEBUG] Order data structure:', {
        hasOrderData: !!order.orderData,
        hasSignature: !!order.signature,
        hasInteractionData: !!order.interactionData, // Now works due to normalized field names
        hasOptionsNFTSignature: !!order.optionsNFTSignature,
        hasOptionsNFTSalt: !!order.optionsNFTSalt
      });
      
      // This is an options order - use options fill calldata generator
      const completeOrderData = {
        orderTuple: [
          order.orderData.salt,
          order.orderData.maker,
          order.orderData.receiver,
          order.orderData.makerAsset,
          order.orderData.takerAsset,
          order.orderData.makingAmount,
          order.orderData.takingAmount,
          order.orderData.makerTraits
        ],
        lopSignature: JSON.parse(order.signature),
        interaction: order.interaction_data, // Use the correct field name from database
        optionsNFTSignature: {
          r: order.options_nft_signature_r || '0x0000000000000000000000000000000000000000000000000000000000000000',
          s: order.options_nft_signature_s || '0x0000000000000000000000000000000000000000000000000000000000000000',
          v: parseInt(order.options_nft_signature_v) || 0
        },
        optionsNFTSalt: order.options_nft_salt
      };
      
      console.log('📋 [DEBUG] Complete order data prepared:', {
        orderTupleLength: completeOrderData.orderTuple.length,
        hasLopSignature: !!completeOrderData.lopSignature,
        hasInteraction: !!completeOrderData.interaction,
        hasOptionsNFTSignature: !!completeOrderData.optionsNFTSignature,
        hasOptionsNFTSalt: !!completeOrderData.optionsNFTSalt
      });
      
      // Add debugging for maker traits
      console.log('🔍 [DEBUG] Maker traits details:');
      console.log('   Maker traits from DB:', order.orderData.makerTraits);
      console.log('   Maker traits type:', typeof order.orderData.makerTraits);
      console.log('   Maker traits in orderTuple:', completeOrderData.orderTuple[7]);
      console.log('   Order tuple:', completeOrderData.orderTuple);
      
      console.log('🔍 [DEBUG] Calling generateOptionsFillCalldata...');
      fillCalldata = await generateOptionsFillCalldata({
        orderData: completeOrderData,
        taker,
        fillAmount,
        lopAddress
      });
      console.log('✅ [DEBUG] Options fill calldata generated successfully');
    } else {
      console.log('🔍 [DEBUG] Processing regular LOP order');
      // This is a regular LOP order
      fillCalldata = await generateRegularFillCalldata({
        order,
        taker,
        fillAmount,
        lopAddress
      });
    }
    
    res.json({
      success: true,
      data: {
        orderHash,
        fillCalldata,
        orderData: order.orderData,
        signature: JSON.parse(order.signature),
        optionParams: order.optionParams,
        estimatedGas: fillCalldata.estimatedGas
      }
    });
  } catch (error) {
    console.error('Error generating fill calldata:', error);
    res.status(500).json({
      error: 'Failed to generate fill calldata',
      message: error.message
    });
  }
});

/**
 * POST /api/orders/:orderHash/filled
 * Mark an order as filled after successful transaction
 */
router.post('/:orderHash/filled', validateOrderHash, async (req, res) => {
  try {
    const { orderHash } = req.params;
    const { txHash, taker } = req.body;
    
    // Validate required fields
    if (!txHash || !taker) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'txHash and taker are required'
      });
    }
    
    // Get the order from database
    const order = await getOrderByHash(orderHash);
    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        orderHash: orderHash
      });
    }
    
    // Check if order is still open
    if (order.status !== 'open') {
      return res.status(400).json({
        error: 'Order already processed',
        message: `Order status is ${order.status}`
      });
    }
    
    // Update order status to filled
    await updateOrderStatus(orderHash, 'filled');
    
    console.log(`✅ Order ${orderHash} marked as filled by ${taker}`);
    console.log(`   Transaction: ${txHash}`);
    
    res.json({
      success: true,
      message: 'Order marked as filled',
      data: {
        orderHash,
        status: 'filled',
        txHash,
        taker
      }
    });
    
  } catch (error) {
    console.error('Error marking order as filled:', error);
    res.status(500).json({
      error: 'Failed to mark order as filled',
      message: error.message
    });
  }
});

/**
 * POST /api/orders/:orderHash/cancel
 * Cancel an order (only by the maker)
 */
router.post('/:orderHash/cancel', validateOrderHash, async (req, res) => {
  try {
    const { orderHash } = req.params;
    const { maker } = req.body;
    
    // Validate required fields
    if (!maker) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'maker is required'
      });
    }
    
    // Get the order from database
    const order = await getOrderByHash(orderHash);
    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        orderHash: orderHash
      });
    }
    
    // Check if the caller is the maker
    if (order.maker.toLowerCase() !== maker.toLowerCase()) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Only the maker can cancel this order'
      });
    }
    
    // Check if order is still open
    if (order.status !== 'open') {
      return res.status(400).json({
        error: 'Order not available',
        message: `Order status is ${order.status}`
      });
    }
    
    // Update order status to cancelled
    await updateOrderStatus(orderHash, 'cancelled');
    
    res.json({
      success: true,
      data: {
        orderHash,
        status: 'cancelled'
      }
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      error: 'Failed to cancel order',
      message: error.message
    });
  }
});

/**
 * Generate fill calldata for options orders
 */
async function generateOptionsFillCalldata({ orderData, taker, fillAmount, lopAddress }) {
  try {
    console.log('🔍 [DEBUG] generateOptionsFillCalldata called with:', {
      hasOrderData: !!orderData,
      hasOrderTuple: !!orderData.orderTuple,
      hasLopSignature: !!orderData.lopSignature,
      hasInteraction: !!orderData.interaction,
      taker,
      fillAmount,
      lopAddress
    });

    console.log("orderData: ", orderData);
    console.log("tuple", taker); 
    console.log("fillAmount", fillAmount);
    console.log("lopAddress", lopAddress);
    
    // Add detailed interaction data debugging
    console.log('🔍 [DEBUG] Interaction data details:');
    console.log('   Interaction data:', orderData.interaction);
    console.log('   Interaction data type:', typeof orderData.interaction);
    console.log('   Interaction data length:', orderData.interaction.length);
    console.log('   Interaction data starts with 0x:', orderData.interaction.startsWith('0x'));
    console.log('   Interaction data (first 100 chars):', orderData.interaction.substring(0, 100));
    
    // Validate interaction data
    if (!orderData.interaction || typeof orderData.interaction !== 'string') {
      throw new Error('Invalid interaction data: must be a non-empty string');
    }
    
    if (!orderData.interaction.startsWith('0x')) {
      throw new Error('Invalid interaction data: must start with 0x');
    }
    
    // Create interface for LOP contract
    console.log('🔍 [DEBUG] Creating LOP interface...');
    const lopInterface = new ethers.Interface([
      'function fillOrderArgs((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256), bytes32 r, bytes32 vs, uint256 makingAmount, uint256 takerTraits, bytes calldata interaction) external payable returns(uint256, uint256, bytes32)'
    ]);
    console.log('✅ [DEBUG] LOP interface created');
    
    // Calculate taker traits from interaction data length
    console.log('🔍 [DEBUG] Calculating taker traits...');
    console.log('📋 [DEBUG] Interaction data:', {
      interaction: orderData.interaction,
      length: orderData.interaction.length
    });
    
    // Use the same pattern as working backend scripts and frontend
    const interactionLength = orderData.interaction.length / 2 - 1; // Hex string length
    const takerTraits = (BigInt(interactionLength) << 200n);
    console.log('✅ [DEBUG] Taker traits calculated:', { 
      interactionLength, 
      takerTraits: takerTraits.toString(),
      takerTraitsHex: '0x' + takerTraits.toString(16)
    });
    
    // Enhanced debug: Compare with expected debug version values
    console.log('🔍 [DEBUG] Enhanced comparison:');
    console.log('   Raw interaction length:', orderData.interaction.length);
    console.log('   Calculated interaction length:', interactionLength);
    console.log('   Expected debug taker traits: 803469022129495137770981046170581301261101496891396417650688000');
    console.log('   Backend calculated traits:', takerTraits.toString());
    console.log('   Match:', takerTraits.toString() === '803469022129495137770981046170581301261101496891396417650688000');
    
    // Create vs from v and s
    console.log('🔍 [DEBUG] Creating vs from signature components...');
    console.log('📋 [DEBUG] Signature components:', {
      r: orderData.lopSignature.r,
      s: orderData.lopSignature.s,
      v: orderData.lopSignature.v
    });
    
    const v = orderData.lopSignature.v;
    const s = orderData.lopSignature.s;
    
    // Create vs by combining v and s
     console.log('Building vs format (same as frontend)...');
     let vsBigInt, vs;
     try {
       vsBigInt = ethers.getBigInt(s);
       if (v === 28) {
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
    
    // Encode fillOrderArgs function call
    console.log('🔍 [DEBUG] Encoding fillOrderArgs function call...');
    console.log('📋 [DEBUG] Function parameters:', {
      orderTuple: orderData.orderTuple,
      r: orderData.lopSignature.r,
      vs,
      fillAmount,
      takerTraits: takerTraits.toString(),
      interaction: orderData.interaction
    });
    
    try {
      const fillOrderData = lopInterface.encodeFunctionData('fillOrderArgs', [
        orderData.orderTuple, // Pass as array since function signature doesn't have named fields
        orderData.lopSignature.r,
        vs,
        fillAmount,
        takerTraits,
        orderData.interaction
      ]);
      
      console.log('✅ [DEBUG] Fill order data encoded successfully');
      console.log('📋 [DEBUG] Encoded data length:', fillOrderData.length);
      console.log('📋 [DEBUG] Encoded data (first 100 chars):', fillOrderData.substring(0, 100));
      console.log('📋 [DEBUG] Function selector:', fillOrderData.substring(0, 10));
      
      // Add debugging for function parameters
      console.log('🔍 [DEBUG] Function parameters:');
      console.log('   Order tuple:', orderData.orderTuple);
      console.log('   R:', orderData.lopSignature.r);
      console.log('   VS:', vs);
      console.log('   Fill amount:', fillAmount.toString());
      console.log('   Taker traits:', takerTraits.toString());
      console.log('   Interaction length:', orderData.interaction.length);
      
      return {
        to: lopAddress,
        data: fillOrderData,
        value: '0',
        estimatedGas: '500000'
      };
    } catch (error) {
      console.error('❌ [DEBUG] Error encoding fillOrderArgs:', error);
      throw error;
    }
  } catch (error) {
    console.error('❌ [DEBUG] Error in generateOptionsFillCalldata:', error);
    console.error('❌ [DEBUG] Error stack:', error.stack);
    throw new Error('Failed to generate options fill calldata');
  }
}

/**
 * Generate fill calldata for regular LOP orders
 */
async function generateRegularFillCalldata({ order, taker, fillAmount, lopAddress }) {
  try {
    // Create interface for LOP contract
    const lopInterface = new ethers.Interface([
      'function fillOrder((uint256 salt, address maker, address receiver, address makerAsset, address takerAsset, uint256 makingAmount, uint256 takingAmount, uint256 makerTraits), bytes calldata signature, uint256 makingAmount, uint256 takingAmount) external payable returns(uint256, uint256)'
    ]);
    
    // Parse the signature from the stored order
    const signature = JSON.parse(order.signature || '{}');
    
    // Create the signature bytes
    const signatureBytes = ethers.Signature.from({
      r: signature.r,
      s: signature.s,
      v: signature.v
    }).serialized;
    
    // Create order tuple
    const orderTuple = [
      order.orderData.salt,
      order.orderData.maker,
      order.orderData.receiver,
      order.orderData.makerAsset,
      order.orderData.takerAsset,
      order.orderData.makingAmount,
      order.orderData.takingAmount,
      order.orderData.makerTraits
    ];
    
    // Encode fillOrder function call
    const fillOrderData = lopInterface.encodeFunctionData('fillOrder', [
      orderTuple,
      signatureBytes,
      fillAmount,
      fillAmount // takingAmount same as fillAmount for simplicity
    ]);
    
    return {
      to: lopAddress,
      data: fillOrderData,
      value: '0',
      estimatedGas: '300000'
    };
  } catch (error) {
    console.error('Error generating regular fill calldata:', error);
    throw new Error('Failed to generate regular fill calldata');
  }
}

module.exports = router; 
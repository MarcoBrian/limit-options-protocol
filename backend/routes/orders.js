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
    const { order, signature, lopAddress, optionParams, optionsNFTSignature, optionsNFTAddress } = req.validatedData;
    const { maker } = req.validatedOrder;

    // Generate order hash
    const orderHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'address', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
        [
          order.salt,
          order.maker,
          order.receiver,
          order.makerAsset,
          order.takerAsset,
          order.makingAmount,
          order.takingAmount,
          order.makerTraits
        ]
      )
    );

    // Check if order already exists
    const existingOrder = await getOrderByHash(orderHash);
    if (existingOrder) {
      return res.status(409).json({
        error: 'Order already exists',
        orderHash: orderHash
      });
    }

    // Prepare order data for database
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
      optionParams: optionParams || null
    };

    // Insert order into database
    const result = await insertOrder(orderData);

    console.log(`✅ Order stored successfully: ${orderHash}`);

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
    
    // Validate required fields
    if (!taker || !fillAmount || !lopAddress) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'taker, fillAmount, and lopAddress are required'
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
        error: 'Order not available',
        message: `Order status is ${order.status}`
      });
    }
    
    // Check if order has expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (order.expiry && currentTime > order.expiry) {
      return res.status(400).json({
        error: 'Order expired',
        message: 'Order has expired'
      });
    }
    
    // For now, return order data that can be used with orderBuilder functions
    res.json({
      success: true,
      data: {
        orderHash,
        message: 'Use orderBuilder.fillCallOption() or orderBuilder functions to generate fill calldata',
        orderData: order.orderData,
        signature: JSON.parse(order.signature),
        optionParams: order.optionParams,
        estimatedGas: order.optionParams ? '500000' : '300000'
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
    const fillResult = await fillCallOption({
      orderData,
      taker,
      fillAmount,
      lopAddress
    });
    
    return {
      to: lopAddress,
      data: fillResult.data,
      value: fillResult.value || '0',
      estimatedGas: fillResult.estimatedGas || '500000'
    };
  } catch (error) {
    console.error('Error generating options fill calldata:', error);
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
const { ethers } = require('ethers');

/**
 * Validate EIP-712 signature for LOP orders
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function validateOrderSignature(req, res, next) {
  try {
    const { order, signature, lopAddress } = req.body;

    if (!order || !signature || !lopAddress) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'order, signature, and lopAddress are required'
      });
    }

    // Validate order structure
    const requiredFields = ['salt', 'maker', 'receiver', 'makerAsset', 'takerAsset', 'makingAmount', 'takingAmount', 'makerTraits'];
    for (const field of requiredFields) {
      if (!order[field]) {
        return res.status(400).json({
          error: 'Invalid order structure',
          message: `Missing required field: ${field}`
        });
      }
    }

    // Validate signature format
    if (!signature.r || !signature.s || !signature.v) {
      return res.status(400).json({
        error: 'Invalid signature format',
        message: 'Signature must include r, s, and v components'
      });
    }

    // Get chain ID from environment or default to local network (31337)
    const chainId = process.env.CHAIN_ID || 31337;

    // Define EIP-712 domain for LOP Order
    const domain = {
      name: "1inch Limit Order Protocol",
      version: "4",
      chainId: parseInt(chainId),
      verifyingContract: lopAddress
    };

    // Define EIP-712 types for LOP Order
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

    // Reconstruct signature
    const reconstructedSignature = ethers.Signature.from({
      r: signature.r,
      s: signature.s,
      v: signature.v
    });

    // Recover signer address
    const recoveredAddress = ethers.verifyTypedData(
      domain,
      types,
      order,
      reconstructedSignature
    );

    // Add debug logging
    console.log('\n🔍 BACKEND LOP SIGNATURE VALIDATION:');
    console.log('   Domain:', domain);
    console.log('   Types:', types);
    console.log('   Order:', order);
    console.log('   Signature R:', signature.r);
    console.log('   Signature S:', signature.s);
    console.log('   Signature V:', signature.v);
    console.log('   Recovered Address:', recoveredAddress);
    console.log('   Expected Maker:', order.maker);
    console.log('   Match:', recoveredAddress.toLowerCase() === order.maker.toLowerCase());

    // Validate that the recovered address matches the maker
    if (recoveredAddress.toLowerCase() !== order.maker.toLowerCase()) {
      return res.status(401).json({
        error: 'Invalid signature',
        message: 'Signature does not match the maker address'
      });
    }

    // Add validated data to request
    req.validatedOrder = {
      order,
      signature,
      lopAddress,
      maker: order.maker,
      recoveredAddress
    };

    next();
  } catch (error) {
    console.error('Signature validation error:', error);
    return res.status(400).json({
      error: 'Signature validation failed',
      message: error.message
    });
  }
}

/**
 * Validate EIP-712 signature for OptionsNFT parameters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function validateOptionsNFTSignature(req, res, next) {
  try {
    const { optionParams, optionsNFTSignature, optionsNFTAddress } = req.body;

    if (!optionParams || !optionsNFTSignature || !optionsNFTAddress) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'optionParams, optionsNFTSignature, and optionsNFTAddress are required'
      });
    }

    // Validate option parameters structure
    const requiredFields = ['underlyingAsset', 'strikeAsset', 'strikePrice', 'expiry', 'optionAmount'];
    for (const field of requiredFields) {
      if (!optionParams[field]) {
        return res.status(400).json({
          error: 'Invalid option parameters structure',
          message: `Missing required field: ${field}`
        });
      }
    }

    // Validate signature format
    if (!optionsNFTSignature.r || !optionsNFTSignature.s || !optionsNFTSignature.v) {
      return res.status(400).json({
        error: 'Invalid signature format',
        message: 'OptionsNFT signature must include r, s, and v components'
      });
    }

    // Get chain ID from environment or default to local network (31337)
    const chainId = process.env.CHAIN_ID || 31337;

    // Define EIP-712 domain for OptionsNFT
    const domain = {
      name: "OptionNFT",
      version: "1",
      chainId: parseInt(chainId),
      verifyingContract: optionsNFTAddress
    };

    // Define EIP-712 types for option parameters
    const types = {
      Option: [
        { name: "underlyingAsset", type: "address" },
        { name: "strikeAsset", type: "address" },
        { name: "maker", type: "address" },
        { name: "strikePrice", type: "uint256" },
        { name: "expiry", type: "uint256" },
        { name: "amount", type: "uint256" },
        { name: "salt", type: "uint256" }
      ]
    };

    // Prepare the value object that matches the frontend signature
    const value = {
      underlyingAsset: optionParams.underlyingAsset,
      strikeAsset: optionParams.strikeAsset,
      maker: optionParams.maker || req.body.maker, // Get maker from order or request body
      strikePrice: optionParams.strikePrice,
      expiry: optionParams.expiry,
      amount: optionParams.optionAmount, // Map optionAmount to amount
      salt: optionsNFTSignature.salt || 0 // Get salt from signature
    };

    // Reconstruct signature
    const reconstructedSignature = ethers.Signature.from({
      r: optionsNFTSignature.r,
      s: optionsNFTSignature.s,
      v: optionsNFTSignature.v
    });

    // Recover signer address
    const recoveredAddress = ethers.verifyTypedData(
      domain,
      types,
      value,
      reconstructedSignature
    );

    // Add debug logging
    console.log('\n🔍 BACKEND OPTIONSNFT SIGNATURE VALIDATION:');
    console.log('   Domain:', domain);
    console.log('   Types:', types);
    console.log('   Value:', value);
    console.log('   Signature R:', optionsNFTSignature.r);
    console.log('   Signature S:', optionsNFTSignature.s);
    console.log('   Signature V:', optionsNFTSignature.v);
    console.log('   Recovered Address:', recoveredAddress);
    console.log('   Expected Maker:', value.maker);
    console.log('   Match:', recoveredAddress.toLowerCase() === value.maker.toLowerCase());

    // Add validated data to request
    req.validatedOptionsNFT = {
      optionParams,
      optionsNFTSignature,
      optionsNFTAddress,
      recoveredAddress
    };

    next();
  } catch (error) {
    console.error('OptionsNFT signature validation error:', error);
    return res.status(400).json({
      error: 'OptionsNFT signature validation failed',
      message: error.message
    });
  }
}

module.exports = {
  validateOrderSignature,
  validateOptionsNFTSignature
}; 
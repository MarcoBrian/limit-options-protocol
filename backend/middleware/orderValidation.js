const Joi = require('joi');

// Schema for LOP order validation
const orderSchema = Joi.object({
  salt: Joi.string().required(),
  maker: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  receiver: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  makerAsset: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  takerAsset: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  makingAmount: Joi.string().pattern(/^[0-9]+$/).required(),
  takingAmount: Joi.string().pattern(/^[0-9]+$/).required(),
  makerTraits: Joi.string().pattern(/^[0-9]+$/).required()
});

// Schema for signature validation
const signatureSchema = Joi.object({
  r: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
  s: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
  v: Joi.number().integer().min(27).max(28).required()
});

// Schema for option parameters validation
const optionParamsSchema = Joi.object({
  underlyingAsset: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  strikeAsset: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  strikePrice: Joi.string().pattern(/^[0-9]+$/).required(),
  optionAmount: Joi.string().pattern(/^[0-9]+$/).required(),
  premium: Joi.string().pattern(/^[0-9]+$/).required(),
  expiry: Joi.number().integer().min(Math.floor(Date.now() / 1000)).required(),
  nonce: Joi.number().integer().min(0).optional()
});

// Schema for complete order submission
const completeOrderSchema = Joi.object({
  order: orderSchema.required(),
  signature: signatureSchema.required(),
  lopAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  optionParams: optionParamsSchema.optional(),
  optionsNFTSignature: signatureSchema.when('optionParams', {
    is: Joi.exist(),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  optionsNFTAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).when('optionParams', {
    is: Joi.exist(),
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

/**
 * Validate order data using Joi schema
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateOrderData(req, res, next) {
  const { error, value } = completeOrderSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorDetails = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      error: 'Validation failed',
      details: errorDetails
    });
  }

  // Add validated data to request
  req.validatedData = value;
  next();
}

/**
 * Validate query parameters for GET requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateQueryParams(req, res, next) {
  const querySchema = Joi.object({
    status: Joi.string().valid('open', 'filled', 'cancelled', 'expired').optional(),
    maker: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
    makerAsset: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
    takerAsset: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional(),
    limit: Joi.number().integer().min(1).max(100).default(50).optional()
  });

  const { error, value } = querySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorDetails = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      error: 'Invalid query parameters',
      details: errorDetails
    });
  }

  // Add validated query params to request
  req.validatedQuery = value;
  next();
}

/**
 * Validate order hash parameter
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateOrderHash(req, res, next) {
  const orderHashSchema = Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required();
  
  const { error } = orderHashSchema.validate(req.params.orderHash);

  if (error) {
    return res.status(400).json({
      error: 'Invalid order hash',
      message: 'Order hash must be a valid 32-byte hex string'
    });
  }

  next();
}

module.exports = {
  validateOrderData,
  validateQueryParams,
  validateOrderHash
}; 
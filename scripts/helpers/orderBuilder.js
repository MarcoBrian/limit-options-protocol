const { ethers } = require("hardhat");

// Helper to encode address as 32-byte left-padded hex string (1inch Address type)
function toAddressType(addr) {
  addr = addr.toLowerCase().replace(/^0x/, "");
  return "0x" + addr.padStart(64, "0");
}

// Helper to set maker traits flags similar to SDK pattern
function setMakerTraits(flags = {}, nonce = 0) {
  let traits = 0n;
  
  // CRITICAL FIX: Set nonce in bits [120..159] (40 bits)
  const nonceValue = BigInt(nonce) & ((1n << 40n) - 1n); // Ensure nonce fits in 40 bits
  traits |= (nonceValue << 120n);
  
  if (flags.postInteraction) {
    traits |= (1n << 251n); // POST_INTERACTION_CALL_FLAG
  }
  if (flags.noPartialFills) {
    traits |= (1n << 255n); // NO_PARTIAL_FILLS_FLAG
  }
  if (flags.allowMultipleFills) {
    traits |= (1n << 254n); // ALLOW_MULTIPLE_FILLS_FLAG
  }
  if (flags.preInteraction) {
    traits |= (1n << 252n); // PRE_INTERACTION_CALL_FLAG
  }
  if (flags.hasExtension) {
    traits |= (1n << 249n); // HAS_EXTENSION_FLAG
  }
  if (flags.usePermit2) {
    traits |= (1n << 248n); // USE_PERMIT2_FLAG
  }
  if (flags.unwrapWeth) {
    traits |= (1n << 247n); // UNWRAP_WETH_FLAG
  }
  
  return traits;
}

// Helper to build taker traits
function buildTakerTraits(interactionLength = 0) {
  return (BigInt(interactionLength) << 200n);
}

/**
 * Calculate taker traits from interaction data
 * @param {string|Uint8Array} interactionData - The interaction data
 * @returns {bigint} Taker traits value
 */
function calculateTakerTraits(interactionData) {
  const length = typeof interactionData === 'string' 
    ? interactionData.length / 2 - 1  // Hex string
    : interactionData.length - 1;     // Uint8Array
  return buildTakerTraits(length);
}

/**
 * Prepare order for filling - returns the correct parameters for fillOrderArgs
 * @param {Object} orderData - Complete order data from buildCompleteCallOption
 * @param {string|number} fillAmount - Amount to fill
 * @returns {Object} Parameters ready for fillOrderArgs
 */
function prepareOrderForFilling(orderData, fillAmount) {
  const takerTraits = calculateTakerTraits(orderData.interaction.data);
  
  return {
    orderTuple: orderData.orderTuple,
    r: orderData.lopSignature.r,
    vs: orderData.lopSignature.vs,
    fillAmount: ethers.getBigInt(fillAmount),
    takerTraits: takerTraits,
    interactionData: orderData.interaction.data
  };
}

/**
 * Build a standard LOP order
 * @param {Object} params - Order parameters
 * @param {string} params.maker - Maker address
 * @param {string} params.makerAsset - Maker asset address
 * @param {string} params.takerAsset - Taker asset address
 * @param {string|number} params.makingAmount - Amount maker offers
 * @param {string|number} params.takingAmount - Amount taker pays
 * @param {string} params.receiver - Receiver address (defaults to maker)
 * @param {Object} params.makerTraits - Maker traits flags
 * @returns {Object} Order object with tuple and original addresses
 */
function buildOrder(params) {
  const {
    maker,
    receiver = maker,
    makerAsset,
    takerAsset,
    makingAmount,
    takingAmount,
    makerTraits = {},
    lopNonce = 0,  // CRITICAL FIX: Accept lopNonce parameter
    customMakerTraits = null  // NEW: Accept pre-built MakerTraits (e.g., from SDK)
  } = params;

  const salt = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

  const order = {
    salt: ethers.getBigInt(salt),
    maker: toAddressType(maker),
    receiver: toAddressType(receiver),
    makerAsset: toAddressType(makerAsset),
    takerAsset: toAddressType(takerAsset),
    makingAmount: ethers.getBigInt(makingAmount),
    takingAmount: ethers.getBigInt(takingAmount),
    // Use custom MakerTraits if provided, otherwise build from flags
    makerTraits: customMakerTraits !== null ? customMakerTraits : setMakerTraits(makerTraits, lopNonce)
  };

  const orderTuple = [
    order.salt,
    order.maker,
    order.receiver,
    order.makerAsset,
    order.takerAsset,
    order.makingAmount,
    order.takingAmount,
    order.makerTraits
  ];

  // Store original addresses for signing
  const originalAddresses = {
    maker,
    receiver,
    makerAsset,
    takerAsset
  };

  return { order, orderTuple, originalAddresses };
}

/**
 * Sign a LOP order
 * @param {Object} order - Order object
 * @param {Object} signer - Signer object (not address)
 * @param {string} lopAddress - LOP contract address
 * @param {Object} originalAddresses - Original addresses before padding
 * @returns {Object} Signature components
 */
async function signOrder(order, signer, lopAddress, originalAddresses) {
  const domain = {
    name: "1inch Limit Order Protocol",
    version: "4",
    chainId: await ethers.provider.getNetwork().then(n => n.chainId),
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

  // Use original address values for signing (not the padded ones)
  const value = {
    salt: order.salt,
    maker: originalAddresses.maker,
    receiver: originalAddresses.receiver,
    makerAsset: originalAddresses.makerAsset,
    takerAsset: originalAddresses.takerAsset,
    makingAmount: order.makingAmount,
    takingAmount: order.takingAmount,
    makerTraits: order.makerTraits
  };

  const signature = await signer.signTypedData(domain, types, value);
  const { r, s, v } = ethers.Signature.from(signature);
  
  // EIP-2098 compact signature
  let vsBigInt = ethers.getBigInt(s);
  if (v === 28) {
    vsBigInt |= (1n << 255n);
  }
  const vs = ethers.zeroPadValue(ethers.toBeHex(vsBigInt), 32);

  return { signature, r, s, v, vs };
}

/**
 * Build a call option order (NFT creation)
 * @param {Object} params - Call option parameters
 * @param {string} params.maker - Maker address
 * @param {string} params.underlyingAsset - Underlying asset (e.g., ETH)
 * @param {string} params.strikeAsset - Strike asset (e.g., USDC)
 * @param {string} params.dummyTokenAddress - Dummy token address (used as maker asset placeholder)
 * @param {string|number} params.strikePrice - Strike price in strike asset units
 * @param {string|number} params.optionAmount - Amount of underlying in option
 * @param {string|number} params.premium - Premium in strike asset units
 * @param {number} params.expiry - Expiry timestamp
 * @param {Object} params.makerTraits - Maker traits flags
 * @param {number} params.lopNonce - LOP nonce for bit invalidator (optional, will auto-generate if not provided)
 * @returns {Object} Order object with tuple
 */
function buildCallOptionOrder(params) {
  const {
    maker,
    underlyingAsset,
    strikeAsset,
    dummyTokenAddress,
    strikePrice,
    optionAmount,
    premium,
    expiry,
    lopNonce,
    makerTraits = {},
    customMakerTraits = null  // NEW: Accept pre-built MakerTraits
  } = params;

  // Default maker traits with no partial fills
  const defaultMakerTraits = {
    noPartialFills: true,
    ...makerTraits
  };

  // Auto-generate LOP nonce if not provided
  const finalLopNonce = lopNonce !== undefined ? lopNonce : Math.floor(Math.random() * 1000000);

  const order = buildOrder({
    maker,
    makerAsset: dummyTokenAddress, // Use dummy token as placeholder
    takerAsset: strikeAsset,       // Taker pays premium in strike asset
    makingAmount: optionAmount,    // Maker "offers" option amount (dummy tokens)
    takingAmount: premium,         // Taker pays premium
    makerTraits: defaultMakerTraits,
    lopNonce: finalLopNonce,        // CRITICAL FIX: Pass the nonce
    customMakerTraits: customMakerTraits  // NEW: Pass custom traits
  });

  return {
    ...order,
    optionParams: {
      underlyingAsset,
      strikeAsset,
      dummyTokenAddress,
      strikePrice: ethers.getBigInt(strikePrice),
      optionAmount: ethers.getBigInt(optionAmount),
      premium: ethers.getBigInt(premium),
      expiry: BigInt(expiry)
    },
    lopNonce: finalLopNonce
  };
}

/**
 * Sign an OptionsNFT order using salt-based system (no nonce)
 * @param {Object} optionParams - Option parameters
 * @param {Object} signer - Signer object (not address)
 * @param {string} optionsNFTAddress - OptionsNFT contract address
 * @param {number} salt - Salt for uniqueness (replaces nonce)
 * @returns {Object} Signature components
 */
async function signOptionsNFT(optionParams, signer, optionsNFTAddress, salt = null) {
  // Generate random salt if not provided
  const finalSalt = salt !== null ? salt : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

  const domain = {
    name: "OptionNFT",
    version: "1",
    chainId: await ethers.provider.getNetwork().then(n => n.chainId),
    verifyingContract: optionsNFTAddress
  };

  const types = {
    Option: [
      { name: "underlyingAsset", type: "address" },
      { name: "strikeAsset", type: "address" },
      { name: "maker", type: "address" },
      { name: "strikePrice", type: "uint256" },
      { name: "expiry", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "salt", type: "uint256" }  // Changed from nonce to salt
    ]
  };

  const value = {
    underlyingAsset: optionParams.underlyingAsset,
    strikeAsset: optionParams.strikeAsset,
    maker: signer.address,
    strikePrice: optionParams.strikePrice,
    expiry: optionParams.expiry,
    amount: optionParams.optionAmount,
    salt: BigInt(finalSalt)  // Using salt instead of nonce
  };

  const signature = await signer.signTypedData(domain, types, value);
  const { r, s, v } = ethers.Signature.from(signature);

  return { signature, r, s, v, salt: finalSalt };
}

/**
 * Build interaction data for OptionsNFT
 * @param {Object} params - Interaction parameters
 * @param {string} params.maker - Maker address
 * @param {Object} params.optionParams - Option parameters
 * @param {Object} params.signature - OptionsNFT signature
 * @param {string} params.optionsNFTAddress - OptionsNFT contract address
 * @returns {Object} Interaction data
 */
function buildOptionsNFTInteraction(params) {
  const { maker, optionParams, signature, optionsNFTAddress } = params;

  // Encode interaction data: maker, optionParams, signature components
  const interactionData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint8", "bytes32", "bytes32"],
    [
      maker,
      optionParams.underlyingAsset,
      optionParams.strikeAsset,
      optionParams.strikePrice,
      optionParams.expiry,
      optionParams.optionAmount,
      signature.salt,  // Using salt instead of nonce
      signature.v,
      signature.r,
      signature.s
    ]
  );

  // Prepend contract address (20 bytes) to interaction data
  const fullInteractionData = ethers.concat([
    optionsNFTAddress,
    interactionData
  ]);

  return {
    data: fullInteractionData,
    length: fullInteractionData.length,
    contractAddress: optionsNFTAddress,
    decodedData: {
      maker,
      underlyingAsset: optionParams.underlyingAsset,
      strikeAsset: optionParams.strikeAsset,
      strikePrice: optionParams.strikePrice,
      expiry: optionParams.expiry,
      amount: optionParams.optionAmount,
      salt: signature.salt,  // Using salt instead of nonce
      v: signature.v,
      r: signature.r,
      s: signature.s
    }
  };
}

// LOP nonce tracker for testing (can be removed in production)
const lopNonceTracker = new Map();

/**
 * Get next LOP nonce for a maker (for testing)
 * @param {string} makerAddress - Maker address
 * @returns {number} Next LOP nonce
 */
function getNextLopNonce(makerAddress) {
  const current = lopNonceTracker.get(makerAddress) || 0;
  const next = current + 1;
  lopNonceTracker.set(makerAddress, next);
  return next;
}

/**
 * Reset LOP nonce for a maker (useful for testing)
 * @param {string} makerAddress - Maker address
 * @param {number} nonce - Nonce to set (optional, defaults to 0)
 */
function resetLopNonce(makerAddress, nonce = 0) {
  lopNonceTracker.set(makerAddress, nonce);
}

/**
 * Generate a unique salt for option signatures
 * @param {string} maker - Maker address
 * @param {Object} optionParams - Option parameters
 * @returns {number} Unique salt
 */
function generateUniqueSalt(maker, optionParams) {
  // Create a hash of the maker and option parameters plus timestamp for uniqueness
  const data = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint256"],
    [
      maker,
      optionParams.underlyingAsset,
      optionParams.strikeAsset,
      optionParams.strikePrice,
      optionParams.expiry,
      optionParams.optionAmount,
      Date.now(),
      Math.floor(Math.random() * 1000000)  // Smaller random number to avoid overflow
    ]
  );
  
  const hash = ethers.keccak256(data);
  // Use a simple approach: take first 8 hex chars and convert to number
  // This gives us a number in range 0 to 4,294,967,295 (32-bit)
  const saltHex = hash.slice(2, 10); // Take first 8 hex characters
  return parseInt(saltHex, 16);
}

/**
 * Check if an option hash is available (not used)
 * @param {string} optionsNFTAddress - OptionsNFT contract address
 * @param {Object} optionParams - Option parameters
 * @param {string} maker - Maker address
 * @param {number} salt - Salt for uniqueness
 * @returns {Promise<boolean>} True if hash is available
 */
async function isOptionHashAvailable(optionsNFTAddress, optionParams, maker, salt) {
  const optionsNFT = await ethers.getContractAt("OptionNFT", optionsNFTAddress);
  return await optionsNFT.isOptionHashAvailable(
    optionParams.underlyingAsset,
    optionParams.strikeAsset,
    maker,
    optionParams.strikePrice,
    optionParams.expiry,
    optionParams.optionAmount,
    salt
  );
}

/**
 * Complete call option order builder with automatic salt generation
 * @param {Object} params - Complete call option parameters
 * @param {Object} params.makerSigner - Maker signer object
 * @param {string} params.underlyingAsset - Underlying asset address
 * @param {string} params.strikeAsset - Strike asset address
 * @param {string} params.dummyTokenAddress - Dummy token address (used as maker asset placeholder)
 * @param {string|number} params.strikePrice - Strike price
 * @param {string|number} params.optionAmount - Option amount
 * @param {string|number} params.premium - Premium amount
 * @param {number} params.expiry - Expiry timestamp
 * @param {string} params.lopAddress - LOP contract address
 * @param {string} params.optionsNFTAddress - OptionsNFT contract address
 * @param {number} params.salt - Salt for signature (optional, will auto-generate if not provided)
 * @param {number} params.lopNonce - LOP nonce for bit invalidator (optional, will auto-generate if not provided)
 * @returns {Object} Complete order with signatures
 */
async function buildCompleteCallOption(params) {
  const {
    makerSigner,
    underlyingAsset,
    strikeAsset,
    dummyTokenAddress,
    strikePrice,
    optionAmount,
    premium,
    expiry,
    lopAddress,
    optionsNFTAddress,
    salt,
    lopNonce,
    customMakerTraits = null  // NEW: Accept pre-built MakerTraits from SDK
  } = params;

  // Auto-generate salt if not provided
  let finalSalt = salt;
  if (finalSalt === undefined) {
    finalSalt = generateUniqueSalt(makerSigner.address, {
      underlyingAsset,
      strikeAsset,
      strikePrice: ethers.getBigInt(strikePrice),
      expiry: BigInt(expiry),
      optionAmount: ethers.getBigInt(optionAmount)
    });
    console.log(`🔢 Auto-generated salt: ${finalSalt} for maker ${makerSigner.address}`);
  }

  // 1. Build the LOP order
  const orderResult = buildCallOptionOrder({
    maker: makerSigner.address,
    underlyingAsset,
    strikeAsset,
    dummyTokenAddress,
    strikePrice,
    optionAmount,
    premium,
    expiry,
    lopNonce,
    customMakerTraits: customMakerTraits  // NEW: Pass custom traits
  });

  // 2. Sign the LOP order
  const lopSignature = await signOrder(orderResult.order, makerSigner, lopAddress, orderResult.originalAddresses);

  // 3. Sign the OptionsNFT
  const optionsNFTSignature = await signOptionsNFT(
    orderResult.optionParams,
    makerSigner,
    optionsNFTAddress,
    finalSalt
  );

  // 4. Build interaction data
  const interaction = buildOptionsNFTInteraction({
    maker: makerSigner.address,
    optionParams: orderResult.optionParams,
    signature: optionsNFTSignature,
    optionsNFTAddress
  });

  return {
    order: orderResult.order,
    orderTuple: orderResult.orderTuple,
    originalAddresses: orderResult.originalAddresses,  // Add this line
    optionParams: orderResult.optionParams,
    lopSignature,
    optionsNFTSignature,
    interaction,
    salt: finalSalt,  // Return salt instead of nonce
    lopNonce: orderResult.lopNonce
  };
}

/**
 * Fill a call option order
 * @param {Object} params - Fill parameters
 * @param {Object} params.orderData - Complete order data from buildCompleteCallOption
 * @param {Object} params.takerSigner - Taker signer object
 * @param {string|number} params.fillAmount - Amount to fill
 * @param {string} params.lopAddress - LOP contract address
 * @returns {Object} Transaction result
 */
async function fillCallOption(params) {
  const { orderData, takerSigner, fillAmount, lopAddress } = params;

  const lop = await ethers.getContractAt("LimitOrderProtocol", lopAddress);

  const tx = await lop.connect(takerSigner).fillOrderArgs(
    orderData.orderTuple,
    orderData.lopSignature.r,
    orderData.lopSignature.vs,
    ethers.getBigInt(fillAmount),
    buildTakerTraits(orderData.interaction.length),
    orderData.interaction.data
  );

  return await tx.wait();
}

// Dummy token management functions
async function deployDummyOptionToken(deployer = null) {
  const DummyOptionToken = await ethers.getContractFactory("DummyOptionToken");
  const dummyToken = await DummyOptionToken.deploy();
  await dummyToken.waitForDeployment();
  
  // For backward compatibility, return both contract and address
  if (deployer !== null) {
    return {
      contract: dummyToken,
      address: dummyToken.target
    };
  }
  
  return dummyToken;
}

async function setupDummyTokensForMaker(params) {
  const { dummyTokenAddress, maker, lopAddress, optionAmount } = params;
  
  const dummyToken = await ethers.getContractAt("DummyOptionToken", dummyTokenAddress);
  const makerSigner = await ethers.getSigner(maker);
  
  // Mint dummy tokens to maker
  await dummyToken.mint(maker, optionAmount);
  
  // Get current allowance and add the new optionAmount to it
  const currentAllowance = await dummyToken.allowance(maker, lopAddress);
  const newAllowance = currentAllowance + optionAmount;
  
  // Approve LOP to spend the increased amount of dummy tokens
  await dummyToken.connect(makerSigner).approve(lopAddress, newAllowance);
  
  console.log(`✅ Setup ${ethers.formatEther(optionAmount)} dummy tokens for maker ${maker}`);
  console.log(`   Total allowance now: ${ethers.formatEther(newAllowance)}`);
}

async function cleanupDummyTokens(dummyTokenAddress, holder) {
  const dummyToken = await ethers.getContractAt("DummyOptionToken", dummyTokenAddress);
  const holderSigner = await ethers.getSigner(holder);
  
  const balance = await dummyToken.balanceOf(holder);
  if (balance > 0) {
    await dummyToken.connect(holderSigner).burn(balance);
    console.log(`🔥 Burned ${ethers.formatEther(balance)} dummy tokens for ${holder}`);
  }
}

module.exports = {
  // Core functions
  buildOrder,
  signOrder,
  buildCallOptionOrder,
  signOptionsNFT,
  buildOptionsNFTInteraction,
  
  // High-level functions
  buildCompleteCallOption,
  fillCallOption,
  
  // Utility functions
  toAddressType,
  setMakerTraits,
  buildTakerTraits,
  calculateTakerTraits,  // NEW: Helper to calculate taker traits
  prepareOrderForFilling,  // NEW: Prepare order for filling
  getNextLopNonce,
  resetLopNonce,
  generateUniqueSalt,
  isOptionHashAvailable,
  
  // Dummy token functions
  deployDummyOptionToken,
  setupDummyTokensForMaker,
  cleanupDummyTokens
}; 
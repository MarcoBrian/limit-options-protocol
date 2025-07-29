const { ethers } = require("hardhat");

// Helper to encode address as 32-byte left-padded hex string (1inch Address type)
function toAddressType(addr) {
  addr = addr.toLowerCase().replace(/^0x/, "");
  return "0x" + addr.padStart(64, "0");
}

// Helper to set maker traits flags
function setMakerTraits(flags = {}) {
  let traits = 0n;
  
  // Encode nonce in bits [120-159] (40 bits)
  if (flags.nonce !== undefined) {
    traits |= (BigInt(flags.nonce) << 120n);
  }
  
  // Encode expiry in bits [80-119] (40 bits)
  if (flags.expiry !== undefined) {
    traits |= (BigInt(flags.expiry) << 80n);
  }
  
  // Encode allowed sender in bits [0-79] (80 bits)
  if (flags.allowedSender && flags.allowedSender !== "0x0000000000000000000000000000000000000000") {
    traits |= (BigInt(flags.allowedSender) & ((1n << 80n) - 1n));
  }
  
  // Encode series in bits [160-199] (40 bits)
  if (flags.series !== undefined) {
    traits |= (BigInt(flags.series) << 160n);
  }
  
  // Set flags (high bits)
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
    makerAsset,
    takerAsset,
    makingAmount,
    takingAmount,
    receiver = maker,
    makerTraits = {}
  } = params;

  const salt = ethers.getBigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  
  const order = {
    salt,
    maker: toAddressType(maker),
    receiver: toAddressType(receiver),
    makerAsset: toAddressType(makerAsset),
    takerAsset: toAddressType(takerAsset),
    makingAmount: ethers.getBigInt(makingAmount),
    takingAmount: ethers.getBigInt(takingAmount),
    makerTraits: setMakerTraits(makerTraits)
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
    makerTraits = {},
    lopNonce
  } = params;

  // Generate LOP nonce if not provided
  const finalLopNonce = lopNonce !== undefined ? lopNonce : getNextLopNonce(maker);

  // For call options with dummy token approach:
  // - Maker offers dummy tokens (placeholder, gets transferred to taker)
  // - Taker pays premium (USDC)
  // - Real ETH collateral handled by OptionsNFT contract
  // - NFT gets minted via takerInteraction
  const order = buildOrder({
    maker,
    makerAsset: dummyTokenAddress,    // ✅ Use dummy token as maker asset
    takerAsset: strikeAsset,          // USDC
    makingAmount: optionAmount,       // ✅ Amount of dummy tokens to transfer
    takingAmount: premium,            // Taker pays premium
    receiver: maker,                  // Maker receives premium
    makerTraits: {
      ...makerTraits,
      nonce: finalLopNonce  // Set LOP nonce for bit invalidator
    }
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
 * Sign an OptionsNFT order
 * @param {Object} optionParams - Option parameters
 * @param {Object} signer - Signer object (not address)
 * @param {string} optionsNFTAddress - OptionsNFT contract address
 * @param {number} nonce - Nonce for the signature
 * @returns {Object} Signature components
 */
async function signOptionsNFT(optionParams, signer, optionsNFTAddress, nonce = 1) {
  // Calculate domain separator manually
  const optionsNFTDomainSeparator = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
        ethers.keccak256(ethers.toUtf8Bytes("OptionNFT")),
        ethers.keccak256(ethers.toUtf8Bytes("1")),
        await ethers.provider.getNetwork().then(n => n.chainId),
        optionsNFTAddress
      ]
    )
  );

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
      { name: "nonce", type: "uint256" }
    ]
  };

  const value = {
    underlyingAsset: optionParams.underlyingAsset,
    strikeAsset: optionParams.strikeAsset,
    maker: signer.address,
    strikePrice: optionParams.strikePrice,
    expiry: optionParams.expiry,
    amount: optionParams.optionAmount,
    nonce: BigInt(nonce)
  };

  const signature = await signer.signTypedData(domain, types, value);
  const { r, s, v } = ethers.Signature.from(signature);

  return { signature, r, s, v, nonce };
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

  const interactionData = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "address",    // maker
      "address",    // underlyingAsset
      "address",    // strikeAsset
      "uint256",    // strikePrice
      "uint256",    // expiry
      "uint256",    // amount
      "uint256",    // nonce
      "uint8",      // v
      "bytes32",    // r
      "bytes32"     // s
    ],
    [
      maker,
      optionParams.underlyingAsset,
      optionParams.strikeAsset,
      optionParams.strikePrice,
      optionParams.expiry,
      optionParams.optionAmount,
      signature.nonce,
      signature.v,
      signature.r,
      signature.s
    ]
  );

  const fullInteractionData = ethers.concat([
    ethers.zeroPadValue(optionsNFTAddress, 20),
    interactionData
  ]);

  const interactionLength = BigInt(fullInteractionData.length / 2 - 1);
  const takerTraits = buildTakerTraits(interactionLength);

  return {
    interactionData,
    fullInteractionData,
    takerTraits,
    interactionLength
  };
}

/**
 * Get the next available nonce for a maker from the OptionsNFT contract
 * @param {string} makerAddress - Maker address
 * @param {string} optionsNFTAddress - OptionsNFT contract address
 * @returns {Promise<number>} Next available nonce
 */
async function getNextNonce(makerAddress, optionsNFTAddress) {
  const optionsNFT = await ethers.getContractAt("OptionNFT", optionsNFTAddress);
  const nonce = await optionsNFT.getNextNonce(makerAddress);
  return Number(nonce);
}

// LOP nonce tracking per maker
const lopNonceTracker = new Map();

/**
 * Get the next available LOP nonce for a maker
 * @param {string} makerAddress - Maker address
 * @returns {number} Next available LOP nonce
 */
function getNextLopNonce(makerAddress) {
  const currentNonce = lopNonceTracker.get(makerAddress) || 0;
  const nextNonce = currentNonce + 1;
  lopNonceTracker.set(makerAddress, nextNonce);
  return nextNonce;
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
 * Get the next available LOP nonce from SeriesNonceManager
 * @param {string} makerAddress - Maker address
 * @param {string} seriesNonceManagerAddress - SeriesNonceManager contract address
 * @param {number} series - Series number (default: 0)
 * @returns {Promise<number>} Next available LOP nonce
 */
async function getNextLopNonceFromSeries(makerAddress, seriesNonceManagerAddress, series = 0) {
  const seriesNonceManager = await ethers.getContractAt("SeriesNonceManager", seriesNonceManagerAddress);
  const currentNonce = await seriesNonceManager.nonce(series, makerAddress);
  return Number(currentNonce);
}

/**
 * Advance LOP nonce in SeriesNonceManager
 * @param {Object} signer - Signer object
 * @param {string} seriesNonceManagerAddress - SeriesNonceManager contract address
 * @param {number} series - Series number (default: 0)
 * @param {number} amount - Amount to advance (default: 1)
 * @returns {Promise<Object>} Transaction result
 */
async function advanceLopNonce(signer, seriesNonceManagerAddress, series = 0, amount = 1) {
  const seriesNonceManager = await ethers.getContractAt("SeriesNonceManager", seriesNonceManagerAddress);
  const tx = await seriesNonceManager.connect(signer).advanceNonce(series, amount);
  return tx;
}

/**
 * Check if LOP nonce equals expected value in SeriesNonceManager
 * @param {string} makerAddress - Maker address
 * @param {string} seriesNonceManagerAddress - SeriesNonceManager contract address
 * @param {number} series - Series number (default: 0)
 * @param {number} expectedNonce - Expected nonce value
 * @returns {Promise<boolean>} True if nonce equals expected value
 */
async function checkLopNonceEquals(makerAddress, seriesNonceManagerAddress, series = 0, expectedNonce) {
  const seriesNonceManager = await ethers.getContractAt("SeriesNonceManager", seriesNonceManagerAddress);
  const equals = await seriesNonceManager.nonceEquals(series, makerAddress, expectedNonce);
  return equals;
}

/**
 * Complete call option order builder with automatic nonce management
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
 * @param {number} params.nonce - Nonce for signature (optional, will auto-fetch if not provided)
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
    nonce,
    lopNonce
  } = params;

  // Auto-fetch nonce if not provided
  let finalNonce = nonce;
  if (finalNonce === undefined) {
    finalNonce = await getNextNonce(makerSigner.address, optionsNFTAddress);
    console.log(`🔢 Auto-fetched nonce: ${finalNonce} for maker ${makerSigner.address}`);
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
    lopNonce
  });

  // 2. Sign the LOP order
  const lopSignature = await signOrder(orderResult.order, makerSigner, lopAddress, orderResult.originalAddresses);

  // 3. Sign the OptionsNFT
  const optionsNFTSignature = await signOptionsNFT(
    orderResult.optionParams,
    makerSigner,
    optionsNFTAddress,
    finalNonce
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
    optionParams: orderResult.optionParams,
    lopSignature,
    optionsNFTSignature,
    interaction,
    nonce: finalNonce,
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
    orderData.interaction.takerTraits,
    orderData.interaction.fullInteractionData
  );

  return tx;
}

/**
 * Deploy and setup a dummy option token
 * @param {string} deployer - Deployer address
 * @returns {Object} Dummy token contract and address
 */
async function deployDummyOptionToken(deployer) {
  const DummyOptionToken = await ethers.getContractFactory("DummyOptionToken");
  const dummyToken = await DummyOptionToken.deploy();
  await dummyToken.waitForDeployment();
  
  return {
    contract: dummyToken,
    address: dummyToken.target
  };
}

/**
 * Setup dummy tokens for an option maker
 * @param {Object} params - Setup parameters
 * @param {string} params.dummyTokenAddress - Dummy token contract address
 * @param {string} params.maker - Maker address
 * @param {string} params.lopAddress - LOP contract address
 * @param {string|number} params.optionAmount - Amount of dummy tokens needed
 * @returns {Promise} Setup completion
 */
async function setupDummyTokensForMaker(params) {
  const { dummyTokenAddress, maker, lopAddress, optionAmount } = params;
  
  const dummyToken = await ethers.getContractAt("DummyOptionToken", dummyTokenAddress);
  const [deployer, makerSigner] = await ethers.getSigners();
  
  // Mint dummy tokens to maker (called by deployer/owner)
  await dummyToken.mint(maker, ethers.getBigInt(optionAmount));
  
  // Approve LOP to spend dummy tokens (called by maker)
  await dummyToken.connect(makerSigner).approve(lopAddress, ethers.getBigInt(optionAmount));
  
  console.log(`✅ Setup ${ethers.formatEther(optionAmount)} dummy tokens for maker ${maker}`);
}

/**
 * Cleanup dummy tokens received by taker (burn them since they have no value)
 * @param {string} dummyTokenAddress - Dummy token contract address
 * @param {string} taker - Taker address
 * @returns {Promise} Cleanup completion
 */
async function cleanupDummyTokens(dummyTokenAddress, taker) {
  const dummyToken = await ethers.getContractAt("DummyOptionToken", dummyTokenAddress);
  const [deployer, maker, takerSigner] = await ethers.getSigners();
  
  const balance = await dummyToken.balanceOf(taker);
  if (balance > 0) {
    await dummyToken.connect(takerSigner).burn(balance);
    console.log(`🔥 Burned ${ethers.formatEther(balance)} dummy tokens for taker ${taker}`);
  }
}

module.exports = {
  toAddressType,
  setMakerTraits,
  buildTakerTraits,
  buildOrder,
  signOrder,
  buildCallOptionOrder,
  signOptionsNFT,
  buildOptionsNFTInteraction,
  buildCompleteCallOption,
  fillCallOption,
  deployDummyOptionToken,
  setupDummyTokensForMaker,
  cleanupDummyTokens,
  getNextNonce,
  getNextLopNonce,
  resetLopNonce,
  getNextLopNonceFromSeries,
  advanceLopNonce,
  checkLopNonceEquals
}; 
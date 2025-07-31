// frontend/src/utils/orderBuilder.ts
import { ethers } from 'ethers';
import { OrderHashManager, RandomNonceManager } from './nonceManager';

// Note: Using simplified MakerTraits implementation for browser compatibility
// The @1inch/limit-order-sdk has Node.js dependencies that cause build issues

/**
 * Create MakerTraits using simplified implementation (browser-compatible)
 * Reusable helper for creating MakerTraits without SDK dependencies
 */
function createMakerTraitsSimple(options: any = {}): bigint {
  console.log(`🔧 Creating MakerTraits with simplified implementation (Browser-compatible)...`);
  
  let traits = BigInt(0);
  
  // Set nonce in bits [120..159] (40 bits)
  if (options.nonce !== undefined) {
    const nonceValue = BigInt(options.nonce) & (BigInt(1) << BigInt(40) - BigInt(1));
    traits |= (nonceValue << BigInt(120));
    console.log(`   ✅ Set nonce: ${options.nonce}`);
  }
  
  // Set flags using bit operations
  if (options.allowPartialFill === false) {
    traits |= (BigInt(1) << BigInt(255));
    console.log(`   ✅ Disabled partial fills`);
  }
  
  if (options.allowMultipleFills === false) {
    traits |= (BigInt(1) << BigInt(254));
    console.log(`   ✅ Disabled multiple fills`);
  }
  
  if (options.postInteraction) {
    traits |= (BigInt(1) << BigInt(251));
    console.log(`   ✅ Enabled post-interaction`);
  }
  
  if (options.preInteraction) {
    traits |= (BigInt(1) << BigInt(252));
    console.log(`   ✅ Enabled pre-interaction`);
  }
  
  if (options.usePermit2) {
    traits |= (BigInt(1) << BigInt(248));
    console.log(`   ✅ Enabled Permit2`);
  }
  
  if (options.unwrapWeth) {
    traits |= (BigInt(1) << BigInt(247));
    console.log(`   ✅ Enabled WETH unwrapping`);
  }
  
  // Handle allowedSender (simplified - not implemented in browser version)
  if (options.allowedSender && options.allowedSender !== '0x0000000000000000000000000000000000000000') {
    console.log(`   ⚠️ Skipped allowed sender (not implemented in browser version)`);
  }
  
  if (options.expiration) {
    // Set expiration in bits [160..191] (32 bits)
    const expirationValue = BigInt(options.expiration) & (BigInt(1) << BigInt(32) - BigInt(1));
    traits |= (expirationValue << BigInt(160));
    console.log(`   ✅ Set expiration: ${options.expiration}`);
  }
  
  // Log analysis
  const extractedNonce = (traits >> BigInt(120)) & (BigInt(1) << BigInt(40) - BigInt(1));
  const hasPostInteraction = (traits & (BigInt(1) << BigInt(251))) !== BigInt(0);
  const hasPartialFillsDisabled = (traits & (BigInt(1) << BigInt(255))) !== BigInt(0);
  const hasMultipleFillsDisabled = (traits & (BigInt(1) << BigInt(254))) !== BigInt(0);
  
  console.log(`   📊 Analysis:`);
  console.log(`      Nonce set: ${options.nonce || 0} → Extracted: ${extractedNonce}`);
  console.log(`      Partial fills allowed: ${!hasPartialFillsDisabled}`);
  console.log(`      Multiple fills allowed: ${!hasMultipleFillsDisabled}`);
  console.log(`      Has post-interaction: ${hasPostInteraction}`);
  
  return traits;
}

// Helper to encode address as 32-byte left-padded hex string (1inch Address type)
function toAddressType(addr: string): string {
  addr = addr.toLowerCase().replace(/^0x/, "");
  return "0x" + addr.padStart(64, "0");
}

// Build a standard LOP order
function buildOrder(params: {
  maker: string;
  receiver?: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: string | number;
  takingAmount: string | number;
  makerTraits?: any;
  lopNonce?: number;
  customMakerTraits?: bigint;
}) {
  const {
    maker,
    receiver = maker,
    makerAsset,
    takerAsset,
    makingAmount,
    takingAmount,
    makerTraits = {},
    lopNonce = 0,
    customMakerTraits = null
  } = params;

  const salt = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

  const order = {
    salt: BigInt(salt),
    maker: toAddressType(maker),
    receiver: toAddressType(receiver),
    makerAsset: toAddressType(makerAsset),
    takerAsset: toAddressType(takerAsset),
    makingAmount: BigInt(makingAmount),
    takingAmount: BigInt(takingAmount),
    makerTraits: customMakerTraits !== null ? customMakerTraits : createMakerTraitsSimple({ nonce: lopNonce, ...makerTraits })
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

  const originalAddresses = {
    maker,
    receiver,
    makerAsset,
    takerAsset
  };

  return { order, orderTuple, originalAddresses };
}

// Sign a LOP order
async function signOrder(
  order: any, 
  signer: ethers.Signer, 
  lopAddress: string, 
  originalAddresses: any
) {
  const domain = {
    name: "1inch Limit Order Protocol",
    version: "4",
    chainId: await signer.provider!.getNetwork().then(n => n.chainId),
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
  
  // Fix: Use Signature.from() for ethers v6
  const { r, s, v } = ethers.Signature.from(signature);
  
  let vsBigInt = BigInt(s);
  if (v === 28) {
    vsBigInt |= (BigInt(1) << BigInt(255));
  }
  const vs = ethers.zeroPadValue(ethers.toBeHex(vsBigInt), 32);

  return { signature, r, s, v, vs };
}

// Sign an OptionsNFT order using salt-based system
async function signOptionsNFT(
  optionParams: any,
  signer: ethers.Signer,
  optionsNFTAddress: string,
  salt: number | null = null
) {
  const finalSalt = salt !== null ? salt : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

  const domain = {
    name: "OptionNFT",
    version: "1",
    chainId: await signer.provider!.getNetwork().then(n => n.chainId),
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
      { name: "salt", type: "uint256" }
    ]
  };

  const value = {
    underlyingAsset: optionParams.underlyingAsset,
    strikeAsset: optionParams.strikeAsset,
    maker: await signer.getAddress(),
    strikePrice: optionParams.strikePrice,
    expiry: optionParams.expiry,
    amount: optionParams.optionAmount,
    salt: BigInt(finalSalt)
  };

  const signature = await signer.signTypedData(domain, types, value);
  
  // Fix: Use Signature.from() for ethers v6
  const { r, s, v } = ethers.Signature.from(signature);

  return { signature, r, s, v, salt: finalSalt };
}

// Build interaction data for OptionsNFT
function buildOptionsNFTInteraction(params: {
  maker: string;
  optionParams: any;
  signature: any;
  optionsNFTAddress: string;
}) {
  const { maker, optionParams, signature, optionsNFTAddress } = params;

  const interactionData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint8", "bytes32", "bytes32"],
    [
      maker,
      optionParams.underlyingAsset,
      optionParams.strikeAsset,
      optionParams.strikePrice,
      optionParams.expiry,
      optionParams.optionAmount,
      signature.salt,
      signature.v,
      signature.r,
      signature.s
    ]
  );

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
      salt: signature.salt,
      v: signature.v,
      r: signature.r,
      s: signature.s
    }
  };
}

// Generate a unique salt for option signatures
function generateUniqueSalt(maker: string, optionParams: any): number {
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
      Math.floor(Math.random() * 1000000)
    ]
  );
  
  const hash = ethers.keccak256(data);
  const saltHex = hash.slice(2, 10);
  return parseInt(saltHex, 16);
}

// Complete call option order builder
export async function buildCompleteCallOption(params: {
  makerSigner: ethers.Signer;
  underlyingAsset: string;
  strikeAsset: string;
  dummyTokenAddress: string;
  strikePrice: string | number;
  optionAmount: string | number;
  premium: string | number;
  expiry: number;
  lopAddress: string;
  optionsNFTAddress: string;
  salt?: number;
  lopNonce?: number;
  customMakerTraits?: bigint;
}) {
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
    optionsNFTAddress
  } = params;

  const makerAddress = await makerSigner.getAddress();

  // Initialize nonce manager and hash manager like backend
  console.log('\n🔍 Creating order hash manager for OptionsNFT salt...');
  const hashManager = new OrderHashManager();
  
  console.log('\n🎲 Initializing random nonce manager...');
  const nonceManager = new RandomNonceManager();

  // Generate unique salt using hash manager (like backend)
  const optionParams = {
    underlyingAsset,
    strikeAsset,
    strikePrice: BigInt(strikePrice),
    expiry: BigInt(expiry),
    optionAmount: BigInt(optionAmount)
  };
  
  const finalSalt = hashManager.generateUniqueSalt(makerAddress, {
    underlyingAsset,
    strikeAsset,
    strikePrice: BigInt(strikePrice),
    expiry: BigInt(expiry),
    optionAmount: BigInt(optionAmount)
  });
  console.log(`   Generated OptionsNFT salt: ${finalSalt}`);

  // Get LOP nonce using nonce manager (like backend)
  const lopNonceValue = await nonceManager.getRandomNonce(makerAddress);
  console.log(`   Using LOP nonce: ${lopNonceValue}`);

  // Create MakerTraits using simplified approach (like backend)
  const makerTraitsBigInt = createMakerTraitsSimple({
    nonce: lopNonceValue,
    allowPartialFill: false,  // No partial fills for options
    allowMultipleFills: false, // Single fill only
    postInteraction: true,    // Need post-interaction for OptionsNFT
  });

  // 1. Build the LOP order with proper nonce and traits
  const orderResult = buildOrder({
    maker: makerAddress,
    makerAsset: dummyTokenAddress,
    takerAsset: strikeAsset,
    makingAmount: optionAmount,
    takingAmount: premium,
    lopNonce: Number(lopNonceValue),
    customMakerTraits: makerTraitsBigInt
  });

  // 2. Sign the LOP order
  const lopSignature = await signOrder(orderResult.order, makerSigner, lopAddress, orderResult.originalAddresses);

  // 3. Sign the OptionsNFT
  const optionsNFTSignature = await signOptionsNFT(
    {
      underlyingAsset,
      strikeAsset,
      strikePrice: BigInt(strikePrice),
      expiry: BigInt(expiry),
      optionAmount: BigInt(optionAmount)
    },
    makerSigner,
    optionsNFTAddress,
    Number(finalSalt)
  );

  // 4. Build interaction data
  const interaction = buildOptionsNFTInteraction({
    maker: makerAddress,
    optionParams: {
      underlyingAsset,
      strikeAsset,
      strikePrice: BigInt(strikePrice),
      expiry: BigInt(expiry),
      optionAmount: BigInt(optionAmount)
    },
    signature: optionsNFTSignature,
    optionsNFTAddress
  });

  return {
    order: orderResult.order,
    orderTuple: orderResult.orderTuple,
    originalAddresses: orderResult.originalAddresses,
    optionParams: {
      underlyingAsset,
      strikeAsset,
      strikePrice: BigInt(strikePrice),
      expiry: BigInt(expiry),
      optionAmount: BigInt(optionAmount)
    },
    lopSignature,
    optionsNFTSignature,
    interaction,
    salt: Number(finalSalt),
    lopNonce: Number(lopNonceValue)
  };
}

export {
  buildOrder,
  signOrder,
  signOptionsNFT,
  buildOptionsNFTInteraction,
  generateUniqueSalt,
  toAddressType,
  createMakerTraitsSimple
};
// frontend/src/utils/orderBuilder.ts
import { ethers } from 'ethers';

// Empty export to make this a module
export {};

// Helper to encode address as 32-byte left-padded hex string (1inch Address type)
function toAddressType(addr: string): string {
  addr = addr.toLowerCase().replace(/^0x/, "");
  return "0x" + addr.padStart(64, "0");
}

// Helper to set maker traits flags
function setMakerTraits(flags: any = {}, nonce: number = 0): bigint {
  let traits = 0n;
  
  // Set nonce in bits [120..159] (40 bits)
  const nonceValue = BigInt(nonce) & ((1n << 40n) - 1n);
  traits |= (nonceValue << 120n);
  
  if (flags.postInteraction) {
    traits |= (1n << 251n);
  }
  if (flags.noPartialFills) {
    traits |= (1n << 255n);
  }
  if (flags.allowMultipleFills) {
    traits |= (1n << 254n);
  }
  if (flags.preInteraction) {
    traits |= (1n << 252n);
  }
  if (flags.hasExtension) {
    traits |= (1n << 249n);
  }
  if (flags.usePermit2) {
    traits |= (1n << 248n);
  }
  if (flags.unwrapWeth) {
    traits |= (1n << 247n);
  }
  
  return traits;
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
  const { r, s, v } = ethers.Signature.from(signature);
  
  let vsBigInt = BigInt(s);
  if (v === 28) {
    vsBigInt |= (1n << 255n);
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
    optionsNFTAddress,
    salt,
    lopNonce,
    customMakerTraits
  } = params;

  let finalSalt = salt;
  if (finalSalt === undefined) {
    finalSalt = generateUniqueSalt(await makerSigner.getAddress(), {
      underlyingAsset,
      strikeAsset,
      strikePrice: BigInt(strikePrice),
      expiry: BigInt(expiry),
      optionAmount: BigInt(optionAmount)
    });
  }

  // 1. Build the LOP order
  const orderResult = buildOrder({
    maker: await makerSigner.getAddress(),
    makerAsset: dummyTokenAddress,
    takerAsset: strikeAsset,
    makingAmount: optionAmount,
    takingAmount: premium,
    lopNonce,
    customMakerTraits
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
    finalSalt
  );

  // 4. Build interaction data
  const interaction = buildOptionsNFTInteraction({
    maker: await makerSigner.getAddress(),
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
    salt: finalSalt,
    lopNonce: lopNonce || 0
  };
}

export {
  buildOrder,
  signOrder,
  signOptionsNFT,
  buildOptionsNFTInteraction,
  generateUniqueSalt,
  toAddressType,
  setMakerTraits
};
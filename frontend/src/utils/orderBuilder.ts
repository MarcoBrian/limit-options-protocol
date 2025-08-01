// frontend/src/utils/orderBuilder.ts
import { ethers } from 'ethers';
import { OrderHashManager, RandomNonceManager } from './nonceManager';

// Note: Using simplified MakerTraits implementation for browser compatibility
// The @1inch/limit-order-sdk has Node.js dependencies that cause build issues

/**
 * Create MakerTraits using improved implementation that matches backend logic
 * Fixed to properly match the backend SDK behavior
 */
function createMakerTraitsSimple(options: any = {}): bigint {
  console.log(`🔧 Creating MakerTraits with improved implementation (SDK-compatible)...`);
  
  let traits = BigInt(0);
  
  // Set nonce in bits [120..159] (40 bits) - CRITICAL: Match backend exactly
  if (options.nonce !== undefined) {
    console.log(`   🔍 Processing nonce: ${options.nonce} (type: ${typeof options.nonce})`);
    const nonceValue = BigInt(options.nonce) & ((1n << 40n) - 1n);
    console.log(`   🔍 Nonce after masking: ${nonceValue}`);
    traits |= (nonceValue << 120n);
    console.log(`   ✅ Set nonce: ${options.nonce}`);
  }
  
  // CRITICAL: Fix flag positions to match backend SDK exactly
  // These are the correct 1inch LOP flag positions
  if (options.allowPartialFill === false || options.noPartialFills) {
    traits |= (1n << 255n); // NO_PARTIAL_FILLS_FLAG
    console.log(`   ✅ Disabled partial fills`);
  }
  
  if (options.allowMultipleFills === false) {
    traits |= (1n << 254n); // ALLOW_MULTIPLE_FILLS_FLAG (inverted logic)
    console.log(`   ✅ Disabled multiple fills`);
  }
  
  if (options.postInteraction) {
    traits |= (1n << 251n); // POST_INTERACTION_CALL_FLAG
    console.log(`   ✅ Enabled post-interaction`);
  }
  
  if (options.preInteraction) {
    traits |= (1n << 252n); // PRE_INTERACTION_CALL_FLAG
    console.log(`   ✅ Enabled pre-interaction`);
  }
  
  if (options.usePermit2) {
    traits |= (1n << 248n); // USE_PERMIT2_FLAG
    console.log(`   ✅ Enabled Permit2`);
  }
  
  if (options.unwrapWeth) {
    traits |= (1n << 247n); // UNWRAP_WETH_FLAG
    console.log(`   ✅ Enabled WETH unwrapping`);
  }
  
  if (options.hasExtension) {
    traits |= (1n << 249n); // HAS_EXTENSION_FLAG
    console.log(`   ✅ Enabled extension`);
  }
  
  // Handle allowedSender (simplified - not implemented in browser version)
  if (options.allowedSender && options.allowedSender !== '0x0000000000000000000000000000000000000000') {
    console.log(`   ⚠️ Skipped allowed sender (not implemented in browser version)`);
  }
  
  if (options.expiration) {
    // Set expiration in bits [160..191] (32 bits)
    const expirationValue = BigInt(options.expiration) & ((1n << 32n) - 1n);
    traits |= (expirationValue << 160n);
    console.log(`   ✅ Set expiration: ${options.expiration}`);
  }
  
  // Log analysis
  const extractedNonce = (traits >> 120n) & ((1n << 40n) - 1n);
  const hasPostInteraction = (traits & (1n << 251n)) !== 0n;
  const hasPartialFillsDisabled = (traits & (1n << 255n)) !== 0n;
  const hasMultipleFillsDisabled = (traits & (1n << 254n)) !== 0n;
  
  console.log(`   📊 Analysis:`);
  console.log(`      Nonce set: ${options.nonce || 0} → Extracted: ${extractedNonce}`);
  console.log(`      Partial fills allowed: ${!hasPartialFillsDisabled}`);
  console.log(`      Multiple fills allowed: ${!hasMultipleFillsDisabled}`);
  console.log(`      Has post-interaction: ${hasPostInteraction}`);
  console.log(`      Final traits value: 0x${traits.toString(16)}`);
  
  return traits;
}

// Helper to encode address as 32-byte left-padded hex string (1inch Address type)
function toAddressType(addr: string): string {
  // For ethers.js encoding, we need to use the original address format
  // The toAddressType function was incorrectly padding to 64 characters
  // Instead, we should use the standard 20-byte address format
  return addr.toLowerCase();
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

  // Generate small random salt like backend (not the large OptionsNFT salt)
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

  // 🔍 DEBUG: Print order hash calculation
  console.log('\n🔍 FRONTEND LOP ORDER HASH DEBUG:');
  console.log('   Salt:', order.salt.toString());
  console.log('   Maker (original):', maker);
  console.log('   Maker (padded):', order.maker);
  console.log('   Receiver (original):', receiver);
  console.log('   Receiver (padded):', order.receiver);
  console.log('   Maker Asset (original):', makerAsset);
  console.log('   Maker Asset (padded):', order.makerAsset);
  console.log('   Taker Asset (original):', takerAsset);
  console.log('   Taker Asset (padded):', order.takerAsset);
  console.log('   Making Amount:', order.makingAmount.toString());
  console.log('   Taking Amount:', order.takingAmount.toString());
  console.log('   Maker Traits:', order.makerTraits.toString());
  
  console.log('\n🔍 FRONTEND ORDER TUPLE:');
  console.log('   Order Tuple:', orderTuple);
  
  // Calculate the hash manually to verify
  try {
    const calculatedHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "address", "address", "address", "uint256", "uint256", "uint256"],
      orderTuple
    ));
    console.log('   Calculated Hash:', calculatedHash);
  } catch (error: any) {
    console.log('   ❌ Hash calculation failed:', error.message);
  }

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

  // 🔍 DEBUG: Print signature details
  console.log('\n🔍 FRONTEND LOP SIGNATURE DEBUG:');
  console.log('   Domain:', domain);
  console.log('   Types:', types);
  console.log('   Value:', value);
  console.log('   Signer Address:', await signer.getAddress());

  const signature = await signer.signTypedData(domain, types, value);
  
  // Fix: Use Signature.from() for ethers v6
  const { r, s, v } = ethers.Signature.from(signature);
  
  let vsBigInt = BigInt(s);
  if (v === 28) {
    vsBigInt |= (BigInt(1) << BigInt(255));
  }
  const vs = ethers.zeroPadValue(ethers.toBeHex(vsBigInt), 32);

  // 🔍 DEBUG: Print signature components
  console.log('\n🔍 FRONTEND LOP SIGNATURE COMPONENTS:');
  console.log('   Full Signature:', signature);
  console.log('   R:', r);
  console.log('   S:', s);
  console.log('   V:', v);
  console.log('   VS:', vs);

  // 🔍 DEBUG: Verify LOP signature immediately
  console.log('\n🔍 FRONTEND LOP SIGNATURE VERIFICATION:');
  console.log('   Expected Maker:', originalAddresses.maker);
  console.log('   Signature R:', r);
  console.log('   Signature S:', s);
  console.log('   Signature V:', v);
  
  // Calculate the LOP order hash for verification
  const lopOrderTuple = [
    order.salt,
    order.maker,
    order.receiver,
    order.makerAsset,
    order.takerAsset,
    order.makingAmount,
    order.takingAmount,
    order.makerTraits
  ];
  
  console.log('\n🔍 LOP HASH CALCULATION DEBUG:');
  console.log('   Order Tuple for Hash:', lopOrderTuple);
  console.log('   Order Tuple Types:', ["uint256", "address", "address", "address", "address", "uint256", "uint256", "uint256"]);
  
  const lopHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address", "address", "address", "address", "uint256", "uint256", "uint256"],
    lopOrderTuple
  ));
  
  console.log('   Calculated Hash:', lopHash);
  
  // Also calculate the EIP-712 hash that was actually signed
  const lopDomain = {
    name: "1inch Limit Order Protocol",
    version: "4",
    chainId: await signer.provider!.getNetwork().then(n => n.chainId),
    verifyingContract: lopAddress
  };
  
  const lopTypes = {
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
  
  const lopValue = {
    salt: order.salt,
    maker: originalAddresses.maker,
    receiver: originalAddresses.receiver,
    makerAsset: originalAddresses.makerAsset,
    takerAsset: originalAddresses.takerAsset,
    makingAmount: order.makingAmount,
    takingAmount: order.takingAmount,
    makerTraits: order.makerTraits
  };
  
  console.log('\n🔍 LOP EIP-712 HASH DEBUG:');
  console.log('   Domain:', lopDomain);
  console.log('   Types:', lopTypes);
  console.log('   Value:', lopValue);
  
  // Calculate the EIP-712 hash that was actually signed
  const lopDomainSeparatorHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "bytes32", "uint256", "address"],
    [
      ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
      ethers.keccak256(ethers.toUtf8Bytes(lopDomain.name)),
      ethers.keccak256(ethers.toUtf8Bytes(lopDomain.version)),
      lopDomain.chainId,
      lopDomain.verifyingContract
    ]
  ));
  
  const LOP_ORDER_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes(
    "Order(uint256 salt,address maker,address receiver,address makerAsset,address takerAsset,uint256 makingAmount,uint256 takingAmount,uint256 makerTraits)"
  ));
  
  const lopStructHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "address", "address", "address", "address", "uint256", "uint256", "uint256"],
    [
      LOP_ORDER_TYPEHASH,
      lopValue.salt,
      lopValue.maker,
      lopValue.receiver,
      lopValue.makerAsset,
      lopValue.takerAsset,
      lopValue.makingAmount,
      lopValue.takingAmount,
      lopValue.makerTraits
    ]
  ));
  
  const lopEip712Hash = ethers.keccak256(ethers.concat([
    ethers.toUtf8Bytes("\x19\x01"),
    lopDomainSeparatorHash,
    lopStructHash
  ]));
  
  console.log('   EIP-712 Hash (what was actually signed):', lopEip712Hash);
  console.log('   Direct Hash (what we were using):', lopHash);
  console.log('   Hashes Match:', lopEip712Hash === lopHash);
  
  // Try recovering from both hashes
  const lopRecoveredFromDirect = ethers.recoverAddress(lopHash, { r, s, v });
  const lopRecoveredFromEip712 = ethers.recoverAddress(lopEip712Hash, { r, s, v });
  
  console.log('\n🔍 LOP RECOVERY COMPARISON:');
  console.log('   Recovered from Direct Hash:', lopRecoveredFromDirect);
  console.log('   Recovered from EIP-712 Hash:', lopRecoveredFromEip712);
  console.log('   Expected Maker:', originalAddresses.maker);
  console.log('   Direct Match:', lopRecoveredFromDirect.toLowerCase() === originalAddresses.maker.toLowerCase());
  console.log('   EIP-712 Match:', lopRecoveredFromEip712.toLowerCase() === originalAddresses.maker.toLowerCase());
  
  // Use the EIP-712 hash for final verification
  const lopRecoveredAddress = lopRecoveredFromEip712;
  
  console.log('   LOP Order Hash:', lopEip712Hash);
  console.log('   LOP Recovered Address:', lopRecoveredAddress);
  console.log('   LOP Match:', lopRecoveredAddress.toLowerCase() === originalAddresses.maker.toLowerCase());
  
  if (lopRecoveredAddress.toLowerCase() !== originalAddresses.maker.toLowerCase()) {
    console.log('❌ FRONTEND LOP SIGNATURE MISMATCH!');
    console.log('   The LOP signature was created by a different account than expected.');
    console.log('   This indicates a MetaMask account issue.');
  } else {
    console.log('✅ FRONTEND LOP SIGNATURE VERIFICATION SUCCESS!');
  }

  return { signature, r, s, v, vs };
}

// Sign an OptionsNFT order using salt-based system
async function signOptionsNFT(
  optionParams: any,
  signer: ethers.Signer,
  optionsNFTAddress: string,
  salt: string | number | null = null
) {
  // Handle string or number salt properly and ensure it fits in uint256
  let finalSalt: bigint;
  if (salt !== null) {
    if (typeof salt === 'string') {
      // Parse the string salt carefully to avoid overflow
      try {
        finalSalt = ethers.getBigInt(salt);
      } catch (error) {
        console.log(`   ⚠️ Salt too large, truncating: ${salt}`);
        // Truncate to fit in uint256 if needed
        const truncated = salt.slice(0, 77); // Max length for uint256
        finalSalt = ethers.getBigInt(truncated);
      }
    } else {
      finalSalt = BigInt(salt);
    }
  } else {
    finalSalt = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  }

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

  const makerAddress = await signer.getAddress();
  console.log("🔍 META MASK ACCOUNT INFO:");
  console.log("   Connected Address:", makerAddress);
  console.log("   Network Chain ID:", domain.chainId);
  console.log("   OptionsNFT Contract:", optionsNFTAddress);
  
  const value = {
    underlyingAsset: optionParams.underlyingAsset,
    strikeAsset: optionParams.strikeAsset,
    maker: makerAddress,
    strikePrice: optionParams.strikePrice,
    expiry: optionParams.expiry,
    amount: optionParams.optionAmount, // This maps optionAmount to amount in the signature
    salt: finalSalt
  };

  const signature = await signer.signTypedData(domain, types, value);
  
  // Fix: Use Signature.from() for ethers v6
  const { r, s, v } = ethers.Signature.from(signature);

  // 🔍 VERIFY SIGNATURE IMMEDIATELY
  console.log("\n🔍 FRONTEND SIGNATURE VERIFICATION:");
  console.log("   Expected Maker:", value.maker);
  console.log("   Signature R:", r);
  console.log("   Signature S:", s);
  console.log("   Signature V:", v);
  
  // Calculate the hash the same way as the contract
  const domainSeparatorHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "bytes32", "uint256", "address"],
    [
      ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
      ethers.keccak256(ethers.toUtf8Bytes(domain.name)),
      ethers.keccak256(ethers.toUtf8Bytes(domain.version)),
      domain.chainId,
      domain.verifyingContract
    ]
  ));
  
  const OPTION_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes(
    "Option(address underlyingAsset,address strikeAsset,address maker,uint256 strikePrice,uint256 expiry,uint256 amount,uint256 salt)"
  ));
  
  const structHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "address", "address", "uint256", "uint256", "uint256", "uint256"],
    [
      OPTION_TYPEHASH,
      value.underlyingAsset,
      value.strikeAsset,
      value.maker,
      value.strikePrice,
      value.expiry,
      value.amount,
      value.salt
    ]
  ));
  
  const finalHash = ethers.keccak256(ethers.concat([
    ethers.toUtf8Bytes("\x19\x01"),
    domainSeparatorHash,
    structHash
  ]));
  
  // Recover the address from the signature
  const recoveredAddress = ethers.recoverAddress(finalHash, { r, s, v });
  
  console.log("   Recovered Address:", recoveredAddress);
  console.log("   Match:", recoveredAddress.toLowerCase() === value.maker.toLowerCase());
  
  if (recoveredAddress.toLowerCase() !== value.maker.toLowerCase()) {
    console.log("❌ FRONTEND SIGNATURE MISMATCH!");
    console.log("   The signature was created by a different account than expected.");
    console.log("   This indicates a MetaMask account issue.");
  } else {
    console.log("✅ FRONTEND OptionsNFT SIGNATURE VERIFICATION SUCCESS!");
  }

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

  // Return the hex string directly (like backend)
  return fullInteractionData;
}

// Generate a unique salt for option signatures
function generateUniqueSalt(maker: string, optionParams: any): string {
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
  // Use same approach as backend - return as string but limit to reasonable size
  // Take first 8 hex chars like the original backend generateUniqueSalt to avoid overflow
  const saltHex = hash.slice(2, 10); // Take first 8 hex characters
  const salt = parseInt(saltHex, 16);
  return salt.toString();
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
  salt?: string | number;  // Accept string or number like backend
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
  
  // Use provided salt or generate one (like backend)
  let finalSalt = params.salt;
  if (finalSalt === undefined) {
    finalSalt = hashManager.generateUniqueSalt(makerAddress, {
      underlyingAsset,
      strikeAsset,
      strikePrice: BigInt(strikePrice),
      expiry: BigInt(expiry),
      optionAmount: BigInt(optionAmount)
    });
    console.log(`   Auto-generated salt: ${finalSalt}`);
  } else {
    console.log(`   Using provided salt: ${finalSalt}`);
  }

  // Get LOP nonce using nonce manager (like backend)
  const lopNonceValue = await nonceManager.getRandomNonce(makerAddress);
  console.log(`   Using LOP nonce: ${lopNonceValue}`);

  // Create MakerTraits using exact backend approach - NO postInteraction flag!
  console.log(`🔍 Creating MakerTraits with nonce: ${lopNonceValue} (type: ${typeof lopNonceValue})`);
  const makerTraitsBigInt = createMakerTraitsSimple({
    nonce: lopNonceValue,
    noPartialFills: true,     // Match backend: use noPartialFills flag
    allowMultipleFills: false, // Single fill only  
    // NO postInteraction: true - backend doesn't set this!
  });
  console.log(`🔍 Created MakerTraits: ${makerTraitsBigInt} (hex: 0x${makerTraitsBigInt.toString(16)})`);

  // 1. Build the LOP order with proper nonce and traits (like backend)
  // Note: buildOrder generates its own small salt for LOP order
  const orderResult = buildOrder({
    maker: makerAddress,
    makerAsset: dummyTokenAddress,
    takerAsset: strikeAsset,
    makingAmount: optionAmount,
    takingAmount: premium,
    lopNonce: Number(lopNonceValue),
    customMakerTraits: makerTraitsBigInt
  });

  // Verify account consistency before signing
  const initialAccount = await makerSigner.getAddress();
  console.log('\n🔍 ACCOUNT CONSISTENCY CHECK:');
  console.log('   Initial Account:', initialAccount);
  console.log('   Expected Account:', makerAddress);
  console.log('   Account Match:', initialAccount.toLowerCase() === makerAddress.toLowerCase());
  
  if (initialAccount.toLowerCase() !== makerAddress.toLowerCase()) {
    console.log('❌ ACCOUNT MISMATCH BEFORE SIGNING!');
    console.log('   MetaMask is using a different account than expected.');
    throw new Error('Account mismatch: MetaMask is using a different account than expected');
  }

  // 2. Sign the LOP order
  console.log('\n🔍 BEFORE LOP SIGNATURE - Signer Address:', await makerSigner.getAddress());
  const lopSignature = await signOrder(orderResult.order, makerSigner, lopAddress, orderResult.originalAddresses);
  
  // Verify account hasn't changed after LOP signature
  const afterLopAccount = await makerSigner.getAddress();
  console.log('\n🔍 AFTER LOP SIGNATURE - Signer Address:', afterLopAccount);
  if (afterLopAccount.toLowerCase() !== makerAddress.toLowerCase()) {
    console.log('❌ ACCOUNT CHANGED AFTER LOP SIGNATURE!');
    console.log('   Expected:', makerAddress);
    console.log('   Actual:', afterLopAccount);
  }

  // Add a small delay to prevent MetaMask account switching
  console.log('\n⏳ Adding delay between signatures to prevent account switching...');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 3. Sign the OptionsNFT
  console.log('\n🔍 BEFORE OPTIONSNFT SIGNATURE - Signer Address:', await makerSigner.getAddress());
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
    finalSalt  // Use salt for OptionsNFT signature (like backend)
  );
  
  // Verify account hasn't changed after OptionsNFT signature
  const afterOptionsAccount = await makerSigner.getAddress();
  console.log('\n🔍 AFTER OPTIONSNFT SIGNATURE - Signer Address:', afterOptionsAccount);
  if (afterOptionsAccount.toLowerCase() !== makerAddress.toLowerCase()) {
    console.log('❌ ACCOUNT CHANGED AFTER OPTIONSNFT SIGNATURE!');
    console.log('   Expected:', makerAddress);
    console.log('   Actual:', afterOptionsAccount);
  }

  // 🔍 DEBUG: Print final order data
  console.log('\n🔍 FRONTEND FINAL ORDER DATA:');
  console.log('   Order Result:', orderResult);
  console.log('   LOP Signature:', lopSignature);
  console.log('   OptionsNFT Signature:', optionsNFTSignature);
  console.log('   Maker Address:', makerAddress);
  console.log('   LOP Address:', lopAddress);
  console.log('   OptionsNFT Address:', optionsNFTAddress);

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

  // 🔍 DEBUG: Final summary
  console.log('\n🔍 FRONTEND ORDER CREATION SUMMARY:');
  console.log('   ✅ LOP Order built and signed');
  console.log('   ✅ OptionsNFT signed');
  console.log('   ✅ Interaction data built');
  console.log('   ✅ Order ready for submission');
  console.log('   📋 Order Hash:', orderResult.order.salt ? 'Will be calculated by backend' : 'N/A');
  console.log('   👤 Maker Address:', makerAddress);
  console.log('   🔐 LOP Signature V:', lopSignature.v);
  console.log('   🔐 OptionsNFT Signature V:', optionsNFTSignature.v);
  
  // Calculate the LOP order hash for verification
  const lopOrderTuple = [
    orderResult.order.salt,
    orderResult.order.maker,
    orderResult.order.receiver,
    orderResult.order.makerAsset,
    orderResult.order.takerAsset,
    orderResult.order.makingAmount,
    orderResult.order.takingAmount,
    orderResult.order.makerTraits
  ];
  
  // Calculate the EIP-712 hash that was actually signed
  const lopDomainSeparatorHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "bytes32", "uint256", "address"],
    [
      ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
      ethers.keccak256(ethers.toUtf8Bytes("1inch Limit Order Protocol")),
      ethers.keccak256(ethers.toUtf8Bytes("4")),
      BigInt(31337), // Hardhat chainId
      lopAddress
    ]
  ));
  
  const LOP_ORDER_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes(
    "Order(uint256 salt,address maker,address receiver,address makerAsset,address takerAsset,uint256 makingAmount,uint256 takingAmount,uint256 makerTraits)"
  ));
  
  const lopStructHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "address", "address", "address", "address", "uint256", "uint256", "uint256"],
    [
      LOP_ORDER_TYPEHASH,
      orderResult.order.salt,
      orderResult.order.maker,
      orderResult.order.receiver,
      orderResult.order.makerAsset,
      orderResult.order.takerAsset,
      orderResult.order.makingAmount,
      orderResult.order.takingAmount,
      orderResult.order.makerTraits
    ]
  ));
  
  const lopEip712Hash = ethers.keccak256(ethers.concat([
    ethers.toUtf8Bytes("\x19\x01"),
    lopDomainSeparatorHash,
    lopStructHash
  ]));
  
  // Recover the address from the LOP signature using EIP-712 hash
  const lopRecoveredAddress = ethers.recoverAddress(lopEip712Hash, { r: lopSignature.r, s: lopSignature.s, v: lopSignature.v });
  
  // Calculate the hash the same way as the contract for OptionsNFT
  const domainSeparatorHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "bytes32", "uint256", "address"],
    [
      ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
      ethers.keccak256(ethers.toUtf8Bytes("OptionNFT")),
      ethers.keccak256(ethers.toUtf8Bytes("1")),
      BigInt(31337), // Use correct chainId instead of salt
      optionsNFTAddress
    ]
  ));
  
  const OPTION_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes(
    "Option(address underlyingAsset,address strikeAsset,address maker,uint256 strikePrice,uint256 expiry,uint256 amount,uint256 salt)"
  ));
  
  const structHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "address", "address", "uint256", "uint256", "uint256", "uint256"],
    [
      OPTION_TYPEHASH,
      optionParams.underlyingAsset,
      optionParams.strikeAsset,
      makerAddress, // Use the makerAddress from the function
      optionParams.strikePrice,
      optionParams.expiry,
      optionParams.optionAmount, // Use optionAmount instead of amount
      optionsNFTSignature.salt
    ]
  ));
  
  const finalHash = ethers.keccak256(ethers.concat([
    ethers.toUtf8Bytes("\x19\x01"),
    domainSeparatorHash,
    structHash
  ]));
  
  // Recover the address from the OptionsNFT signature
  const recoveredAddress = ethers.recoverAddress(finalHash, { r: optionsNFTSignature.r, s: optionsNFTSignature.s, v: optionsNFTSignature.v });
  
  // 🔍 DEBUG: Final signature verification summary
  console.log('\n🔍 FRONTEND FINAL SIGNATURE VERIFICATION SUMMARY:');
  console.log('   LOP Signature:');
  console.log('     Expected Maker:', makerAddress);
  console.log('     Recovered Address:', lopRecoveredAddress);
  console.log('     Match:', lopRecoveredAddress.toLowerCase() === makerAddress.toLowerCase());
  
  console.log('   OptionsNFT Signature:');
  console.log('     Expected Maker:', makerAddress);
  console.log('     Recovered Address:', recoveredAddress);
  console.log('     Match:', recoveredAddress.toLowerCase() === makerAddress.toLowerCase());
  
  // Check if both signatures are from the same account
  const bothFromSameAccount = lopRecoveredAddress.toLowerCase() === recoveredAddress.toLowerCase();
  console.log('   Both signatures from same account:', bothFromSameAccount);
  
  if (lopRecoveredAddress.toLowerCase() === makerAddress.toLowerCase() && 
      recoveredAddress.toLowerCase() === makerAddress.toLowerCase()) {
    console.log('✅ BOTH SIGNATURES MATCH EXPECTED MAKER!');
    console.log('   The order should work correctly.');
  } else if (lopRecoveredAddress.toLowerCase() === recoveredAddress.toLowerCase()) {
    console.log('⚠️ BOTH SIGNATURES FROM SAME ACCOUNT BUT NOT EXPECTED MAKER');
    console.log('   MetaMask is using a different account than expected.');
    console.log('   Need to import the correct account into MetaMask.');
  } else {
    console.log('❌ SIGNATURES FROM DIFFERENT ACCOUNTS');
    console.log('   This indicates a serious issue with the signing process.');
  }

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
    salt: finalSalt, // Return as string like backend
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
const { ethers } = require('hardhat');

// Import the REAL MakerTraits class from the correct SDK
const { MakerTraits } = require('@1inch/limit-order-sdk');

/**
 * Order Hash Manager for OptionsNFT salt generation
 */
class OrderHashManager {
  constructor(contractAddress, provider) {
    this.contractAddress = contractAddress;
    this.provider = provider;
    this.usedSalts = new Set();
  }

  generateUniqueSalt(makerAddress, optionParams) {
    const saltData = {
      maker: makerAddress,
      underlyingAsset: optionParams.underlyingAsset,
      strikeAsset: optionParams.strikeAsset,
      strikePrice: optionParams.strikePrice.toString(),
      expiry: optionParams.expiry,
      optionAmount: optionParams.optionAmount.toString()
    };

    const saltHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(saltData)));
    const salt = ethers.getBigInt(saltHash) % ethers.getBigInt("0xffffffffffffffffffffffffffffffffffffffff");

    // Ensure uniqueness
    if (this.usedSalts.has(salt.toString())) {
      return this.generateUniqueSalt(makerAddress, { ...optionParams, expiry: optionParams.expiry + 1 });
    }

    this.usedSalts.add(salt.toString());
    return salt.toString();
  }
}

/**
 * Simple Random Nonce Manager - 1inch Pattern
 * Uses random nonces with negligible collision probability
 */
class RandomNonceManager {
  constructor() {
    // No persistent storage needed for random nonces
  }
  
  /**
   * Generate random nonce following 1inch pattern
   * @returns {bigint} Random nonce between 0 and UINT_40_MAX
   */
  generateRandomNonce() {
    const UINT_40_MAX = 1099511627775n; // 2^40 - 1
    
    // Generate random BigInt using crypto.randomBytes
    const crypto = require('crypto');
    const randomBytes = crypto.randomBytes(5); // 40 bits = 5 bytes
    
    // Convert to hex string and then to BigInt
    const hexString = '0x' + randomBytes.toString('hex');
    const randomBigInt = ethers.getBigInt(hexString);
    
    // Ensure it's within UINT_40_MAX range
    const nonce = randomBigInt % (UINT_40_MAX + 1n);
    
    console.log(`   🎲 Generated random nonce: ${nonce} (max: ${UINT_40_MAX})`);
    return nonce;
  }
  
  /**
   * Get random nonce (1inch pattern)
   * @param {string} maker - Maker address (unused, kept for compatibility)
   * @param {Object} lopContract - LOP contract instance (unused, kept for compatibility)
   * @returns {Promise<bigint>} Random nonce
   */
  async getRandomNonce(maker, lopContract) {
    console.log(`🎲 Getting random nonce for ${maker} (1inch pattern)...`);
    
    // Simply generate a random nonce - no tracking needed
    const randomNonce = this.generateRandomNonce();
    
    console.log(`   ✅ Using random nonce: ${randomNonce}`);
    return randomNonce;
  }
  
  /**
   * Get next nonce (alias for random nonce for compatibility)
   * @param {string} maker - Maker address
   * @param {Object} lopContract - LOP contract instance
   * @returns {Promise<bigint>} Random nonce
   */
  async getNextNonce(maker, lopContract) {
    return await this.getRandomNonce(maker, lopContract);
  }
}

/**
 * Create MakerTraits using the REAL MakerTraits class (simplified)
 * Reusable helper for creating MakerTraits with proper SDK usage
 * @param {Object} options - MakerTraits options
 * @returns {bigint} Properly formatted MakerTraits using real SDK
 */
function createMakerTraitsSimple(options = {}) {
  console.log(`🔧 Creating MakerTraits with REAL @1inch/limit-order-sdk (Simple)...`);
  
  // Use the REAL MakerTraits class - simple approach like the example
  let traits = MakerTraits.default();
  
  // Set nonce using SDK (like the example)
  if (options.nonce !== undefined) {
    traits = traits.withNonce(BigInt(options.nonce));
    console.log(`   ✅ Set nonce: ${options.nonce}`);
  }
  
  // Set flags using SDK methods
  if (options.allowPartialFill === false) {
    traits = traits.disablePartialFills();
    console.log(`   ✅ Disabled partial fills`);
  }
  
  if (options.allowMultipleFills === false) {
    traits = traits.disableMultipleFills();
    console.log(`   ✅ Disabled multiple fills`);
  }
  
  if (options.postInteraction) {
    traits = traits.enablePostInteraction();
    console.log(`   ✅ Enabled post-interaction`);
  }
  
  if (options.preInteraction) {
    traits = traits.enablePreInteraction();
    console.log(`   ✅ Enabled pre-interaction`);
  }
  
  if (options.usePermit2) {
    traits = traits.enablePermit2();
    console.log(`   ✅ Enabled Permit2`);
  }
  
  if (options.unwrapWeth) {
    traits = traits.enableNativeUnwrap();
    console.log(`   ✅ Enabled WETH unwrapping`);
  }
  
  // Handle allowedSender more carefully to avoid SDK compatibility issues
  if (options.allowedSender && options.allowedSender !== '0x0000000000000000000000000000000000000000') {
    try {
      // Only set if it's a valid non-zero address
      traits = traits.withAllowedSender(options.allowedSender);
      console.log(`   ✅ Set allowed sender: ${options.allowedSender}`);
    } catch (error) {
      console.log(`   ⚠️ Skipped allowed sender due to SDK compatibility: ${error.message}`);
    }
  }
  
  if (options.expiration) {
    traits = traits.withExpiration(BigInt(options.expiration));
    console.log(`   ✅ Set expiration: ${options.expiration}`);
  }
  
  // Log SDK analysis
  const extractedNonce = traits.nonceOrEpoch();
  const isBitInvalidator = traits.isBitInvalidatorMode();
  
  console.log(`   📊 SDK Analysis:`);
  console.log(`      Nonce set: ${options.nonce || 0} → Extracted: ${extractedNonce}`);
  console.log(`      BitInvalidator mode: ${isBitInvalidator}`);
  console.log(`      Partial fills allowed: ${traits.isPartialFillAllowed()}`);
  console.log(`      Multiple fills allowed: ${traits.isMultipleFillsAllowed()}`);
  console.log(`      Has post-interaction: ${traits.hasPostInteraction()}`);
  console.log(`      Is private: ${traits.isPrivate()}`);
  
  // Return as bigint for compatibility with existing code
  return traits.asBigInt();
}

/**
 * Quick salt generation for testing
 * @param {string} makerAddress - Maker address
 * @returns {string} Random salt
 */
function quickSalt(makerAddress) {
  return Math.floor(Math.random() * Date.now()).toString();
}

/**
 * Create OrderHashManager instance
 * @param {string} contractAddress - Contract address
 * @param {Object} provider - Ethers provider
 * @returns {OrderHashManager} OrderHashManager instance
 */
function createOrderHashManager(contractAddress, provider) {
  return new OrderHashManager(contractAddress, provider);
}

/**
 * Create RandomNonceManager instance
 * @returns {RandomNonceManager} RandomNonceManager instance
 */
function createRandomNonceManager() {
  return new RandomNonceManager();
}

/**
 * Create PersistentNonceManager instance (deprecated, use RandomNonceManager)
 * @returns {RandomNonceManager} RandomNonceManager instance
 */
function createPersistentNonceManager() {
  console.log('⚠️  createPersistentNonceManager is deprecated, using RandomNonceManager');
  return new RandomNonceManager();
}

/**
 * Create SimpleNonceManager instance (deprecated, use RandomNonceManager)
 * @returns {RandomNonceManager} RandomNonceManager instance
 */
function createSimpleNonceManager() {
  console.log('⚠️  createSimpleNonceManager is deprecated, using RandomNonceManager');
  return new RandomNonceManager();
}

module.exports = {
  OrderHashManager,
  RandomNonceManager,
  createOrderHashManager,
  createRandomNonceManager,
  createPersistentNonceManager,
  createSimpleNonceManager,
  createMakerTraitsSimple,
  quickSalt
}; 
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
 * Simple Nonce Manager - Based on the user's example pattern
 * Reusable helper for managing LOP nonces with sequential approach
 */
class SimpleNonceManager {
  constructor() {
    this.localNonces = new Map(); // maker -> next nonce
  }
  
  /**
   * Get current nonce from LOP contract (simplified approach)
   * @param {string} maker - Maker address
   * @param {Object} lopContract - LOP contract instance
   * @returns {Promise<bigint>} Current nonce
   */
  async getCurrentNonce(maker, lopContract) {
    console.log(`🔍 Getting current nonce for ${maker} from LOP...`);
    
    try {
      // Try to get nonce from contract (if available)
      const nonce = await lopContract.nonces(maker);
      console.log(`   ✅ Current nonce from contract: ${nonce}`);
      return BigInt(nonce.toString());
    } catch (error) {
      console.log(`   ⚠️ Contract nonce method not available, using local counter`);
      // Fallback to local counter if contract method doesn't exist
      if (!this.localNonces.has(maker)) {
        this.localNonces.set(maker, 0n);
      }
      return this.localNonces.get(maker);
    }
  }
  
  /**
   * Get next nonce for a maker (simple sequential approach)
   * @param {string} maker - Maker address
   * @param {Object} lopContract - LOP contract instance
   * @returns {Promise<bigint>} Next nonce
   */
  async getNextNonce(maker, lopContract) {
    // Get current nonce
    const currentNonce = await this.getCurrentNonce(maker, lopContract);
    
    // Use local counter if we have one, otherwise use current + 1
    if (this.localNonces.has(maker)) {
      const localNonce = this.localNonces.get(maker);
      this.localNonces.set(maker, localNonce + 1n);
      console.log(`   📦 Using local nonce: ${localNonce}`);
      return localNonce;
    } else {
      // Start from current + 1
      const nextNonce = currentNonce + 1n;
      this.localNonces.set(maker, nextNonce + 1n);
      console.log(`   🔗 Using sequential nonce: ${nextNonce}`);
      return nextNonce;
    }
  }
  
  /**
   * Reset local nonce for a maker (useful for testing)
   * @param {string} maker - Maker address
   */
  resetNonce(maker) {
    this.localNonces.delete(maker);
    console.log(`   🔄 Reset nonce for ${maker}`);
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
 * Create SimpleNonceManager instance
 * @returns {SimpleNonceManager} SimpleNonceManager instance
 */
function createSimpleNonceManager() {
  return new SimpleNonceManager();
}

module.exports = {
  OrderHashManager,
  SimpleNonceManager,
  createOrderHashManager,
  createSimpleNonceManager,
  createMakerTraitsSimple,
  quickSalt
}; 
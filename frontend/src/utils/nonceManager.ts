import { ethers } from 'ethers';

/**
 * Order Hash Manager for OptionsNFT salt generation
 */
export class OrderHashManager {
  private usedSalts: Set<string> = new Set();

  generateUniqueSalt(makerAddress: string, optionParams: any): string {
    // Add randomness and timestamp to ensure uniqueness
    const saltData = {
      maker: makerAddress,
      underlyingAsset: optionParams.underlyingAsset,
      strikeAsset: optionParams.strikeAsset,
      strikePrice: optionParams.strikePrice.toString(),
      expiry: optionParams.expiry,
      optionAmount: optionParams.optionAmount.toString(),
      timestamp: Date.now(), // Add current timestamp for uniqueness
      random: Math.floor(Math.random() * 1000000) // Add random component
    };

    const saltHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(saltData)));
    // Use the same modulo as backend to ensure compatibility but avoid overflow
    const salt = ethers.getBigInt(saltHash) % ethers.getBigInt("0xffffffffffffffffffffffffffffffffffffffff");

    // Ensure uniqueness in this session
    if (this.usedSalts.has(salt.toString())) {
      // If collision (very unlikely with timestamp + random), try again with different random
      return this.generateUniqueSalt(makerAddress, { ...optionParams, timestamp: Date.now() + 1 });
    }

    this.usedSalts.add(salt.toString());
    console.log(`🔄 Generated salt: ${salt.toString()}`);
    return salt.toString(); // Return as string like backend
  }
}

/**
 * Simple Random Nonce Manager - 1inch Pattern
 * Uses random nonces with negligible collision probability
 */
export class RandomNonceManager {
  /**
   * Generate random nonce following 1inch pattern
   * @returns {bigint} Random nonce between 0 and UINT_40_MAX
   */
  generateRandomNonce(): bigint {
    const UINT_40_MAX = 1099511627775n; // 2^40 - 1
    
    // Generate random BigInt using Web Crypto API (browser-compatible)
    const randomBytes = new Uint8Array(5); // 40 bits = 5 bytes
    crypto.getRandomValues(randomBytes);
    
    // Convert to hex string and then to BigInt
    const hexString = '0x' + Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const randomBigInt = ethers.getBigInt(hexString);
    
    // Ensure it's within UINT_40_MAX range
    const nonce = randomBigInt % (UINT_40_MAX + 1n);
    
    console.log(`   🎲 Generated random nonce: ${nonce} (max: ${UINT_40_MAX})`);
    return nonce;
  }
  
  /**
   * Get random nonce (1inch pattern)
   * @param {string} maker - Maker address (unused, kept for compatibility)
   * @param {any} lopContract - LOP contract instance (unused, kept for compatibility)
   * @returns {Promise<bigint>} Random nonce
   */
  async getRandomNonce(maker: string, lopContract?: any): Promise<bigint> {
    console.log(`🎲 Getting random nonce for ${maker} (1inch pattern)...`);
    
    // Simply generate a random nonce - no tracking needed
    const randomNonce = this.generateRandomNonce();
    
    console.log(`   ✅ Using random nonce: ${randomNonce}`);
    return randomNonce;
  }
} 
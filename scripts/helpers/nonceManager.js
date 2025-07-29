const { ethers } = require("hardhat");

/**
 * Comprehensive nonce management for OptionsNFT
 */
class NonceManager {
  constructor(optionsNFTAddress) {
    this.optionsNFTAddress = optionsNFTAddress;
  }

  /**
   * Get the next available nonce for a maker
   * @param {string} makerAddress - Maker address
   * @returns {Promise<number>} Next available nonce
   */
  async getNextNonce(makerAddress) {
    const optionsNFT = await ethers.getContractAt("OptionNFT", this.optionsNFTAddress);
    const nonce = await optionsNFT.getNextNonce(makerAddress);
    return Number(nonce);
  }

  /**
   * Check if a nonce is available for a maker
   * @param {string} makerAddress - Maker address
   * @param {number} nonce - Nonce to check
   * @returns {Promise<boolean>} True if nonce is available
   */
  async isNonceAvailable(makerAddress, nonce) {
    const optionsNFT = await ethers.getContractAt("OptionNFT", this.optionsNFTAddress);
    const isAvailable = await optionsNFT.isNonceAvailable(makerAddress, nonce);
    return isAvailable;
  }

  /**
   * Get the current nonce for a maker
   * @param {string} makerAddress - Maker address
   * @returns {Promise<number>} Current nonce
   */
  async getCurrentNonce(makerAddress) {
    const optionsNFT = await ethers.getContractAt("OptionNFT", this.optionsNFTAddress);
    const nonce = await optionsNFT.getCurrentNonce(makerAddress);
    return Number(nonce);
  }

  /**
   * Advance nonce for a maker (for testing/debugging)
   * @param {Object} signer - Signer object
   * @param {number} amount - Amount to advance (default: 1)
   * @returns {Promise<Object>} Transaction result
   */
  async advanceNonce(signer, amount = 1) {
    const optionsNFT = await ethers.getContractAt("OptionNFT", this.optionsNFTAddress);
    const tx = await optionsNFT.connect(signer).advanceNonce(signer.address, amount);
    return await tx.wait();
  }

  /**
   * Validate nonce before using it
   * @param {string} makerAddress - Maker address
   * @param {number} nonce - Nonce to validate
   * @returns {Promise<boolean>} True if nonce is valid
   */
  async validateNonce(makerAddress, nonce) {
    const isAvailable = await this.isNonceAvailable(makerAddress, nonce);
    if (!isAvailable) {
      console.warn(`⚠️ Nonce ${nonce} is not available for maker ${makerAddress}`);
      return false;
    }
    return true;
  }

  /**
   * Get recommended nonce for a maker
   * @param {string} makerAddress - Maker address
   * @returns {Promise<number>} Recommended nonce
   */
  async getRecommendedNonce(makerAddress) {
    return await this.getNextNonce(makerAddress);
  }

  /**
   * Get comprehensive nonce information for a maker
   * @param {string} makerAddress - Maker address
   * @returns {Promise<Object>} Nonce information
   */
  async getNonceInfo(makerAddress) {
    const optionsNFT = await ethers.getContractAt("OptionNFT", this.optionsNFTAddress);
    
    const nextNonce = await this.getNextNonce(makerAddress);
    const currentNonce = await this.getCurrentNonce(makerAddress);
    const isAvailable = await this.isNonceAvailable(makerAddress, nextNonce);

    const info = {
      maker: makerAddress,
      nextNonce,
      currentNonce,
      isAvailable,
      optionsNFTAddress: this.optionsNFTAddress
    };

    return info;
  }

  /**
   * Get nonce usage statistics for a maker
   * @param {string} makerAddress - Maker address
   * @param {number} maxCheck - Maximum nonces to check (default: 100)
   * @returns {Promise<Object>} Nonce usage statistics
   */
  async getNonceStats(makerAddress, maxCheck = 100) {
    const currentNonce = await this.getCurrentNonce(makerAddress);
    let usedCount = 0;
    let availableCount = 0;
    let lastUsedNonce = 0;

    // Check nonces up to current nonce + maxCheck
    for (let i = 0; i < Math.min(currentNonce + maxCheck, currentNonce + 100); i++) {
      const isAvailable = await this.isNonceAvailable(makerAddress, i);
      if (!isAvailable) {
        usedCount++;
        lastUsedNonce = i;
      } else {
        availableCount++;
      }
    }

    return {
      maker: makerAddress,
      currentNonce,
      usedCount,
      availableCount,
      lastUsedNonce,
      nextAvailableNonce: currentNonce
    };
  }

  /**
   * Reset nonce for a maker (for testing only)
   * @param {Object} signer - Signer object
   * @param {number} targetNonce - Target nonce to reset to
   * @returns {Promise<Object>} Transaction result
   */
  async resetNonce(signer, targetNonce = 0) {
    const currentNonce = await this.getCurrentNonce(signer.address);
    const difference = currentNonce - targetNonce;
    
    if (difference > 0) {
      // We can't decrease nonce, so we need to advance by a large amount
      // This is a workaround for testing - in production, nonces should only increase
      console.warn(`⚠️ Cannot decrease nonce from ${currentNonce} to ${targetNonce}`);
      return null;
    } else if (difference < 0) {
      // Advance nonce to target
      return await this.advanceNonce(signer, Math.abs(difference));
    }
    
    return null;
  }
}

/**
 * Create a new NonceManager instance
 * @param {string} optionsNFTAddress - OptionsNFT contract address
 * @returns {NonceManager} NonceManager instance
 */
function createNonceManager(optionsNFTAddress) {
  return new NonceManager(optionsNFTAddress);
}

module.exports = {
  NonceManager,
  createNonceManager
}; 
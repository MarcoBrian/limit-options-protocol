const { ethers } = require("hardhat");

/**
 * Comprehensive nonce management for OptionsNFT
 */
class NonceManager {
  constructor(optionsNFTAddress, provider = null) {
    this.optionsNFTAddress = optionsNFTAddress;
    this.provider = provider;
  }

  /**
   * Get the contract instance with the correct provider
   */
  async getContract() {
    if (this.provider) {
      // Use provided provider (for tests)
      return new ethers.Contract(this.optionsNFTAddress, [
        'function getNextNonce(address maker) view returns (uint256)',
        'function getCurrentNonce(address maker) view returns (uint256)',
        'function isNonceAvailable(address maker, uint256 nonce) view returns (bool)',
        'function advanceNonce(address maker, uint256 amount)',
        'function nextOptionId() view returns (uint256)',
        'function limitOrderProtocol() view returns (address)'
      ], this.provider);
    } else {
      // Use Hardhat's provider (for scripts)
      return await ethers.getContractAt("OptionNFT", this.optionsNFTAddress);
    }
  }

  /**
   * Get the next available nonce for a maker
   * @param {string} makerAddress - Maker address
   * @returns {Promise<number>} Next available nonce
   */
  async getNextNonce(makerAddress) {
    const optionsNFT = await this.getContract();
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
    const optionsNFT = await this.getContract();
    const isAvailable = await optionsNFT.isNonceAvailable(makerAddress, nonce);
    return isAvailable;
  }

  /**
   * Get the current nonce for a maker
   * @param {string} makerAddress - Maker address
   * @returns {Promise<number>} Current nonce
   */
  async getCurrentNonce(makerAddress) {
    const optionsNFT = await this.getContract();
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
    const optionsNFT = await this.getContract();
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
    const optionsNFT = await this.getContract();
    
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
   * Get nonce statistics for a maker
   * @param {string} makerAddress - Maker address
   * @param {number} maxCheck - Maximum nonces to check
   * @returns {Promise<Object>} Nonce statistics
   */
  async getNonceStats(makerAddress, maxCheck = 100) {
    const stats = {
      maker: makerAddress,
      totalChecked: 0,
      availableNonces: [],
      usedNonces: [],
      nextAvailable: null
    };

    for (let i = 0; i < maxCheck; i++) {
      const isAvailable = await this.isNonceAvailable(makerAddress, i);
      stats.totalChecked++;
      
      if (isAvailable) {
        stats.availableNonces.push(i);
        if (stats.nextAvailable === null) {
          stats.nextAvailable = i;
        }
      } else {
        stats.usedNonces.push(i);
      }
    }

    return stats;
  }

  /**
   * Reset nonce for a maker (for testing)
   * @param {Object} signer - Signer object
   * @param {number} targetNonce - Target nonce to reset to
   * @returns {Promise<Object>} Transaction result
   */
  async resetNonce(signer, targetNonce = 0) {
    const currentNonce = await this.getCurrentNonce(signer.address);
    const advanceAmount = targetNonce - currentNonce;
    
    if (advanceAmount > 0) {
      return await this.advanceNonce(signer, advanceAmount);
    } else {
      console.log(`Current nonce ${currentNonce} is already >= target ${targetNonce}`);
      return null;
    }
  }
}

/**
 * Create a nonce manager instance
 * @param {string} optionsNFTAddress - OptionsNFT contract address
 * @param {Object} provider - Optional provider (for tests)
 * @returns {NonceManager} Nonce manager instance
 */
function createNonceManager(optionsNFTAddress, provider = null) {
  return new NonceManager(optionsNFTAddress, provider);
}

module.exports = {
  NonceManager,
  createNonceManager
}; 
const { ethers } = require("hardhat");

/**
 * Comprehensive nonce management for OptionsNFT
 */
class NonceManager {
  constructor(optionsNFTAddress, seriesNonceManagerAddress = null) {
    this.optionsNFTAddress = optionsNFTAddress;
    this.seriesNonceManagerAddress = seriesNonceManagerAddress;
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
   * Get nonce from SeriesNonceManager if available
   * @param {string} makerAddress - Maker address
   * @param {number} series - Series number (default: 0)
   * @returns {Promise<number>} Nonce from SeriesNonceManager
   */
  async getSeriesNonce(makerAddress, series = 0) {
    if (!this.seriesNonceManagerAddress) {
      throw new Error("SeriesNonceManager not configured");
    }

    const seriesNonceManager = await ethers.getContractAt("SeriesNonceManager", this.seriesNonceManagerAddress);
    const nonce = await seriesNonceManager.nonce(series, makerAddress);
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
    return await optionsNFT.isNonceAvailable(makerAddress, nonce);
  }

  /**
   * Get current nonce for a maker
   * @param {string} makerAddress - Maker address
   * @returns {Promise<number>} Current nonce
   */
  async getCurrentNonce(makerAddress) {
    const optionsNFT = await ethers.getContractAt("OptionNFT", this.optionsNFTAddress);
    const nonce = await optionsNFT.getCurrentNonce(makerAddress);
    return Number(nonce);
  }

  /**
   * Advance nonce in SeriesNonceManager
   * @param {Object} signer - Signer object
   * @param {number} series - Series number (default: 0)
   * @param {number} amount - Amount to advance (default: 1)
   * @returns {Promise<Object>} Transaction result
   */
  async advanceNonce(signer, series = 0, amount = 1) {
    if (!this.seriesNonceManagerAddress) {
      throw new Error("SeriesNonceManager not configured");
    }

    const seriesNonceManager = await ethers.getContractAt("SeriesNonceManager", this.seriesNonceManagerAddress);
    const tx = await seriesNonceManager.connect(signer).advanceNonce(series, amount);
    return await tx.wait();
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

    // Add SeriesNonceManager info if available
    if (this.seriesNonceManagerAddress) {
      try {
        const seriesNonce = await this.getSeriesNonce(makerAddress, 0);
        info.seriesNonce = seriesNonce;
        info.seriesNonceManagerAddress = this.seriesNonceManagerAddress;
      } catch (error) {
        info.seriesNonceError = error.message;
      }
    }

    return info;
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
   * Get recommended nonce for a maker (with validation)
   * @param {string} makerAddress - Maker address
   * @returns {Promise<number>} Recommended nonce
   */
  async getRecommendedNonce(makerAddress) {
    const nonce = await this.getNextNonce(makerAddress);
    const isValid = await this.validateNonce(makerAddress, nonce);
    
    if (!isValid) {
      throw new Error(`Invalid nonce ${nonce} for maker ${makerAddress}`);
    }
    
    console.log(`✅ Recommended nonce ${nonce} for maker ${makerAddress}`);
    return nonce;
  }
}

/**
 * Create a NonceManager instance
 * @param {string} optionsNFTAddress - OptionsNFT contract address
 * @param {string} seriesNonceManagerAddress - SeriesNonceManager address (optional)
 * @returns {NonceManager} NonceManager instance
 */
function createNonceManager(optionsNFTAddress, seriesNonceManagerAddress = null) {
  return new NonceManager(optionsNFTAddress, seriesNonceManagerAddress);
}

module.exports = {
  NonceManager,
  createNonceManager
}; 
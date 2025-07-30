const { ethers } = require("hardhat");

/**
 * Order Hash Manager for OptionsNFT
 * 
 * Manages order hash generation and validation for the salt-based replay protection system.
 * This replaces the old nonce-based system to allow parallel off-chain order creation.
 */
class OrderHashManager {
  constructor(optionsNFTAddress, provider = null) {
    this.optionsNFTAddress = optionsNFTAddress;
    this.provider = provider || ethers.provider;
    this.contract = null;
  }

  /**
   * Get or create the OptionsNFT contract instance
   * @returns {Promise<Contract>} OptionsNFT contract instance
   */
  async getContract() {
    if (!this.contract) {
      try {
        this.contract = await ethers.getContractAt("OptionNFT", this.optionsNFTAddress);
      } catch (error) {
        console.error("Failed to get OptionsNFT contract:", error.message);
        throw new Error(`Cannot connect to OptionsNFT at ${this.optionsNFTAddress}`);
      }
    }
    return this.contract;
  }

  /**
   * Generate a unique salt for option parameters
   * @param {string} maker - Maker address
   * @param {Object} optionParams - Option parameters
   * @returns {number} Unique salt
   */
  generateUniqueSalt(maker, optionParams) {
    // Create a hash of the maker and option parameters plus timestamp for uniqueness
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
        Math.floor(Math.random() * 1000000)  // Smaller random number to avoid overflow
      ]
    );
    
    const hash = ethers.keccak256(data);
    // Use a simple approach: take first 8 hex chars and convert to number
    // This gives us a number in range 0 to 4,294,967,295 (32-bit)
    const saltHex = hash.slice(2, 10); // Take first 8 hex characters
    return parseInt(saltHex, 16);
  }

  /**
   * Generate multiple unique salts
   * @param {string} maker - Maker address
   * @param {Object} optionParams - Option parameters
   * @param {number} count - Number of salts to generate
   * @returns {number[]} Array of unique salts
   */
  generateMultipleSalts(maker, optionParams, count = 1) {
    const salts = [];
    for (let i = 0; i < count; i++) {
      // Add a small delay and counter to ensure uniqueness
      const uniqueParams = {
        ...optionParams,
        _counter: i,
        _timestamp: Date.now() + i
      };
      salts.push(this.generateUniqueSalt(maker, uniqueParams));
    }
    return salts;
  }

  /**
   * Check if an option hash is available (not used)
   * @param {string} maker - Maker address
   * @param {Object} optionParams - Option parameters
   * @param {number} salt - Salt for uniqueness
   * @returns {Promise<boolean>} True if hash is available
   */
  async isOrderHashAvailable(maker, optionParams, salt) {
    try {
      const contract = await this.getContract();
      return await contract.isOptionHashAvailable(
        optionParams.underlyingAsset,
        optionParams.strikeAsset,
        maker,
        optionParams.strikePrice,
        optionParams.expiry,
        optionParams.optionAmount,
        salt
      );
    } catch (error) {
      console.error("Error checking order hash availability:", error.message);
      return false;
    }
  }

  /**
   * Generate the option hash for given parameters
   * @param {string} maker - Maker address
   * @param {Object} optionParams - Option parameters
   * @param {number} salt - Salt for uniqueness
   * @returns {Promise<string>} Option hash
   */
  async generateOptionHash(maker, optionParams, salt) {
    try {
      const contract = await this.getContract();
      return await contract.generateOptionHash(
        optionParams.underlyingAsset,
        optionParams.strikeAsset,
        maker,
        optionParams.strikePrice,
        optionParams.expiry,
        optionParams.optionAmount,
        salt
      );
    } catch (error) {
      console.error("Error generating option hash:", error.message);
      throw error;
    }
  }

  /**
   * Find an available salt for the given parameters
   * @param {string} maker - Maker address
   * @param {Object} optionParams - Option parameters
   * @param {number} maxAttempts - Maximum attempts to find available salt
   * @returns {Promise<number>} Available salt
   */
  async findAvailableSalt(maker, optionParams, maxAttempts = 10) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const salt = this.generateUniqueSalt(maker, optionParams);
      const isAvailable = await this.isOrderHashAvailable(maker, optionParams, salt);
      
      if (isAvailable) {
        return salt;
      }
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    throw new Error(`Could not find available salt after ${maxAttempts} attempts`);
  }

  /**
   * Get comprehensive order hash information
   * @param {string} maker - Maker address
   * @param {Object} optionParams - Option parameters
   * @param {number} salt - Salt for uniqueness
   * @returns {Promise<Object>} Order hash information
   */
  async getOrderHashInfo(maker, optionParams, salt) {
    try {
      const isAvailable = await this.isOrderHashAvailable(maker, optionParams, salt);
      const optionHash = await this.generateOptionHash(maker, optionParams, salt);
      
      return {
        maker,
        optionParams,
        salt,
        optionHash,
        isAvailable,
        isUsed: !isAvailable,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error getting order hash info:", error.message);
      throw error;
    }
  }

  /**
   * Validate order hash parameters
   * @param {string} maker - Maker address
   * @param {Object} optionParams - Option parameters
   * @param {number} salt - Salt for uniqueness
   * @returns {Promise<Object>} Validation result
   */
  async validateOrderHash(maker, optionParams, salt) {
    try {
      // Basic parameter validation
      if (!maker || !ethers.isAddress(maker)) {
        return { valid: false, error: "Invalid maker address" };
  }

      if (!optionParams.underlyingAsset || !ethers.isAddress(optionParams.underlyingAsset)) {
        return { valid: false, error: "Invalid underlying asset address" };
      }

      if (!optionParams.strikeAsset || !ethers.isAddress(optionParams.strikeAsset)) {
        return { valid: false, error: "Invalid strike asset address" };
      }

      if (!optionParams.strikePrice || optionParams.strikePrice <= 0) {
        return { valid: false, error: "Invalid strike price" };
      }

      if (!optionParams.expiry || optionParams.expiry <= Math.floor(Date.now() / 1000)) {
        return { valid: false, error: "Invalid or past expiry" };
      }

      if (!optionParams.optionAmount || optionParams.optionAmount <= 0) {
        return { valid: false, error: "Invalid option amount" };
      }

      if (salt === null || salt === undefined || salt < 0) {
        return { valid: false, error: "Invalid salt" };
      }

      // Check if hash is available
      const isAvailable = await this.isOrderHashAvailable(maker, optionParams, salt);
      if (!isAvailable) {
        return { valid: false, error: "Order hash already used" };
      }

      return { valid: true, error: null };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Create multiple parallel orders with unique salts
   * @param {string} maker - Maker address
   * @param {Object} baseOptionParams - Base option parameters
   * @param {number} count - Number of orders to create
   * @returns {Promise<Object[]>} Array of order configurations
   */
  async createParallelOrders(maker, baseOptionParams, count) {
    try {
      const orders = [];

      for (let i = 0; i < count; i++) {
        // Generate unique salt for each order
        const salt = await this.findAvailableSalt(maker, baseOptionParams);
        
        // Create order configuration
        const orderConfig = {
          maker,
          optionParams: { ...baseOptionParams },
          salt,
          orderIndex: i,
          timestamp: new Date().toISOString()
        };
        
        orders.push(orderConfig);
    }

      return orders;
    } catch (error) {
      console.error("Error creating parallel orders:", error.message);
      throw error;
    }
  }

  /**
   * Get statistics about order hash usage (for monitoring)
   * @param {string} maker - Maker address
   * @param {Object} optionParams - Option parameters
   * @param {number} sampleSize - Number of salts to sample
   * @returns {Promise<Object>} Usage statistics
   */
  async getUsageStats(maker, optionParams, sampleSize = 100) {
    try {
      let availableCount = 0;
      let usedCount = 0;
      const sampleSalts = this.generateMultipleSalts(maker, optionParams, sampleSize);
    
      for (const salt of sampleSalts) {
        const isAvailable = await this.isOrderHashAvailable(maker, optionParams, salt);
        if (isAvailable) {
          availableCount++;
    } else {
          usedCount++;
        }
      }
      
      return {
        maker,
        sampleSize,
        availableCount,
        usedCount,
        availablePercentage: (availableCount / sampleSize) * 100,
        usedPercentage: (usedCount / sampleSize) * 100,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error getting usage stats:", error.message);
      throw error;
    }
  }
}

/**
 * Create a new OrderHashManager instance
 * @param {string} optionsNFTAddress - OptionsNFT contract address
 * @param {Object} provider - Ethereum provider (optional)
 * @returns {OrderHashManager} OrderHashManager instance
 */
function createOrderHashManager(optionsNFTAddress, provider = null) {
  return new OrderHashManager(optionsNFTAddress, provider);
}

/**
 * Utility function to generate a quick salt
 * @param {string} maker - Maker address
 * @param {Object} optionParams - Option parameters
 * @returns {number} Generated salt
 */
function quickSalt(maker, optionParams) {
  const manager = new OrderHashManager("0x0000000000000000000000000000000000000000");
  return manager.generateUniqueSalt(maker, optionParams);
}

module.exports = {
  OrderHashManager,
  createOrderHashManager,
  quickSalt
}; 
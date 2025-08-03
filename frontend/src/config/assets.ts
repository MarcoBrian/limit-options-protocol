import { getContractAddresses } from './contracts';

export interface Asset {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logo?: string;
}

/**
 * Asset Configuration System
 * 
 * This system separates assets into two categories:
 * 
 * 1. UNDERLYING_ASSETS: Assets that can be the underlying of an option
 *    - Typically volatile assets like ETH, WBTC, LINK, UNI
 *    - These are the assets you're betting on
 * 
 * 2. STRIKE_ASSETS: Assets used for strike price and premium
 *    - Typically stable assets like USDC, USDT, DAI
 *    - Can also include ETH/WETH for ETH-denominated options
 *    - These are the assets you pay/receive in
 * 
 * Benefits:
 * - Clear separation of concerns
 * - Prevents invalid asset combinations
 * - Easy to configure for different use cases
 * - Better UX with appropriate asset lists
 */

// Get contract addresses
const contractAddresses = getContractAddresses();

// Underlying assets (assets that can be the underlying of an option)
export const UNDERLYING_ASSETS: Asset[] = [
  {
    symbol: 'wETH',
    name: 'Mock Wrapped Ethereum',
    address: contractAddresses.mockETHAddress || '0x0000000000000000000000000000000000000000',
    decimals: 18,
    logo: '🟣'
  }
];

// Strike assets (assets that can be used as strike price)
export const STRIKE_ASSETS: Asset[] = [
  {
    symbol: 'USDC',
    name: 'Mock USDC Coin',
    address: contractAddresses.mockUSDCAddress || '0x0000000000000000000000000000000000000000',
    decimals: 6,
    logo: '🔵'
  }
];

// Legacy: Combined assets for backward compatibility
export const ASSETS: Asset[] = [...UNDERLYING_ASSETS, ...STRIKE_ASSETS];

// Get asset by address
export const getAssetByAddress = (address: string): Asset | undefined => {
  return ASSETS.find(asset => asset.address.toLowerCase() === address.toLowerCase());
};

// Get asset by symbol
export const getAssetBySymbol = (symbol: string): Asset | undefined => {
  return ASSETS.find(asset => asset.symbol.toLowerCase() === symbol.toLowerCase());
};

// Get all asset symbols
export const getAssetSymbols = (): string[] => {
  return ASSETS.map(asset => asset.symbol);
};

// Get all asset addresses
export const getAssetAddresses = (): string[] => {
  return ASSETS.map(asset => asset.address);
};

// Validate that underlying and strike assets are different
export const validateAssetPair = (underlyingAsset: string, strikeAsset: string): boolean => {
  return underlyingAsset.toLowerCase() !== strikeAsset.toLowerCase();
};

// Get available strike assets (excluding the selected underlying asset)
export const getAvailableStrikeAssets = (underlyingAsset: string): Asset[] => {
  // Handle empty or invalid underlying asset
  if (!underlyingAsset || underlyingAsset.trim() === '') {
    return STRIKE_ASSETS;
  }
  
  // Find the underlying asset to get its symbol
  const underlyingAssetObj = UNDERLYING_ASSETS.find(asset => 
    asset.address.toLowerCase() === underlyingAsset.toLowerCase()
  );
  
  if (!underlyingAssetObj) {
    // If we can't find the underlying asset, return all strike assets
    return STRIKE_ASSETS;
  }
  
  // Exclude assets with the same symbol (not just address)
  const availableAssets = STRIKE_ASSETS.filter(asset => 
    asset.symbol.toLowerCase() !== underlyingAssetObj.symbol.toLowerCase()
  );
  
  return availableAssets;
};

// Get underlying assets
export const getUnderlyingAssets = (): Asset[] => {
  return UNDERLYING_ASSETS;
};

// Get strike assets
export const getStrikeAssets = (): Asset[] => {
  return STRIKE_ASSETS;
}; 
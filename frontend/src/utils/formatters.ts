import { getAssetByAddress } from '../config/assets';

/**
 * Convert dollar amount to proper decimal format for blockchain
 * @param dollarAmount - Amount in dollars (e.g., "3000.50")
 * @param strikeAssetAddress - Address of the strike asset
 * @returns Formatted amount as string (e.g., "3000500000" for USDC with 6 decimals)
 */
export const formatStrikePrice = (dollarAmount: string, strikeAssetAddress: string): string => {
  if (!dollarAmount || !strikeAssetAddress) {
    return '0';
  }

  // Get the strike asset to determine decimals
  const strikeAsset = getAssetByAddress(strikeAssetAddress);
  if (!strikeAsset) {
    console.warn('⚠️ Strike asset not found for address:', strikeAssetAddress);
    return '0';
  }

  // Parse the dollar amount
  const amount = parseFloat(dollarAmount);
  if (isNaN(amount) || amount <= 0) {
    return '0';
  }

  // Convert to proper decimal format
  const multiplier = Math.pow(10, strikeAsset.decimals);
  const formattedAmount = Math.floor(amount * multiplier);

  return formattedAmount.toString();
};

/**
 * Convert decimal amount back to dollar format for display
 * @param decimalAmount - Amount in decimal format (e.g., "3000500000")
 * @param strikeAssetAddress - Address of the strike asset
 * @returns Dollar amount as string (e.g., "3000.50")
 */
export const formatStrikePriceForDisplay = (decimalAmount: string, strikeAssetAddress: string): string => {
  if (!decimalAmount || !strikeAssetAddress) {
    return '0';
  }

  // Get the strike asset to determine decimals
  const strikeAsset = getAssetByAddress(strikeAssetAddress);
  if (!strikeAsset) {
    console.warn('⚠️ Strike asset not found for address:', strikeAssetAddress);
    return '0';
  }

  // Parse the decimal amount
  const amount = parseInt(decimalAmount);
  if (isNaN(amount) || amount <= 0) {
    return '0';
  }

  // Convert back to dollar format
  const divisor = Math.pow(10, strikeAsset.decimals);
  const dollarAmount = amount / divisor;

  return dollarAmount.toFixed(strikeAsset.decimals === 6 ? 2 : 6);
};

/**
 * Format premium amount to proper decimal format
 * @param dollarAmount - Amount in dollars (e.g., "100.50")
 * @param strikeAssetAddress - Address of the strike asset
 * @returns Formatted amount as string
 */
export const formatPremium = (dollarAmount: string, strikeAssetAddress: string): string => {
  return formatStrikePrice(dollarAmount, strikeAssetAddress);
};

/**
 * Format option amount to proper decimal format based on underlying asset
 * @param amount - Amount as string (e.g., "1")
 * @param underlyingAssetAddress - Address of the underlying asset
 * @returns Formatted amount as string with proper decimals
 */
export const formatOptionAmount = (amount: string, underlyingAssetAddress: string): string => {
  if (!amount || !underlyingAssetAddress) {
    return '0';
  }

  // Get the underlying asset to determine decimals
  const underlyingAsset = getAssetByAddress(underlyingAssetAddress);
  if (!underlyingAsset) {
    console.warn('⚠️ Underlying asset not found for address:', underlyingAssetAddress);
    return '0';
  }

  // Parse the amount
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return '0';
  }

  // Convert to proper decimal format based on underlying asset decimals
  const multiplier = Math.pow(10, underlyingAsset.decimals);
  const formattedAmount = Math.floor(numAmount * multiplier);

  return formattedAmount.toString();
}; 
import React from 'react';
import { Asset, UNDERLYING_ASSETS, STRIKE_ASSETS, getAvailableStrikeAssets } from '../config/assets';

interface AssetSelectorProps {
  label: string;
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  disabled?: boolean;
  excludeAsset?: string; // For strike asset selection (exclude underlying)
  required?: boolean;
  assetType?: 'underlying' | 'strike'; // Specify which asset list to use
}

const AssetSelector: React.FC<AssetSelectorProps> = ({
  label,
  value,
  onChange,
  placeholder = "Select asset...",
  disabled = false,
  excludeAsset,
  required = false,
  assetType = 'underlying' // Default to underlying assets
}) => {
  // Get available assets based on type and exclusion
  const getAvailableAssets = (): Asset[] => {
    if (assetType === 'strike') {
      // For strike assets, exclude the selected underlying asset
      return excludeAsset 
        ? getAvailableStrikeAssets(excludeAsset)
        : STRIKE_ASSETS;
    } else {
      // For underlying assets, use underlying assets list
      return UNDERLYING_ASSETS;
    }
  };

  const availableAssets = getAvailableAssets();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <div>
      <label className="form-label">
        {label}
      </label>
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        className="input-field"
      >
        <option value="">{placeholder}</option>
        {availableAssets.map((asset) => (
          <option key={asset.address} value={asset.address}>
            {asset.logo} {asset.symbol} - {asset.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AssetSelector; 
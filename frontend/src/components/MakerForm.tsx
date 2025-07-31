import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useApp } from '../contexts/AppContext';
import { OrderSubmission } from '../types';
import { buildCompleteCallOption } from '../utils/orderBuilder';
import AssetSelector from './AssetSelector';
import { validateAssetPair } from '../config/assets';
import { getContractAddresses, validateContractAddresses } from '../config/contracts';

const MakerForm: React.FC = () => {
  const { isConnected, signer } = useWallet();
  const { submitOrder, loading, error } = useApp();
  
  const [formData, setFormData] = useState({
    underlyingAsset: '',
    strikeAsset: '',
    strikePrice: '',
    optionAmount: '',
    premium: '',
    expiry: '',
  });

  const [validationError, setValidationError] = useState<string>('');

  // Get contract addresses
  const contractAddresses = getContractAddresses();

  const handleAssetChange = (field: 'underlyingAsset' | 'strikeAsset', address: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: address
    }));
    
    // Clear validation error when user changes selection
    setValidationError('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = (): boolean => {
    // Check if contract addresses are valid
    if (!validateContractAddresses(contractAddresses)) {
      setValidationError('Contract addresses not configured. Please run the deployment script first.');
      return false;
    }

    // Check if assets are selected
    if (!formData.underlyingAsset || !formData.strikeAsset) {
      setValidationError('Please select both underlying and strike assets');
      return false;
    }

    // Check if assets are different
    if (!validateAssetPair(formData.underlyingAsset, formData.strikeAsset)) {
      setValidationError('Underlying asset and strike asset must be different');
      return false;
    }

    // Check if other required fields are filled
    if (!formData.strikePrice || !formData.optionAmount || !formData.premium || !formData.expiry) {
      setValidationError('Please fill in all required fields');
      return false;
    }

    // Check if values are positive
    if (Number(formData.strikePrice) <= 0 || Number(formData.optionAmount) <= 0 || Number(formData.premium) <= 0) {
      setValidationError('All numeric values must be greater than 0');
      return false;
    }

    setValidationError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected || !signer) {
      alert('Please connect your wallet first');
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      // Build complete order with proper signatures using signer
      const orderData = await buildCompleteCallOption({
        makerSigner: signer,
        underlyingAsset: formData.underlyingAsset,
        strikeAsset: formData.strikeAsset,
        dummyTokenAddress: contractAddresses.dummyTokenAddress,
        strikePrice: formData.strikePrice,
        optionAmount: formData.optionAmount,
        premium: formData.premium,
        expiry: Math.floor(new Date(formData.expiry).getTime() / 1000),
        lopAddress: contractAddresses.lopAddress,
        optionsNFTAddress: contractAddresses.optionsNFTAddress
      });

      // Convert to OrderSubmission format
      const orderSubmission: OrderSubmission = {
        order: {
          salt: orderData.order.salt.toString(),
          maker: orderData.originalAddresses.maker,
          receiver: orderData.originalAddresses.receiver,
          makerAsset: orderData.originalAddresses.makerAsset,
          takerAsset: orderData.originalAddresses.takerAsset,
          makingAmount: orderData.order.makingAmount.toString(),
          takingAmount: orderData.order.takingAmount.toString(),
          makerTraits: orderData.order.makerTraits.toString(),
        },
        signature: {
          r: orderData.lopSignature.r,
          s: orderData.lopSignature.s,
          v: orderData.lopSignature.v,
        },
        lopAddress: contractAddresses.lopAddress,
        optionParams: {
          underlyingAsset: orderData.optionParams.underlyingAsset,
          strikeAsset: orderData.optionParams.strikeAsset,
          strikePrice: orderData.optionParams.strikePrice.toString(),
          optionAmount: orderData.optionParams.optionAmount.toString(),
          premium: formData.premium,
          expiry: Number(orderData.optionParams.expiry),
          nonce: orderData.salt,
        },
        optionsNFTSignature: {
          r: orderData.optionsNFTSignature.r,
          s: orderData.optionsNFTSignature.s,
          v: orderData.optionsNFTSignature.v,
        },
        optionsNFTAddress: contractAddresses.optionsNFTAddress,
      };

      await submitOrder(orderSubmission);
      alert('Order submitted successfully!');
      
      // Reset form
      setFormData({
        underlyingAsset: '',
        strikeAsset: '',
        strikePrice: '',
        optionAmount: '',
        premium: '',
        expiry: '',
      });
      setValidationError('');
    } catch (err: any) {
      console.error('Error submitting order:', err);
      alert(`Error submitting order: ${err.message}`);
    }
  };

  return (
    <div className="card max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-primary mb-6">Create New Option</h2>
      
      {!isConnected && (
        <div className="bg-warning/10 border border-warning text-warning px-4 py-3 rounded-lg mb-6">
          Please connect your wallet to create options
        </div>
      )}

      {error && (
        <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {validationError && (
        <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg mb-6">
          {validationError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <AssetSelector
              label="Underlying Asset"
              value={formData.underlyingAsset}
              onChange={(address) => handleAssetChange('underlyingAsset', address)}
              placeholder="Select underlying asset..."
              disabled={!isConnected}
              required
              assetType="underlying"
            />
          </div>

          <div>
            <AssetSelector
              label="Strike Asset"
              value={formData.strikeAsset}
              onChange={(address) => handleAssetChange('strikeAsset', address)}
              placeholder="Select strike asset..."
              disabled={!isConnected}
              excludeAsset={formData.underlyingAsset} // Exclude underlying asset from strike options
              required
              assetType="strike"
            />
          </div>

          

          <div>
            <label htmlFor="optionAmount" className="form-label">
              Option Amount 
            </label>
            <input
              type="number"
              id="optionAmount"
              name="optionAmount"
              value={formData.optionAmount}
              onChange={handleInputChange}
              className="input-field"
              placeholder="1"
              required
              min="1"
              step="1"
            />
          </div>

          <div>
            <label htmlFor="strikePrice" className="form-label">
              Strike Price ($)
            </label>
            <input
              type="number"
              id="strikePrice"
              name="strikePrice"
              value={formData.strikePrice}
              onChange={handleInputChange}
              className="input-field"
              placeholder="$3000"
              required
              min="1"
              step="1"
            />
          </div>

          <div>
            <label htmlFor="premium" className="form-label">
              Premium ($)
            </label>
            <input
              type="number"
              id="premium"
              name="premium"
              value={formData.premium}
              onChange={handleInputChange}
              className="input-field"
              placeholder="100"
              required
              min="0"
              step="1"
            />
          </div>

          <div>
            <label htmlFor="expiry" className="form-label">
              Expiry Date
            </label>
            <input
              type="date"
              id="expiry"
              name="expiry"
              value={formData.expiry}
              onChange={handleInputChange}
              className="input-field"
              required
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isConnected || loading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Option'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MakerForm; 
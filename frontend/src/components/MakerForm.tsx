import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useApp } from '../contexts/AppContext';
import { OrderSubmission, Order, OrderSignature, OptionParams } from '../types';
import { buildCompleteCallOption } from '../utils/orderBuilder';

const MakerForm: React.FC = () => {
  const { account, isConnected, signer } = useWallet(); // Get signer from context
  const { submitOrder, loading, error } = useApp();
  
  const [formData, setFormData] = useState({
    underlyingAsset: '',
    strikeAsset: '',
    strikePrice: '',
    optionAmount: '',
    premium: '',
    expiry: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected || !signer) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      // Get contract addresses (you'll need to get these from deployment)
      const lopAddress = '0x...'; // Get from .env or deployment
      const optionsNFTAddress = '0x...'; // Get from .env or deployment
      const dummyTokenAddress = '0x...'; // Get from .env or deployment
      
      // Build complete order with proper signatures using signer
      const orderData = await buildCompleteCallOption({
        makerSigner: signer, // Use the signer from context
        underlyingAsset: formData.underlyingAsset,
        strikeAsset: formData.strikeAsset,
        dummyTokenAddress,
        strikePrice: formData.strikePrice,
        optionAmount: formData.optionAmount,
        premium: formData.premium,
        expiry: Math.floor(new Date(formData.expiry).getTime() / 1000),
        lopAddress,
        optionsNFTAddress
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
        lopAddress,
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
        optionsNFTAddress,
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="underlyingAsset" className="form-label">
              Underlying Asset Address
            </label>
            <input
              type="text"
              id="underlyingAsset"
              name="underlyingAsset"
              value={formData.underlyingAsset}
              onChange={handleInputChange}
              className="input-field"
              placeholder="0x..."
              required
            />
          </div>

          <div>
            <label htmlFor="strikeAsset" className="form-label">
              Strike Asset Address
            </label>
            <input
              type="text"
              id="strikeAsset"
              name="strikeAsset"
              value={formData.strikeAsset}
              onChange={handleInputChange}
              className="input-field"
              placeholder="0x..."
              required
              min={0}
            />
          </div>

          <div>
            <label htmlFor="strikePrice" className="form-label">
              Strike Price (in wei)
            </label>
            <input
              type="number"
              id="strikePrice"
              name="strikePrice"
              value={formData.strikePrice}
              onChange={handleInputChange}
              className="input-field"
              placeholder="2000000000"
              required
            />
          </div>

          <div>
            <label htmlFor="optionAmount" className="form-label">
              Option Amount (in wei)
            </label>
            <input
              type="number"
              id="optionAmount"
              name="optionAmount"
              value={formData.optionAmount}
              onChange={handleInputChange}
              className="input-field"
              placeholder="1000000000000000000"
              required
            />
          </div>

          <div>
            <label htmlFor="premium" className="form-label">
              Premium (in wei)
            </label>
            <input
              type="number"
              id="premium"
              name="premium"
              value={formData.premium}
              onChange={handleInputChange}
              className="input-field"
              placeholder="100000000"
              required
            />
          </div>

          <div>
            <label htmlFor="expiry" className="form-label">
              Expiry Date
            </label>
            <input
              type="datetime-local"
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
import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useApp } from '../contexts/AppContext';
import { OrderSubmission, Order, OrderSignature, OptionParams } from '../types';

const MakerForm: React.FC = () => {
  const { account, isConnected } = useWallet();
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
    
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      // Create mock order data (in a real app, this would be generated properly)
      const order: Order = {
        salt: Date.now().toString(),
        maker: account!,
        receiver: account!,
        makerAsset: formData.underlyingAsset,
        takerAsset: formData.strikeAsset,
        makingAmount: formData.optionAmount,
        takingAmount: formData.premium,
        makerTraits: '0',
      };

      const signature: OrderSignature = {
        r: '0x' + '0'.repeat(64),
        s: '0x' + '0'.repeat(64),
        v: 27,
      };

      const optionParams: OptionParams = {
        underlyingAsset: formData.underlyingAsset,
        strikeAsset: formData.strikeAsset,
        strikePrice: formData.strikePrice,
        optionAmount: formData.optionAmount,
        premium: formData.premium,
        expiry: Math.floor(new Date(formData.expiry).getTime() / 1000),
        nonce: Date.now(),
      };

      const orderSubmission: OrderSubmission = {
        order,
        signature,
        lopAddress: '0x' + '0'.repeat(40), // Mock LOP address
        optionParams,
        optionsNFTSignature: signature,
        optionsNFTAddress: '0x' + '0'.repeat(40), // Mock NFT address
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
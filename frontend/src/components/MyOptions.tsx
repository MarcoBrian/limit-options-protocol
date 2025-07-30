import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useApp } from '../contexts/AppContext';

const MyOptions: React.FC = () => {
  const { account, isConnected } = useWallet();
  const { exerciseOption, loading } = useApp();
  
  // Mock data for owned options (in a real app, this would come from the blockchain)
  const [ownedOptions] = useState([
    {
      id: 1,
      underlyingAsset: '0x1234567890123456789012345678901234567890',
      strikeAsset: '0x0987654321098765432109876543210987654321',
      strikePrice: '2000000000',
      expiry: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days from now
      amount: '1000000000000000000',
      exercised: false,
    },
    {
      id: 2,
      underlyingAsset: '0x1234567890123456789012345678901234567890',
      strikeAsset: '0x0987654321098765432109876543210987654321',
      strikePrice: '2500000000',
      expiry: Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60, // 3 days from now
      amount: '500000000000000000',
      exercised: true,
    },
  ]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: string) => {
    return (parseInt(amount) / 1e18).toFixed(4);
  };

  const formatStrikePrice = (strikePrice: string) => {
    return (parseInt(strikePrice) / 1e6).toFixed(2);
  };

  const handleExercise = async (optionId: number) => {
    if (!isConnected) {
      alert('Please connect your wallet to exercise options');
      return;
    }

    try {
      await exerciseOption(optionId);
      alert('Option exercised successfully!');
    } catch (err: any) {
      alert(`Error exercising option: ${err.message}`);
    }
  };

  const isExpired = (expiry: number) => {
    return Date.now() / 1000 > expiry;
  };

  if (!isConnected) {
    return (
      <div className="card max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-primary mb-6">My Options</h2>
        <div className="bg-warning/10 border border-warning text-warning px-4 py-3 rounded-lg">
          Please connect your wallet to view your options
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-primary">My Options</h2>
        <div className="text-sm text-text-secondary">
          Connected: {formatAddress(account!)}
        </div>
      </div>

      {ownedOptions.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-text-secondary text-lg">
            You don't own any options yet
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ownedOptions.map((option) => (
            <div key={option.id} className="card">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-primary">
                      Call Option #{option.id}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      Strike: {formatStrikePrice(option.strikePrice)} USDC
                    </p>
                  </div>
                  <div className="text-right">
                    {option.exercised ? (
                      <span className="px-2 py-1 bg-success/10 text-success text-xs rounded-full">
                        Exercised
                      </span>
                    ) : isExpired(option.expiry) ? (
                      <span className="px-2 py-1 bg-error/10 text-error text-xs rounded-full">
                        Expired
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-warning/10 text-warning text-xs rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">Underlying:</span>
                    <span className="text-sm font-medium">
                      {formatAddress(option.underlyingAsset)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">Strike Asset:</span>
                    <span className="text-sm font-medium">
                      {formatAddress(option.strikeAsset)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">Amount:</span>
                    <span className="text-sm font-medium">
                      {formatAmount(option.amount)} ETH
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">Expiry:</span>
                    <span className="text-sm font-medium">
                      {new Date(option.expiry * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border-light">
                  {option.exercised ? (
                    <button
                      disabled
                      className="w-full btn-secondary opacity-50 cursor-not-allowed"
                    >
                      Already Exercised
                    </button>
                  ) : isExpired(option.expiry) ? (
                    <button
                      disabled
                      className="w-full btn-secondary opacity-50 cursor-not-allowed"
                    >
                      Expired
                    </button>
                  ) : (
                    <button
                      onClick={() => handleExercise(option.id)}
                      disabled={loading}
                      className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Exercising...' : 'Exercise Option'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyOptions; 
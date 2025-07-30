import React from 'react';
import { useApp } from '../contexts/AppContext';
import { useWallet } from '../contexts/WalletContext';

const OrderGrid: React.FC = () => {
  const { orders, loading, error, fetchOrders } = useApp();
  const { isConnected } = useWallet();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: string) => {
    return (parseInt(amount) / 1e18).toFixed(4);
  };

  const handleBuyOption = async (order: any) => {
    if (!isConnected) {
      alert('Please connect your wallet to buy options');
      return;
    }
    
    // TODO: Implement buy option logic
    alert('Buy option functionality coming soon!');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg max-w-md mx-auto">
          {error}
        </div>
        <button
          onClick={fetchOrders}
          className="btn-primary mt-4"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-primary">Available Options</h2>
        <button
          onClick={fetchOrders}
          className="btn-secondary"
        >
          Refresh
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-text-secondary text-lg">
            No options available at the moment
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((order, index) => (
            <div key={order.orderHash || index} className="card hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-primary">
                      Call Option
                    </h3>
                    <p className="text-sm text-text-secondary">
                      by {formatAddress(order.maker)}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-success/10 text-success text-xs rounded-full">
                    Active
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">Underlying:</span>
                    <span className="text-sm font-medium">
                      {formatAddress(order.optionParams?.underlyingAsset || order.makerAsset)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">Strike Asset:</span>
                    <span className="text-sm font-medium">
                      {formatAddress(order.optionParams?.strikeAsset || order.takerAsset)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">Strike Price:</span>
                    <span className="text-sm font-medium">
                      {order.optionParams?.strikePrice ? 
                        (parseInt(order.optionParams.strikePrice) / 1e6).toFixed(2) + ' USDC' :
                        'N/A'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">Amount:</span>
                    <span className="text-sm font-medium">
                      {formatAmount(order.makingAmount)} ETH
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">Premium:</span>
                    <span className="text-sm font-medium">
                      {formatAmount(order.takingAmount)} ETH
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">Expiry:</span>
                    <span className="text-sm font-medium">
                      {order.optionParams?.expiry ? 
                        new Date(order.optionParams.expiry * 1000).toLocaleDateString() :
                        'N/A'
                      }
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border-light">
                  <button
                    onClick={() => handleBuyOption(order)}
                    disabled={!isConnected}
                    className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConnected ? 'Buy Option' : 'Connect Wallet'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderGrid; 
import React, { useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';

const OrderGrid: React.FC = () => {
  const { isConnected } = useWallet();
  const { orders, loading, error, fetchOrders } = useApp();
  const { showToast } = useToast();

  useEffect(() => {
    if (orders.length === 0) {
      fetchOrders();
    }
  }, [orders.length, fetchOrders]); // Fixed dependencies

  const formatAddress = (address: string) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: string, decimals: number = 18) => {
    if (!amount) return '0';
    try {
      const num = parseInt(amount) / Math.pow(10, decimals);
      return num.toFixed(2);
    } catch (error) {
      return '0';
    }
  };

  const formatUSDCAmount = (amount: string) => {
    return formatAmount(amount, 6);
  };

  const getAssetSymbol = (address: string) => {
    // Simple mapping - in a real app, you'd have a proper asset registry
    const addressLower = address.toLowerCase();
    if (addressLower.includes('eth') || addressLower.includes('0xe7f1725')) return 'ETH';
    if (addressLower.includes('usdc') || addressLower.includes('0x5fbdb')) return 'USDC';
    if (addressLower.includes('wbtc')) return 'WBTC';
    if (addressLower.includes('link')) return 'LINK';
    if (addressLower.includes('uni')) return 'UNI';
    return 'Unknown';
  };

  const handleBuyOption = async (order: any) => {
    if (!isConnected) {
      showToast('Please connect your wallet to buy options', 'warning');
      return;
    }
    
    try {
      // TODO: Implement buy option logic
      // This would involve:
      // 1. Calling the smart contract to fill the order
      // 2. Handling the transaction
      // 3. Updating the order status
      showToast('Buy option functionality coming soon!', 'info');
    } catch (error: any) {
      showToast(`Error buying option: ${error.message}`, 'error');
    }
  };

  const handleRefresh = async () => {
    try {
      await fetchOrders();
      showToast('Orders refreshed successfully', 'success');
    } catch (error: any) {
      showToast(`Failed to refresh orders: ${error.message}`, 'error');
    }
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
          onClick={handleRefresh}
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
          onClick={handleRefresh}
          className="btn-secondary"
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-secondary">
            Create some options using the "Create" tab to see them here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((order, index) => {
            const optionParams = order.optionParams;
            
            return (
              <div key={order.order_hash || index} className="card hover:shadow-lg transition-shadow">
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
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      order.status === 'open' 
                        ? 'bg-success/10 text-success' 
                        : 'bg-warning/10 text-warning'
                    }`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Underlying:</span>
                      <span className="text-sm font-medium">
                        {getAssetSymbol(order.maker_asset)} ({formatAddress(optionParams.underlyingAsset)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Strike Asset:</span>
                      <span className="text-sm font-medium">
                        {getAssetSymbol(order.taker_asset)} ({formatAddress(optionParams.strikeAsset)})
                      </span>
                    </div>
                    {optionParams && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm text-text-secondary">Strike Price:</span>
                          <span className="text-sm font-medium">
                            {formatUSDCAmount(optionParams.strikePrice)} USDC
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-text-secondary">Option Amount:</span>
                          <span className="text-sm font-medium">
                            {formatAmount(optionParams.optionAmount)} {getAssetSymbol(optionParams.underlyingAsset)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-text-secondary">Premium:</span>
                          <span className="text-sm font-medium">
                            {formatUSDCAmount(optionParams.premium)} {getAssetSymbol(order.taker_asset)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-text-secondary">Expiry:</span>
                          <span className="text-sm font-medium">
                            {optionParams.expiry ? 
                              new Date(optionParams.expiry * 1000).toLocaleDateString() :
                              'N/A'
                            }
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Created:</span>
                      <span className="text-sm font-medium">
                        {order.created_at ? 
                          new Date(order.created_at).toLocaleDateString() :
                          'N/A'
                        }
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border-light">
                    <button
                      onClick={() => handleBuyOption(order)}
                      disabled={!isConnected || order.status !== 'open'}
                      className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {!isConnected ? 'Connect Wallet' : 
                       order.status !== 'open' ? 'Not Available' : 'Buy Option'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrderGrid; 
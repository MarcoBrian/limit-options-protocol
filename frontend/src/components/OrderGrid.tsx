import React, { useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { fillOrder } from '../utils/orderFiller';
import { getContractAddresses } from '../config/contracts';

const OrderGrid: React.FC = () => {
  const { isConnected, signer, account } = useWallet();
  const { orders, loading, error, fetchOrders } = useApp();
  const { showToast } = useToast();
  
  const [fillingOrders, setFillingOrders] = useState<Set<string>>(new Set());
  const [fillProgress, setFillProgress] = useState<{ [key: string]: string }>({});

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
    // Get contract addresses from environment variables
    const contractAddresses = getContractAddresses();
    const addressLower = address.toLowerCase();
    
    // Create mapping from contract addresses to symbols
    const addressSymbolMap: { [key: string]: string } = {
      [contractAddresses.mockUSDCAddress.toLowerCase()]: 'USDC',
      [contractAddresses.mockETHAddress.toLowerCase()]: 'ETH',
      [contractAddresses.dummyTokenAddress.toLowerCase()]: 'OPT', // Dummy option token
    };
    
    // Check exact address match first
    if (addressSymbolMap[addressLower]) {
      return addressSymbolMap[addressLower];
    }
    
    // Fallback to partial matching for any other tokens
    if (addressLower.includes('usdc')) return 'USDC';
    if (addressLower.includes('eth')) return 'ETH';
    if (addressLower.includes('wbtc')) return 'WBTC';
    if (addressLower.includes('link')) return 'LINK';
    if (addressLower.includes('uni')) return 'UNI';
    
    return 'Unknown';
  };

  const isOrderCreator = (order: any) => {
    return account && order.maker && 
           account.toLowerCase() === order.maker.toLowerCase();
  };

  const handleBuyOption = async (order: any) => {
    if (!isConnected || !signer) {
      showToast('Please connect your wallet to buy options', 'warning');
      return;
    }
    
    const orderHash = order.order_hash;
    
    // Prevent multiple simultaneous fills of the same order
    if (fillingOrders.has(orderHash)) {
      return;
    }
    
    try {
      // Add order to filling set
      setFillingOrders(prev => new Set(prev).add(orderHash));
      setFillProgress(prev => ({ ...prev, [orderHash]: 'Starting...' }));
      
      console.log('🛒 Starting to buy option:', orderHash);
      
      const result = await fillOrder(
        order,
        signer,
        (status: string) => {
          setFillProgress(prev => ({ ...prev, [orderHash]: status }));
        }
      );
      
      // Success! Now mark the order as filled
      showToast(
        `Option purchased successfully! ${result.optionTokenId ? `NFT ID: ${result.optionTokenId}` : ''}`,
        'success'
      );
      
      console.log('🎉 Option purchase completed:', {
        txHash: result.txHash,
        optionTokenId: result.optionTokenId
      });
      
      // Mark order as filled in backend
      try {
        setFillProgress(prev => ({ ...prev, [orderHash]: 'Updating order status...' }));
        
        console.log('🔄 Marking order as filled...');
        console.log('   Order Hash:', orderHash);
        console.log('   TX Hash:', result.txHash);
        console.log('   Taker Account:', account);
        console.log('   API URL:', `/api/orders/${orderHash}/filled`);
        
        const requestBody = {
          txHash: result.txHash,
          taker: account
        };
        console.log('   Request Body:', requestBody);
        
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/orders/${orderHash}/filled`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });
        
        console.log('   Response Status:', response.status);
        console.log('   Response OK:', response.ok);
        
        const responseData = await response.text();
        console.log('   Response Data:', responseData);
        
        if (response.ok) {
          console.log('✅ Order marked as filled in database');
        } else {
          console.warn('⚠️ Failed to mark order as filled:', response.status, responseData);
        }
      } catch (markError: any) {
        console.error('⚠️ Error marking order as filled:', markError);
        console.error('   Error details:', markError.message || 'Unknown error');
        // Don't throw - the main transaction succeeded
      }
      
      // Refresh orders to remove the filled order
      await fetchOrders();
      
    } catch (error: any) {
      console.error('❌ Buy option failed:', error);
      
      // If it's the "already used" error, refresh orders automatically
      if (error.message?.includes('already been purchased') || 
          error.message?.includes('Option order already used')) {
        showToast(`${error.message}`, 'warning');
        console.log('🔄 Auto-refreshing orders due to stale data...');
        setTimeout(() => {
          fetchOrders(); // Auto-refresh after 1 second
        }, 1000);
      } else {
        showToast(`Failed to buy option: ${error.message}`, 'error');
      }
    } finally {
      // Clean up loading state
      setFillingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderHash);
        return newSet;
      });
      setFillProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[orderHash];
        return newProgress;
      });
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

  // Filter to only show open orders (available for purchase)
  const openOrders = orders.filter(order => order.status === 'open');

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

      {openOrders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-secondary">
            {orders.length === 0 
              ? 'Create some options using the "Create" tab to see them here'
              : 'No open options available. All options have been filled or closed.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {openOrders.map((order, index) => {
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
                      <span className="text-sm text-text-secondary">Underlying Asset:</span>
                      <span className="text-sm font-medium">
                        {getAssetSymbol(optionParams.underlyingAsset)} ({formatAddress(optionParams.underlyingAsset)})
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
                    {fillingOrders.has(order.order_hash) ? (
                      <div className="w-full">
                        <div className="flex items-center justify-center space-x-2 py-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          <span className="text-sm text-text-secondary">
                            {fillProgress[order.order_hash] || 'Processing...'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleBuyOption(order)}
                        disabled={!isConnected || order.status !== 'open' || !signer || isOrderCreator(order)}
                        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {!isConnected ? 'Connect Wallet' : 
                         order.status !== 'open' ? 'Not Available' :
                         isOrderCreator(order) ? 'Your Option' : 'Buy Option'}
                      </button>
                    )}
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
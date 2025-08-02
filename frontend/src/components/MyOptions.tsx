import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { fetchUserOptions, exerciseOption, UserOption } from '../utils/optionsFetcher';
import { getContractAddresses } from '../config/contracts';


const MyOptions: React.FC = () => {
  const { account, isConnected, signer } = useWallet();
  const { loading } = useApp();
  const { showToast } = useToast();
  
  const [ownedOptions, setOwnedOptions] = useState<UserOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [exercisingOptions, setExercisingOptions] = useState<Set<number>>(new Set());
  const [exerciseProgress, setExerciseProgress] = useState<{ [key: number]: string }>({});

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: string) => {
    try {
      return parseFloat(ethers.formatEther(amount)).toFixed(4);
    } catch {
      return '0.0000';
    }
  };

  const formatStrikePrice = (strikePrice: string) => {
    try {
      return parseFloat(ethers.formatUnits(strikePrice, 6)).toFixed(2);
    } catch {
      return '0.00';
    }
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

  
  // Fetch user's options when wallet connects
  const loadUserOptions = async () => {
    if (!isConnected || !signer || !account) {
      setOwnedOptions([]);
      return;
    }
    
    setLoadingOptions(true);
    try {
      console.log('🔄 Loading user options...');
      const options = await fetchUserOptions(account, signer);
      setOwnedOptions(options);
      console.log(`✅ Loaded ${options.length} options`);
    } catch (error: any) {
      console.error('❌ Failed to load options:', error);
      showToast(`Failed to load your options: ${error.message}`, 'error');
    } finally {
      setLoadingOptions(false);
    }
  };
  
  // Load options when wallet connects or changes
  useEffect(() => {
    loadUserOptions();
  }, [isConnected, account, signer]);

  const handleExercise = async (tokenId: number) => {
    if (!isConnected || !signer) {
      showToast('Please connect your wallet to exercise options', 'warning');
      return;
    }
    
    // Prevent multiple simultaneous exercises of the same option
    if (exercisingOptions.has(tokenId)) {
      return;
    }
    
    try {
      // Add option to exercising set
      setExercisingOptions(prev => new Set(prev).add(tokenId));
      setExerciseProgress(prev => ({ ...prev, [tokenId]: 'Starting...' }));
      
      console.log('🏃‍♂️ Starting to exercise option:', tokenId);
      
      const result = await exerciseOption(
        tokenId,
        signer,
        (status: string) => {
          setExerciseProgress(prev => ({ ...prev, [tokenId]: status }));
        }
      );
      
      // Success!
      showToast(`Option exercised successfully! Tx: ${result.txHash.slice(0, 10)}...`, 'success');
      
      console.log('🎉 Option exercise completed:', result.txHash);
      
      // Refresh options to show updated state
      await loadUserOptions();
      
    } catch (error: any) {
      console.error('❌ Exercise failed:', error);
      showToast(`Failed to exercise option: ${error.message}`, 'error');
    } finally {
      // Clean up loading state
      setExercisingOptions(prev => {
        const newSet = new Set(prev);
        newSet.delete(tokenId);
        return newSet;
      });
      setExerciseProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[tokenId];
        return newProgress;
      });
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
        <div className="flex items-center space-x-4">
          <button
            onClick={loadUserOptions}
            disabled={loadingOptions}
            className="btn-secondary text-sm"
          >
            {loadingOptions ? 'Loading...' : 'Refresh'}
          </button>
          <div className="text-sm text-text-secondary">
            Connected: {formatAddress(account!)}
          </div>
        </div>
      </div>

      {loadingOptions ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : ownedOptions.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-text-secondary text-lg">
            You don't own any options yet
          </div>
          <p className="text-sm text-text-secondary mt-2">
            Buy some options from the "Browse" tab to see them here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ownedOptions.map((option) => (
            <div key={option.tokenId} className="card">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-primary">
                      Call Option #{option.tokenId}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      Strike: {formatStrikePrice(option.strikePrice)} {getAssetSymbol(option.strikeAsset)}
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
                      {getAssetSymbol(option.underlyingAsset)} ({formatAddress(option.underlyingAsset)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">Strike Asset:</span>
                    <span className="text-sm font-medium">
                      {getAssetSymbol(option.strikeAsset)} ({formatAddress(option.strikeAsset)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">Amount:</span>
                    <span className="text-sm font-medium">
                      {formatAmount(option.amount)} {getAssetSymbol(option.underlyingAsset)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-text-secondary">Maker:</span>
                    <span className="text-sm font-medium">
                      {formatAddress(option.maker)}
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
                  ) : exercisingOptions.has(option.tokenId) ? (
                    <div className="w-full">
                      <div className="flex items-center justify-center space-x-2 py-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        <span className="text-sm text-text-secondary">
                          {exerciseProgress[option.tokenId] || 'Processing...'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleExercise(option.tokenId)}
                      disabled={loading}
                      className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Exercise Option
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
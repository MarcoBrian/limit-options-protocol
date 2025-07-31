import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { WalletContextType } from '../types';
import { useToast } from './ToastContext';

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<any>(null);
  const [signer, setSigner] = useState<any>(null); // Add signer state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [manuallyDisconnected, setManuallyDisconnected] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    // Don't auto-connect if user manually disconnected
    if (manuallyDisconnected) {
      return;
    }

    // Check if MetaMask is installed
    if (typeof window.ethereum !== 'undefined') {
      const ethereum = window.ethereum;
      const provider = new ethers.BrowserProvider(ethereum);
      setProvider(provider);

      // Get signer when provider is set
      const getSigner = async () => {
        try {
          const signer = await provider.getSigner();
          setSigner(signer);
        } catch (error) {
          console.error('Error getting signer:', error);
        }
      };
      getSigner();

      // Check if already connected
      ethereum.request({ method: 'eth_accounts' })
        .then(async (accounts: string[]) => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setIsConnected(true);
            // Get signer for connected account
            const signer = await provider.getSigner();
            setSigner(signer);
          }
        })
        .catch((err: any) => {
          console.error('Error checking existing accounts:', err);
          showToast('Failed to check existing connection', 'error');
        });

      // Get current chain ID
      ethereum.request({ method: 'eth_chainId' })
        .then((chainId: string) => {
          setChainId(parseInt(chainId, 16));
        })
        .catch(console.error);

      // Listen for account changes
      ethereum.on('accountsChanged', async (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsConnected(true);
          // Update signer for new account
          const signer = await provider.getSigner();
          setSigner(signer);
        } else {
          setAccount(null);
          setIsConnected(false);
          setSigner(null);
        }
      });

      // Listen for chain changes
      ethereum.on('chainChanged', (chainId: string) => {
        setChainId(parseInt(chainId, 16));
        console.log('Network changed to:', parseInt(chainId, 16));
      });
    } else {
      showToast('MetaMask is not installed', 'error');
    }
  }, [showToast, manuallyDisconnected]);

  const connect = async () => {
    try {
      setIsConnecting(true);

      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed. Please install MetaMask to use this application.');
      }

      const ethereum = window.ethereum;
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setIsConnected(true);
        const provider = new ethers.BrowserProvider(ethereum);
        setProvider(provider);
        
        // Get signer for connected account
        const signer = await provider.getSigner();
        setSigner(signer);
        
        setManuallyDisconnected(false); // Reset manually disconnected state
        showToast('Wallet connected successfully!', 'success');
      } else {
        throw new Error('No accounts found');
      }
    } catch (error: any) {
      console.error('Error connecting to MetaMask:', error);
      
      // Handle specific MetaMask errors
      if (error.code === 4001) {
        showToast('Connection cancelled by user', 'warning');
      } else if (error.code === -32002) {
        showToast('Please check MetaMask - connection request is pending', 'warning');
      } else if (error.code === -32003) {
        showToast('MetaMask is locked. Please unlock MetaMask and try again', 'error');
      } else if (error.message?.includes('MetaMask is not installed')) {
        showToast('MetaMask is not installed. Please install MetaMask to use this application.', 'error');
      } else if (error.message?.includes('User rejected')) {
        showToast('Connection was rejected. Please try again.', 'warning');
      } else {
        showToast(error.message || 'Failed to connect to MetaMask', 'error');
      }
      
      // Reset connection state
      setAccount(null);
      setIsConnected(false);
      setProvider(null);
      setSigner(null);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      // Try to revoke MetaMask permissions
      if (typeof window.ethereum !== 'undefined') {
        // Request to revoke account permissions
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: []
        });
      }
    } catch (error) {
      console.log('MetaMask permission revocation failed:', error);
      // This is expected - MetaMask doesn't always support this
    } finally {
      // Always clear local state
      setAccount(null);
      setIsConnected(false);
      setProvider(null);
      setSigner(null);
      setChainId(null);
      setManuallyDisconnected(true); // Set manuallyDisconnected to true after disconnect
      showToast('Wallet disconnected', 'info');
    }
  };

  const signMessage = async (message: string): Promise<string> => {
    if (!signer || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      const signature = await signer.signMessage(message);
      return signature;
    } catch (error: any) {
      console.error('Error signing message:', error);
      
      if (error.code === 4001) {
        throw new Error('Message signing was cancelled by user');
      } else if (error.code === -32002) {
        throw new Error('Please check MetaMask - signing request is pending');
      } else if (error.code === -32003) {
        throw new Error('MetaMask is locked. Please unlock MetaMask and try again');
      } else {
        throw new Error(error.message || 'Failed to sign message');
      }
    }
  };

  const value: WalletContextType = {
    account,
    isConnected,
    isConnecting,
    chainId,
    connect,
    disconnect,
    signMessage,
    provider,
    signer, // Add signer to context
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
} 
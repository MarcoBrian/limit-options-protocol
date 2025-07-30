import React from 'react';
import { useWallet } from '../contexts/WalletContext';

const Header: React.FC = () => {
  const { account, isConnected, isConnecting, connect, disconnect } = useWallet();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      // Error is already handled in the context with toasts
      console.error('Connection failed:', err);
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-border-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <img 
                src="/logo.png" 
                alt="1option" 
                className="h-10 w-auto"
              />
              <h1 className="text-2xl font-bold text-primary">1option</h1>
            </div>
          </div>
          
          <div className="flex items-center">
            {isConnected ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-text-secondary">
                  {formatAddress(account!)}
                </span>
                <button
                  onClick={disconnect}
                  className="btn-secondary text-sm"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 
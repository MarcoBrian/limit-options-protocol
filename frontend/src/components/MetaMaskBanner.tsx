import React from 'react';

interface MetaMaskBannerProps {
  isVisible: boolean;
}

const MetaMaskBanner: React.FC<MetaMaskBannerProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  const handleInstallMetaMask = () => {
    window.open('https://metamask.io/download/', '_blank');
  };

  return (
    <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-3 shadow-lg">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold">MetaMask Required</h3>
            <p className="text-sm opacity-90">
              You need MetaMask installed to use this application. MetaMask is a secure wallet for managing your crypto assets.
            </p>
          </div>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={handleInstallMetaMask}
            className="bg-white text-orange-600 hover:text-orange-700 px-4 py-2 rounded-lg font-medium transition-colors duration-200 shadow-sm hover:shadow-md"
          >
            Install MetaMask
          </button>
        </div>
      </div>
    </div>
  );
};

export default MetaMaskBanner;
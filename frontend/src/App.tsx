import React, { useState } from 'react';
import Header from './components/Header';
import MakerForm from './components/MakerForm';
import OrderGrid from './components/OrderGrid';
import MyOptions from './components/MyOptions';
import { WalletProvider } from './contexts/WalletContext';
import { AppProvider } from './contexts/AppContext';
import { ToastProvider } from './contexts/ToastContext';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'maker' | 'taker' | 'exerciser'>('taker');

  const renderContent = () => {
    switch (activeTab) {
      case 'maker':
        return <MakerForm />;
      case 'taker':
        return <OrderGrid />;
      case 'exerciser':
        return <MyOptions />;
      default:
        return <OrderGrid />;
    }
  };

  return (
    <ToastProvider>
      <WalletProvider>
        <AppProvider>
          <div className="min-h-screen bg-background">
            <Header />
            
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* Tab Navigation */}
              <div className="flex space-x-1 bg-white rounded-lg p-1 mb-8 shadow-sm">
                <button
                  onClick={() => setActiveTab('maker')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'maker'
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:text-primary'
                  }`}
                >
                  Create Option
                </button>
                <button
                  onClick={() => setActiveTab('taker')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'taker'
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:text-primary'
                  }`}
                >
                  Browse Options
                </button>
                <button
                  onClick={() => setActiveTab('exerciser')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'exerciser'
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:text-primary'
                  }`}
                >
                  My Options
                </button>
              </div>

              {/* Content */}
              <div className="space-y-8">
                {renderContent()}
              </div>
            </main>
          </div>
        </AppProvider>
      </WalletProvider>
    </ToastProvider>
  );
};

export default App;

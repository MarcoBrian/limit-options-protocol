import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ordersApi } from '../services/api';
import { OrderSubmission } from '../types';

interface AppContextType {
  orders: any[];
  loading: boolean;
  error: string | null;
  fetchOrders: () => Promise<void>;
  submitOrder: (orderData: OrderSubmission) => Promise<void>;
  exerciseOption: (optionId: number) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ordersApi.getOrders();
      if (response.success) {
        setOrders(response.data.orders);
      } else {
        setError('Failed to fetch orders');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const submitOrder = async (orderData: OrderSubmission) => {
    try {
      setLoading(true);
      setError(null);
      const response = await ordersApi.submitOrder(orderData);
      if (response.success) {
        // Refresh orders after successful submission
        await fetchOrders();
      } else {
        setError(response.message || 'Failed to submit order');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit order');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const exerciseOption = async (optionId: number) => {
    try {
      setLoading(true);
      setError(null);
      // TODO: Implement option exercise logic
      console.log('Exercising option:', optionId);
      // This would typically call a smart contract function
    } catch (err: any) {
      setError(err.message || 'Failed to exercise option');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const value: AppContextType = {
    orders,
    loading,
    error,
    fetchOrders,
    submitOrder,
    exerciseOption,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}; 
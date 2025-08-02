import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ordersApi } from '../services/api';
import { OrderSubmission, OrdersResponse, OrderResponse } from '../types';

interface AppContextType {
  orders: any[];
  loading: boolean;
  error: string | null;
  fetchOrders: () => Promise<void>;
  submitOrder: (orderData: OrderSubmission) => Promise<OrderResponse>;
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

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response: OrdersResponse = await ordersApi.getOrders();
      
      if (response.success && response.data) {
        setOrders(response.data.orders || []);
      } else {
        setError('Failed to fetch orders: Invalid response format');
      }
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, []);

  const submitOrder = useCallback(async (orderData: OrderSubmission) => {
    try {
      setLoading(true);
      setError(null);
      const response = await ordersApi.submitOrder(orderData);
      
      if (response.success) {
        // Refresh orders after successful submission
        await fetchOrders();
        return response;
      } else {
        throw new Error(response.message || 'Failed to submit order');
      }
    } catch (err: any) {
      console.error('Error submitting order:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to submit order';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchOrders]);

  const exerciseOption = useCallback(async (optionId: number) => {
    try {
      setLoading(true);
      setError(null);
      // TODO: Implement option exercise logic
      console.log('Exercising option:', optionId);
      // This would typically call a smart contract function
    } catch (err: any) {
      console.error('Error exercising option:', err);
      setError(err.message || 'Failed to exercise option');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Don't auto-fetch on mount to avoid unnecessary API calls
  // Users can manually refresh or fetch when needed

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
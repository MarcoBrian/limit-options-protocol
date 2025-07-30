import axios from 'axios';
import { OrderSubmission, OrdersResponse, OrderResponse } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const ordersApi = {
  // Get all orders
  getOrders: async (params?: {
    status?: string;
    maker?: string;
    makerAsset?: string;
    takerAsset?: string;
    limit?: number;
  }): Promise<OrdersResponse> => {
    const response = await api.get('/api/orders', { params });
    return response.data;
  },

  // Submit a new order
  submitOrder: async (orderData: OrderSubmission): Promise<OrderResponse> => {
    const response = await api.post('/api/orders', orderData);
    return response.data;
  },

  // Health check
  healthCheck: async () => {
    const response = await api.get('/health');
    return response.data;
  },
};

export default api; 
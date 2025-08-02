import axios from 'axios';
import { OrderSubmission, OrdersResponse, OrderResponse } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`❌ API Response Error: ${error.response?.status} ${error.config?.url}`, error.response?.data);
    return Promise.reject(error);
  }
);

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
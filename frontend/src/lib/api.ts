import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// API helper functions
export const apiHelpers = {
  // Test backend connection
  ping: async () => {
    const response = await api.get('/ping');
    return response.data;
  },

  // Check health status
  health: async () => {
    const response = await api.get('/api/health');
    return response.data;
  },

  // Authentication
  auth: {
    login: async (username: string, password: string) => {
      const response = await api.post('/auth/login', { username, password });
      return response.data;
    },
    register: async (username: string, password: string, roleName: string) => {
      const response = await api.post('/auth/register', { username, password, roleName });
      return response.data;
    },
    me: async () => {
      const response = await api.get('/auth/me');
      return response.data;
    },
  },

  // Menu
  menu: {
    getAll: async () => {
      const response = await api.get('/menu');
      return response.data;
    },
    getById: async (id: number) => {
      const response = await api.get(`/menu/${id}`);
      return response.data;
    },
    getByCategory: async (category: string) => {
      const response = await api.get(`/menu/category/${category}`);
      return response.data;
    },
  },

  // Orders
  orders: {
    create: async (items: Array<{ menuItemId: number; quantity: number; notes?: string }>, tableNumber?: string) => {
      const response = await api.post('/orders', { items, tableNumber });
      return response.data;
    },
    getAll: async (filters?: { status?: string; serverId?: number }) => {
      const response = await api.get('/orders', { params: filters });
      return response.data;
    },
    getById: async (id: number) => {
      const response = await api.get(`/orders/${id}`);
      return response.data;
    },
    update: async (id: number, data: any) => {
      const response = await api.patch(`/orders/${id}`, data);
      return response.data;
    },
    cancelLast: async () => {
      const response = await api.delete('/orders/last');
      return response.data;
    },
    getGrillOrders: async () => {
      const response = await api.get('/orders/grill');
      return response.data;
    },
    // Get active orders for the logged-in server
    getActiveOrders: async () => {
      const response = await api.get('/orders/active');
      return response.data;
    },
    // Mark an order as served
    markAsServed: async (id: number) => {
      const response = await api.patch(`/orders/${id}/served`);
      return response.data;
    },
    // Delete an order
    deleteOrder: async (id: number) => {
      const response = await api.delete(`/orders/${id}`);
      return response.data;
    },
  },
};

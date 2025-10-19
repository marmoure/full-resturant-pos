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
};

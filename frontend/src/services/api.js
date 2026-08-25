import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Request interceptor to add the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token expiration/invalidation
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If we get a 401 on protected routes, clear stale token
      if (!error.config.url.includes('/auth/login')) {
        localStorage.removeItem('token');
      }
    }
    return Promise.reject(error);
  }
);

export default api;


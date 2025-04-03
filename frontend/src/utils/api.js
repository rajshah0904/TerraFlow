import axios from 'axios';

// Create a base axios instance with default configuration
const api = axios.create({
  baseURL: 'http://localhost:8000', // Backend API URL
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('auth_token');
    
    // If token exists, add it to the request headers
    if (token) {
      console.log(`Adding token to request: ${config.url}`);
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.log(`No token available for request: ${config.url}`);
    }
    
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => {
    // Return successful responses directly
    console.log(`API success: ${response.config.url}`, response.status);
    return response;
  },
  (error) => {
    // Handle error responses
    if (error.response) {
      // Server responded with an error status code
      console.error('API Error Response:', {
        url: error.config.url,
        method: error.config.method,
        status: error.response.status,
        data: error.response.data,
      });
      
      // Handle authentication errors (401)
      if (error.response.status === 401) {
        console.error('Authentication failed. Token may be invalid or expired.');
        // Clear local storage if token is invalid or expired
        localStorage.removeItem('auth_token');
        localStorage.removeItem('current_user');
        
        // Optional: Redirect to login page if not already there
        if (!window.location.pathname.includes('/login')) {
          console.log('Redirecting to login page due to auth error');
          window.location.href = '/login';
        }
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('API Request Error (No Response):', error.request);
    } else {
      // Error setting up the request
      console.error('API Setup Error:', error.message);
    }
    
    // Return the rejected promise
    return Promise.reject(error);
  }
);

export default api; 
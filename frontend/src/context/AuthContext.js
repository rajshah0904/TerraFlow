import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../utils/api';

// Create the auth context
const AuthContext = createContext(null);

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Get current user from token
  const getCurrentUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setIsAuthenticated(false);
      return;
    }

    // Try loading user data from localStorage first for instant UI
    const storedUser = localStorage.getItem('current_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCurrentUser(parsed);
        setIsAuthenticated(true);
        setLoading(false);
      } catch (parseErr) {
        console.error('Error parsing stored user:', parseErr);
        // Continue to fetch from API if parsing fails
      }
    }

    try {
      console.log('Fetching current user with token...');
      // Set the auth header directly for this request to ensure it's used
      const response = await api.get('/user/user/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('User data response:', response.data);
      const userData = response.data;
      
      setCurrentUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('current_user', JSON.stringify(userData));
    } catch (err) {
      console.error('Failed to get current user:', err);
      
      if (err.response && err.response.status === 401) {
        console.log('Authentication error: token invalid or expired');
        // Token is invalid, clear it
        logout();
      } else {
        // Other errors - use any user data we loaded from localStorage
        console.log('Non-auth error fetching user data, using cached data if available');
        if (storedUser && !currentUser) {
          try {
            setCurrentUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
          } catch (e) {
            setError('Error loading user data. Please try again later.');
          }
        } else {
          setError('Error fetching user data. Please try again later.');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [token, currentUser]);

  // Register a new user
  const register = async (username, password, email, wallet_address) => {
    setLoading(true);
    setError(null);
    
    try {
      await api.post('/user/register/', {
        username,
        password,
        email,
        wallet_address,
      });
      
      return true;
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Login a user
  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Logging in user:', username);
      const response = await api.post('/user/login/', {
        username,
        password,
      });
      
      console.log('Login response:', response.data);
      const { access_token } = response.data;
      
      if (!access_token) {
        throw new Error('No access token received from server');
      }
      
      // Store token in localStorage and state
      localStorage.setItem('auth_token', access_token);
      setToken(access_token);
      
      // Configure API with the new token
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      // Set authenticated status before getting user data
      setIsAuthenticated(true);
      
      // Get user data
      await getCurrentUser();
      
      return true;
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
      setIsAuthenticated(false);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout the user
  const logout = () => {
    // Remove token and user from localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    
    // Remove auth header
    delete api.defaults.headers.common['Authorization'];
    
    // Reset state
    setToken(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setError(null);
  };

  // Effect to fetch current user when the component mounts or token changes
  useEffect(() => {
    // Set the default authorization header when token changes
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const localUserStr = localStorage.getItem('current_user');
      
      // Only fetch from API if we don't have the user data locally
      if (!currentUser && !localUserStr) {
        console.log('AuthContext: No user data found locally, fetching from API');
        getCurrentUser();
      } else if (!currentUser && localUserStr) {
        // Try to use locally cached user data first
        try {
          const localUser = JSON.parse(localUserStr);
          setCurrentUser(localUser);
          setIsAuthenticated(true);
          setLoading(false);
          console.log('AuthContext: Using cached user data from localStorage');
        } catch (err) {
          console.error('Error parsing cached user data:', err);
          getCurrentUser();
        }
      } else {
        // We already have user data, no need to fetch
        setLoading(false);
      }
    } else {
      delete api.defaults.headers.common['Authorization'];
      setLoading(false);
      setIsAuthenticated(false);
    }
  }, [token]); // Only depends on token, not getCurrentUser

  // Value object to be provided by the context
  const value = {
    currentUser,
    isAuthenticated,
    loading,
    error,
    register,
    login,
    logout,
    setError,
    refreshUser: getCurrentUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext; 
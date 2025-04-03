import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';

/**
 * A wrapper component for routes that require authentication
 * Redirects to login if user is not authenticated
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, refreshUser, currentUser } = useAuth();
  const location = useLocation();

  // Force refresh user data when protected route is accessed
  useEffect(() => {
    console.log('ProtectedRoute: Checking authentication status');
    if (!loading && !isAuthenticated && !currentUser) {
      console.log('ProtectedRoute: Not authenticated, will redirect soon');
    } else if (!loading && isAuthenticated && !currentUser) {
      // Only refresh if we're authenticated but don't have user data
      console.log('ProtectedRoute: User is authenticated but no user data, refreshing user data');
      refreshUser();
    }
  }, [isAuthenticated, loading, refreshUser]); // Removed currentUser from dependency array

  // Show loading spinner while authentication state is being determined
  if (loading) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Verifying your authentication...
        </Typography>
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    console.log('ProtectedRoute: Redirecting to login from', location.pathname);
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Render the children (no need to wrap in Layout as it's already managed by the router)
  return children;
};

export default ProtectedRoute; 
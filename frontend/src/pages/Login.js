import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Box, Container, TextField, Button, Typography, Paper, Alert, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, error, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  // Check if we're already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const redirectTo = location.state?.from || '/dashboard';
      console.log('Already authenticated, redirecting to:', redirectTo);
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLocalError('');
    setDebugInfo('');
    
    if (!username.trim() || !password.trim()) {
      setLocalError('Username and password are required');
      setIsSubmitting(false);
      return;
    }
    
    try {
      setDebugInfo('Attempting login...');
      const success = await login(username, password);
      setDebugInfo(prev => prev + '\nLogin function returned: ' + (success ? 'success' : 'failed'));
      
      if (success) {
        setDebugInfo(prev => prev + '\nRedirecting to dashboard...');
        // Add a small delay to allow the state to update
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 500);
      } else {
        setDebugInfo(prev => prev + '\nLogin failed - no redirect');
      }
    } catch (err) {
      console.error('Login submission error:', err);
      setLocalError('An unexpected error occurred during login. Please try again.');
      setDebugInfo(prev => prev + '\nError during login: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine which error to display (context error or local error)
  const displayError = error || localError;

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h4" align="center" gutterBottom>
            TerraFlow
          </Typography>
          <Typography component="h2" variant="h5" align="center" gutterBottom>
            Sign In
          </Typography>
          
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" sx={{ ml: 1 }}>
                Checking authentication...
              </Typography>
            </Box>
          )}
          
          {displayError && (
            <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
              {typeof displayError === 'string' ? displayError : 'An error occurred. Please try again.'}
            </Alert>
          )}
          
          {debugInfo && (
            <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
              <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                {debugInfo}
              </Typography>
            </Alert>
          )}
          
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Username"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting || loading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting || loading}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={isSubmitting || loading}
            >
              {isSubmitting ? (
                <>
                  <CircularProgress size={24} sx={{ mr: 1 }} />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2">
                Don't have an account?{' '}
                <Link to="/register" style={{ textDecoration: 'none' }}>
                  Register here
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login; 
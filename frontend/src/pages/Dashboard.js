import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Paper,
  CircularProgress,
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  Chip,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useNavigate } from 'react-router-dom';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import SendIcon from '@mui/icons-material/Send';

const Dashboard = () => {
  console.log("DASHBOARD RENDERING STARTED - " + new Date().toISOString());
  
  const { currentUser, isAuthenticated, refreshUser } = useAuth();
  console.log("Auth state in Dashboard:", { 
    isAuthenticated, 
    hasCurrentUser: !!currentUser,
    currentUser: currentUser ? {...currentUser} : null
  });
  
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);
  const [debugView, setDebugView] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [isUpdatingCurrency, setIsUpdatingCurrency] = useState(false);
  const navigate = useNavigate();

  // Supported display currencies
  const supportedCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CNY', 'AUD', 'CAD', 'AED'];

  // Simple fetch function - no caching
  useEffect(() => {
    console.log("Dashboard useEffect triggered", { isAuthenticated, userId: currentUser?.id });
    
    // TEMPORARY: For debugging, exit early with very basic content
    if (debugView) {
      setLoading(false);
      return;
    }
    
    const fetchData = async () => {
      console.log("Starting data fetch...");
      setLoading(true);
      setError(null);
      
      try {
        console.log("Attempting to fetch user wallet");
        // Check if we have a user ID
        if (currentUser && currentUser.id) {
          try {
            console.log(`Fetching wallet for user ${currentUser.id}`);
            const walletsResponse = await api.get(`/wallet/${currentUser.id}`);
            console.log("Wallet response:", walletsResponse.data);
            
            // Convert to array if single object
            const walletData = Array.isArray(walletsResponse.data) 
              ? walletsResponse.data 
              : [walletsResponse.data];
              
            setWallets(walletData);
            // Set the selected currency from the wallet's display currency
            if (walletData.length > 0 && walletData[0].display_currency) {
              setSelectedCurrency(walletData[0].display_currency);
            }
            console.log("Wallets set:", walletData);
          } catch (err) {
            console.error("Wallet fetch error:", err);
            setError(`Wallet error: ${err.message}`);
          }
          
          try {
            console.log(`Fetching transactions for user ${currentUser.id}`);
            const txResponse = await api.get(`/transaction/user/${currentUser.id}`);
            console.log("Transactions response:", txResponse.data);
            setTransactions(Array.isArray(txResponse.data) ? txResponse.data : []);
          } catch (err) {
            console.error("Transactions fetch error:", err);
            setError(`Transactions error: ${err.message}`);
          }
        } else {
          console.warn("No user ID available for data fetch");
          setError("No user ID found");
        }
      } catch (err) {
        console.error("General error:", err);
        setError(`Failed to load data: ${err.message}`);
      } finally {
        setLoading(false);
        console.log("Data fetch complete");
      }
    };

    if (isAuthenticated) {
      fetchData();
    } else {
      setLoading(false);
      console.log("Not authenticated, skipping data fetch");
    }
  }, [isAuthenticated, currentUser?.id, debugView]);

  // Handle currency change
  const handleCurrencyChange = async (event) => {
    const newCurrency = event.target.value;
    
    if (!currentUser?.id || !newCurrency) return;
    
    try {
      setIsUpdatingCurrency(true);
      setSelectedCurrency(newCurrency);
      
      await api.patch('/wallet/display-currency', {
        user_id: currentUser.id,
        display_currency: newCurrency
      });
      
      // Refresh wallet data after updating currency
      const walletsResponse = await api.get(`/wallet/${currentUser.id}`);
      const walletData = Array.isArray(walletsResponse.data) 
        ? walletsResponse.data 
        : [walletsResponse.data];
        
      setWallets(walletData);
      setError(null);
    } catch (err) {
      console.error("Failed to update currency:", err);
      setError(`Failed to update display currency: ${err.message}`);
    } finally {
      setIsUpdatingCurrency(false);
    }
  };

  // Format currency value
  const formatCurrency = (amount, currency) => {
    if (amount == null) return 'N/A';
    
    try {
      // Handle cryptocurrencies which aren't valid ISO 4217 currency codes
      if (['USDT', 'BTC', 'ETH', 'USDC'].includes(currency)) {
        return `${parseFloat(amount || 0).toFixed(2)} ${currency}`;
      }
      
      // Use Intl.NumberFormat for standard currencies
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD'
      }).format(amount);
    } catch (error) {
      console.error("Error formatting currency:", error);
      return `${parseFloat(amount || 0).toFixed(2)} ${currency || 'USD'}`;
    }
  };

  const handleSendMoney = () => {
    navigate('/send');
  };
  
  const handleSendCrypto = () => {
    navigate('/send', { state: { cryptoPreSelected: true } });
  };

  // VERY SIMPLE RENDERING FOR DEBUGGING
  console.log("Before Dashboard render return");
  
  // Super simple view for debugging
  if (debugView) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3, mb: 3, bgcolor: '#f0f8ff', border: '2px solid blue' }}>
          <Typography variant="h4" gutterBottom>SIMPLIFIED DASHBOARD</Typography>
          <Typography variant="body1">This is a simplified dashboard for debugging purposes.</Typography>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6">Authentication Status:</Typography>
            <Typography>Is Authenticated: {isAuthenticated ? "YES" : "NO"}</Typography>
            <Typography>Has Current User: {currentUser ? "YES" : "NO"}</Typography>
            {currentUser && (
              <>
                <Typography>User ID: {currentUser.id}</Typography>
                <Typography>Username: {currentUser.username}</Typography>
              </>
            )}
          </Box>
          
          <Button 
            variant="contained" 
            color="primary"
            sx={{ mt: 2 }}
            onClick={() => {
              console.log("Refresh user clicked");
              refreshUser();
            }}
          >
            Refresh User Data
          </Button>
          
          <Button 
            variant="outlined" 
            color="secondary"
            sx={{ mt: 2, ml: 2 }}
            onClick={() => {
              console.log("Show full dashboard clicked");
              setDebugView(false);
            }}
          >
            Show Full Dashboard
          </Button>
        </Paper>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
            Dashboard
          </Typography>
          
          <Grid container spacing={3}>
            {/* User Information */}
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    User Profile
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="body1">
                    <strong>Username:</strong> {currentUser?.username || 'Unknown'}
                  </Typography>
                  <Typography variant="body1">
                    <strong>User ID:</strong> {currentUser?.id || 'Not available'}
                  </Typography>
                  {currentUser?.email && (
                    <Typography variant="body1">
                      <strong>Email:</strong> {currentUser.email}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          
            {/* Wallet Information */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">
                      {currentUser?.username}'s Wallet
                    </Typography>
                    
                    {/* Currency Selector */}
                    <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
                      <InputLabel id="currency-selector-label">Display Currency</InputLabel>
                      <Select
                        labelId="currency-selector-label"
                        id="currency-selector"
                        value={selectedCurrency}
                        onChange={handleCurrencyChange}
                        label="Display Currency"
                        disabled={isUpdatingCurrency}
                      >
                        {supportedCurrencies.map(currency => (
                          <MenuItem key={currency} value={currency}>
                            {currency}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  {wallets.length === 0 ? (
                    <Alert severity="info">
                      You don't have a wallet yet. One will be created automatically when you make your first deposit.
                    </Alert>
                  ) : (
                    wallets.map((wallet, index) => (
                      <Box key={index}>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="caption" color="text.secondary">
                                Fiat Balance ({wallet.display_currency || wallet.base_currency})
                              </Typography>
                              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                {formatCurrency(wallet.display_balance || wallet.fiat_balance, wallet.display_currency || wallet.base_currency)}
                              </Typography>
                              
                              {/* Only show base currency if different from display currency */}
                              {wallet.display_currency && wallet.base_currency !== wallet.display_currency && (
                                <Typography variant="body2" color="text.secondary">
                                  {formatCurrency(wallet.fiat_balance, wallet.base_currency)} (base currency)
                                </Typography>
                              )}
                            </Box>
                            
                            <Box sx={{ mb: 2 }}>
                              <Accordion elevation={0} sx={{ 
                                backgroundColor: 'transparent', 
                                '&:before': { display: 'none' } 
                              }}>
                                <AccordionSummary 
                                  expandIcon={<ExpandMoreIcon />}
                                  aria-controls="stablecoin-content"
                                  id="stablecoin-header"
                                  sx={{ px: 0, py: 0 }}
                                >
                                  <Typography variant="caption" color="text.secondary">
                                    Stablecoin Details
                                  </Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ px: 0 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                    {formatCurrency(wallet.stablecoin_balance, 'USDT')}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                    Stablecoins are automatically used to facilitate cross-currency transactions. 
                                    You can also choose to send crypto directly when making transfers.
                                  </Typography>
                                </AccordionDetails>
                              </Accordion>
                            </Box>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Wallet Details
                              </Typography>
                              <Box sx={{ mt: 0.5 }}>
                                <Chip 
                                  label={wallet.country_code || 'Global'} 
                                  size="small" 
                                  sx={{ mr: 1, mb: 1 }}
                                />
                                <Chip 
                                  label={`Base: ${wallet.base_currency || 'USD'}`} 
                                  size="small" 
                                  sx={{ mr: 1, mb: 1 }}
                                  color={wallet.base_currency === wallet.display_currency ? "primary" : "default"}
                                />
                                {wallet.blockchain_address && (
                                  <Chip 
                                    label="Blockchain Enabled"
                                    size="small"
                                    color="success"
                                    sx={{ mb: 1 }}
                                  />
                                )}
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>
                        
                        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                          <Button variant="contained" color="primary" size="small">
                            Deposit
                          </Button>
                          <Button 
                            variant="outlined" 
                            color="primary" 
                            size="small"
                            startIcon={<SendIcon />}
                            onClick={handleSendMoney}
                          >
                            Send Money
                          </Button>
                          <Button 
                            variant="outlined" 
                            color="secondary" 
                            size="small"
                            startIcon={<CurrencyBitcoinIcon />}
                            onClick={handleSendCrypto}
                          >
                            Send Crypto
                          </Button>
                        </Box>
                      </Box>
                    ))
                  )}
                </CardContent>
              </Card>
            </Grid>
            
            {/* Recent Transactions */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recent Transactions
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  {transactions.length === 0 ? (
                    <Alert severity="info">No transactions found yet.</Alert>
                  ) : (
                    transactions.slice(0, 5).map((tx, index) => (
                      <Box key={index} sx={{ mb: 2, pb: 2, borderBottom: index < 4 ? '1px solid #eee' : 'none' }}>
                        <Grid container alignItems="center">
                          <Grid item xs={8}>
                            <Typography variant="body1">
                              {tx.sender_id === currentUser?.id ? (
                                <span>Sent to ID: {tx.recipient_id}</span>
                              ) : (
                                <span>Received from ID: {tx.sender_id}</span>
                              )}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(tx.timestamp).toLocaleString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={4} textAlign="right">
                            <Typography 
                              variant="body1" 
                              color={tx.sender_id === currentUser?.id ? "error" : "success"}
                              fontWeight="bold"
                            >
                              {tx.sender_id === currentUser?.id ? '-' : '+'}{formatCurrency(tx.source_amount, tx.source_currency)}
                            </Typography>
                            {tx.source_currency !== tx.target_currency && (
                              <Typography variant="caption" color="text.secondary">
                                {formatCurrency(tx.target_amount, tx.target_currency)}
                              </Typography>
                            )}
                          </Grid>
                        </Grid>
                      </Box>
                    ))
                  )}
                  
                  {transactions.length > 5 && (
                    <Box textAlign="center" mt={2}>
                      <Button variant="text" color="primary">
                        View All Transactions
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Container>
  );
};

export default Dashboard; 
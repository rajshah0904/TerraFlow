import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Grid, 
  Button, 
  Card, 
  CardContent, 
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  FormHelperText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Switch,
  FormControlLabel,
  Collapse,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { 
  AccountBalanceWallet, 
  ContentCopy, 
  Add,
  Visibility,
  VisibilityOff,
  ExpandMore as ExpandMoreIcon,
  ExpandLess,
  ArrowUpward,
  ArrowDownward,
  CurrencyBitcoin,
  Send
} from '@mui/icons-material';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Wallets = () => {
  const { currentUser } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [walletFormData, setWalletFormData] = useState({
    user_id: null,
    base_currency: 'USD',
    display_currency: 'USD',
    country_code: ''
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPrivateKeys, setShowPrivateKeys] = useState({});
  const [copySuccess, setCopySuccess] = useState('');
  const [cryptoEnabled, setCryptoEnabled] = useState(false);
  const [showCrypto, setShowCrypto] = useState(false);
  const navigate = useNavigate();

  const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD', 'CNY', 'INR', 'AED'];
  const countryCodes = ['US', 'GB', 'EU', 'CA', 'JP', 'AU', 'CN', 'IN', 'AE', 'GLOBAL'];

  useEffect(() => {
    fetchWallets();
  }, []);

  useEffect(() => {
    // Update user_id in form data when currentUser changes
    if (currentUser && currentUser.id) {
      setWalletFormData(prev => ({
        ...prev,
        user_id: currentUser.id
      }));
    }
  }, [currentUser]);

  const fetchWallets = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching wallets...');
      let walletsData = [];
      
      // First try to get wallets for the specific user if we have a user ID
      if (currentUser && currentUser.id) {
        try {
          const response = await api.get(`/wallet/${currentUser.id}`);
          console.log('User wallet response:', response.data);
          if (Array.isArray(response.data)) {
            walletsData = response.data;
          } else if (response.data) {
            // If it's a single wallet or has a different structure
            walletsData = [response.data];
          }
        } catch (userWalletErr) {
          console.warn('Error fetching user-specific wallet, trying general endpoint:', userWalletErr);
        }
      }
      
      // If we couldn't get user-specific wallets or they were empty, try the general endpoint
      if (walletsData.length === 0) {
        try {
          const allWalletsResponse = await api.get('/wallet/');
          console.log('All wallets response:', allWalletsResponse.data);
          if (Array.isArray(allWalletsResponse.data)) {
            walletsData = allWalletsResponse.data;
          } else if (allWalletsResponse.data) {
            walletsData = [allWalletsResponse.data];
          }
        } catch (allWalletsErr) {
          console.error('Error fetching all wallets:', allWalletsErr);
          throw allWalletsErr; // Re-throw to be caught by the outer catch
        }
      }
      
      console.log('Final wallets data:', walletsData);
      setWallets(walletsData);
    } catch (err) {
      console.error('Error fetching wallets:', err);
      setError('Failed to load wallets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWallet = async () => {
    setFormError('');
    setIsSubmitting(true);
    
    try {
      // Validate form data
      if (!walletFormData.base_currency) {
        setFormError('Base currency is required');
        setIsSubmitting(false);
        return;
      }
      
      // Ensure user_id is set
      if (!walletFormData.user_id && currentUser && currentUser.id) {
        walletFormData.user_id = currentUser.id;
      }
      
      // Set default country code if not provided
      const dataToSubmit = {
        ...walletFormData,
        country_code: walletFormData.country_code || 'GLOBAL'
      };
      
      console.log('Creating wallet with data:', dataToSubmit);
      const response = await api.post('/wallet/create', dataToSubmit);
      console.log('Wallet creation response:', response.data);
      
      if (response.data) {
        // Add the new wallet to the state
        setWallets([...wallets, response.data]);
        setOpenDialog(false);
        resetFormData();
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error creating wallet:', err);
      
      // Handle 409 Conflict specifically - user already has a wallet
      if (err.response?.status === 409) {
        setFormError('You already have a wallet. Each user can only have one wallet.');
        
        // Refresh the wallet list to show the existing wallet
        fetchWallets();
        
        // Close the dialog after a short delay
        setTimeout(() => {
          setOpenDialog(false);
          resetFormData();
        }, 3000);
      } else {
        // Handle other errors
        setFormError(err.response?.data?.detail || 'Failed to create wallet. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFormData = () => {
    setWalletFormData({
      user_id: currentUser?.id || null,
      base_currency: 'USD',
      display_currency: 'USD',
      country_code: ''
    });
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    resetFormData();
    setFormError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setWalletFormData({
      ...walletFormData,
      [name]: value
    });
  };

  const togglePrivateKeyVisibility = (walletId) => {
    setShowPrivateKeys({
      ...showPrivateKeys,
      [walletId]: !showPrivateKeys[walletId]
    });
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopySuccess(`${type} copied!`);
        setTimeout(() => setCopySuccess(''), 2000);
      },
      () => {
        setCopySuccess('Failed to copy');
      }
    );
  };

  const formatCurrency = (amount, currency = 'USD') => {
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
      }).format(amount || 0);
    } catch (error) {
      console.error("Error formatting currency:", error);
      return `${parseFloat(amount || 0).toFixed(2)} ${currency || 'USD'}`;
    }
  };

  const handleSendCrypto = () => {
    navigate('/send', { state: { cryptoPreSelected: true } });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h4" component="h1">
              Your Wallet
            </Typography>
            {wallets.length === 0 && (
              <Button 
                variant="contained" 
                startIcon={<Add />}
                onClick={() => setOpenDialog(true)}
              >
                New Wallet
              </Button>
            )}
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {copySuccess && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {copySuccess}
            </Alert>
          )}

          {wallets.length === 0 ? (
            <Box textAlign="center" py={5}>
              <AccountBalanceWallet sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No Wallet Found
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                You haven't created a wallet yet. Create your wallet to start sending and receiving payments.
              </Typography>
              <Button 
                variant="contained" 
                startIcon={<Add />}
                onClick={() => setOpenDialog(true)}
              >
                Create Your Wallet
              </Button>
            </Box>
          ) : (
            // Full-width wallet display instead of a grid
            <Box>
              {wallets.map((wallet, index) => (
                <Paper 
                  key={wallet.id || index}
                  sx={{ 
                    p: 3, 
                    width: '100%',
                    mb: 3,
                    borderRadius: 2,
                    boxShadow: 2,
                  }}
                >
                  <Typography variant="h5" gutterBottom>
                    {currentUser.username}'s Wallet
                  </Typography>
                  
                  {/* Fiat Balance Section - Full width */}
                  <Box sx={{ 
                    p: 4, 
                    border: '1px solid', 
                    borderColor: 'primary.light',
                    borderRadius: 2,
                    mb: 3,
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                  }}>
                    <Typography variant="subtitle1" color="primary" gutterBottom fontWeight="medium">
                      Your Balance
                    </Typography>
                    <Typography variant="h2" fontWeight="bold" sx={{ my: 2 }}>
                      {formatCurrency(wallet.fiat_balance, wallet.base_currency || wallet.currency)}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Base Currency: {wallet.base_currency || wallet.currency}
                      </Typography>
                      {wallet.display_currency && wallet.base_currency !== wallet.display_currency && (
                        <Typography variant="body2" color="text.secondary">
                          • Display Currency: {wallet.display_currency}
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                      This is your main wallet balance for all transactions. Send and receive payments in multiple currencies with automatic conversion.
                    </Typography>
                  </Box>
                  
                  {/* Crypto toggle switch */}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={cryptoEnabled}
                          onChange={(e) => setCryptoEnabled(e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <CurrencyBitcoin fontSize="small" sx={{ mr: 0.5 }} />
                          <Typography variant="body2">Cryptocurrency Features</Typography>
                        </Box>
                      }
                    />
                  </Box>
                  
                  {/* Crypto section - Only visible if enabled */}
                  {cryptoEnabled && (
                    <Box sx={{ mb: 3 }}>
                      <Paper sx={{ 
                        p: 3, 
                        borderRadius: 2,
                        bgcolor: 'rgba(0, 0, 0, 0.03)', 
                        border: '1px solid',
                        borderColor: 'divider'
                      }}>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                          <CurrencyBitcoin sx={{ mr: 1 }} />
                          Cryptocurrency Assets
                        </Typography>
                        
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                          {/* USDT Section */}
                          <Grid item xs={12} sm={6} md={4}>
                            <Box sx={{ 
                              p: 2, 
                              border: '1px solid', 
                              borderColor: 'divider',
                              borderRadius: 1,
                              bgcolor: 'background.paper'
                            }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="subtitle2" color="text.secondary">USDT</Typography>
                                <Chip label="Stablecoin" size="small" color="success" variant="outlined" />
                              </Box>
                              <Typography variant="h5" fontWeight="medium">
                                {formatCurrency(wallet.stablecoin_balance, 'USDT')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                ~{formatCurrency(wallet.stablecoin_balance, wallet.base_currency)}
                              </Typography>
                            </Box>
                          </Grid>
                          
                          {/* Bitcoin Section (mock data) */}
                          <Grid item xs={12} sm={6} md={4}>
                            <Box sx={{ 
                              p: 2, 
                              border: '1px solid', 
                              borderColor: 'divider',
                              borderRadius: 1,
                              bgcolor: 'background.paper'
                            }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="subtitle2" color="text.secondary">BTC</Typography>
                                <Chip label="Crypto" size="small" color="warning" variant="outlined" />
                              </Box>
                              <Typography variant="h5" fontWeight="medium">
                                0.00 BTC
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                ~$0.00
                              </Typography>
                            </Box>
                          </Grid>
                          
                          {/* Ethereum Section (mock data) */}
                          <Grid item xs={12} sm={6} md={4}>
                            <Box sx={{ 
                              p: 2, 
                              border: '1px solid', 
                              borderColor: 'divider',
                              borderRadius: 1,
                              bgcolor: 'background.paper'
                            }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="subtitle2" color="text.secondary">ETH</Typography>
                                <Chip label="Crypto" size="small" color="warning" variant="outlined" />
                              </Box>
                              <Typography variant="h5" fontWeight="medium">
                                0.00 ETH
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                ~$0.00
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                        
                        <Box sx={{ mt: 3 }}>
                          <Alert severity="info" icon={false}>
                            <Typography variant="body2">
                              Want to buy or trade cryptocurrencies? This feature is coming soon.
                            </Typography>
                          </Alert>
                          
                          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                            <Button 
                              variant="outlined" 
                              color="secondary"
                              startIcon={<CurrencyBitcoin />}
                              sx={{ px: 3, py: 1 }}
                            >
                              Send Cryptocurrency
                            </Button>
                          </Box>
                        </Box>
                      </Paper>
                    </Box>
                  )}
                  
                  {cryptoEnabled && (
                    <Box sx={{ mt: 3, mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                        Cryptocurrency Options
                      </Typography>
                      <Alert 
                        severity="info"
                        sx={{ mb: 2 }}
                      >
                        Cryptocurrency features are coming soon. You'll be able to buy and trade crypto directly from your wallet.
                      </Alert>
                      <Button 
                        variant="outlined" 
                        color="secondary"
                        startIcon={<CurrencyBitcoin />}
                        onClick={handleSendCrypto}
                        fullWidth
                        sx={{ mt: 1 }}
                      >
                        Send Cryptocurrency
                      </Button>
                    </Box>
                  )}
                  
                  {wallet.blockchain_address && (
                    <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                        Blockchain Address
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            maxWidth: '80%', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            mr: 1
                          }}
                        >
                          {showPrivateKeys[wallet.id] ? wallet.blockchain_address : 
                            wallet.blockchain_address?.substring(0, 10) + '...' + 
                            wallet.blockchain_address?.substring(wallet.blockchain_address.length - 6)}
                        </Typography>
                        <Tooltip title={showPrivateKeys[wallet.id] ? "Hide Address" : "Show Full Address"}>
                          <IconButton 
                            size="small" 
                            onClick={() => togglePrivateKeyVisibility(wallet.id)}
                          >
                            {showPrivateKeys[wallet.id] ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Copy Address">
                          <IconButton 
                            size="small"
                            onClick={() => copyToClipboard(wallet.blockchain_address, "Blockchain address")}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  )}
                  
                  <Box sx={{ 
                    mt: 4, 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: 3
                  }}>
                    <Button 
                      variant="contained" 
                      color="primary" 
                      size="large"
                      startIcon={<ArrowDownward />}
                      sx={{ 
                        px: 4, 
                        py: 1.5,
                        fontSize: '1rem',
                        boxShadow: 2
                      }}
                    >
                      Deposit Funds
                    </Button>
                    <Button 
                      variant="outlined" 
                      color="primary"
                      size="large"
                      startIcon={<ArrowUpward />}
                      sx={{ 
                        px: 4, 
                        py: 1.5,
                        fontSize: '1rem',
                        boxShadow: 1
                      }}
                    >
                      Send Money
                    </Button>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </Paper>
      </Box>
      
      {/* Create Wallet Dialog */}
      <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create Your Wallet</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          
          <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 3 }}>
            Each user has one wallet that supports multiple currencies. Your wallet will store your local currency and display in your preferred currency.
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="base-currency-label">Base Currency</InputLabel>
                <Select
                  labelId="base-currency-label"
                  id="base-currency"
                  name="base_currency"
                  value={walletFormData.base_currency}
                  onChange={handleInputChange}
                  label="Base Currency"
                >
                  {currencies.map((currency) => (
                    <MenuItem key={currency} value={currency}>
                      {currency}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>This will be your wallet's main currency</FormHelperText>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="display-currency-label">Display Currency</InputLabel>
                <Select
                  labelId="display-currency-label"
                  id="display-currency"
                  name="display_currency"
                  value={walletFormData.display_currency}
                  onChange={handleInputChange}
                  label="Display Currency"
                >
                  {currencies.map((currency) => (
                    <MenuItem key={currency} value={currency}>
                      {currency}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Currency to display your balance</FormHelperText>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="country-code-label">Country</InputLabel>
                <Select
                  labelId="country-code-label"
                  id="country-code"
                  name="country_code"
                  value={walletFormData.country_code}
                  onChange={handleInputChange}
                  label="Country"
                >
                  <MenuItem value="">Global (Default)</MenuItem>
                  {countryCodes.map((code) => (
                    <MenuItem key={code} value={code}>
                      {code}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Your location for regulatory compliance</FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button 
            onClick={handleCreateWallet} 
            variant="contained" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Wallet'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Wallets; 
import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Grid, 
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Divider,
  FormControlLabel,
  Switch
} from '@mui/material';
import { 
  Send, 
  AccountBalanceWallet, 
  Check, 
  Person
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SendMoney = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isAuthenticated } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingFunds, setSendingFunds] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [transactionId, setTransactionId] = useState(null);
  const [formData, setFormData] = useState({
    sourceWalletId: '',
    recipientAddress: '',
    amount: '',
    currency: 'USD',
    description: '',
    isCryptoTransaction: false,
    cryptoCurrency: 'USDT'
  });
  const [formErrors, setFormErrors] = useState({});
  const [conversionRate, setConversionRate] = useState(null);
  const [estimatedFee, setEstimatedFee] = useState(0);
  const [recipientInfo, setRecipientInfo] = useState(null);

  const steps = ['Select wallet', 'Enter recipient', 'Confirm transfer'];

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/send' } });
      return;
    }
    
    // Check if we should pre-select crypto transaction option
    if (location.state?.cryptoPreSelected) {
      setFormData(prev => ({
        ...prev,
        isCryptoTransaction: true,
        cryptoCurrency: 'BTC' // Default to Bitcoin
      }));
    }
    
    fetchWallets();
  }, [isAuthenticated, navigate, location]);

  useEffect(() => {
    if (formData.sourceWalletId && formData.currency) {
      const selectedWallet = wallets.find(wallet => wallet.id === formData.sourceWalletId);
      if (selectedWallet && selectedWallet.currency !== formData.currency) {
        fetchConversionRate(selectedWallet.currency, formData.currency);
      } else {
        setConversionRate(null);
      }
    }
  }, [formData.sourceWalletId, formData.currency, wallets]);

  const fetchWallets = async () => {
    setLoading(true);
    try {
      if (!currentUser || !currentUser.id) {
        console.error('Cannot fetch wallets: no current user ID');
        setError('User authentication error. Please log in again.');
        setWallets([]);
        setLoading(false);
        return;
      }
      
      console.log('Fetching wallets for user:', currentUser.id);
      
      const response = await axios.get(`/wallet/${currentUser.id}`);
      
      if (response.data) {
        const walletsData = Array.isArray(response.data) ? response.data : [response.data];
        
        const validWallets = walletsData.filter(wallet => {
          if (!wallet) return false;
          if (wallet.id == null) return false;
          
          return wallet.user_id === currentUser.id;
        });
        
        console.log(`Found ${validWallets.length} valid wallets for user ${currentUser.id}`);
        
        setWallets(validWallets);
        
        if (validWallets.length > 0) {
          setFormData(prev => ({
            ...prev,
            sourceWalletId: validWallets[0].id,
            currency: validWallets[0].currency
          }));
        }
      } else {
        console.warn('No wallet data returned from API');
        setWallets([]);
      }
    } catch (err) {
      console.error('Error fetching wallets:', err);
      setError('Failed to load wallets. Please try again.');
      setWallets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchConversionRate = async (fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) {
      setConversionRate(1);
      return;
    }
    
    try {
      const response = await axios.get(`/currency/rate/${fromCurrency}/${toCurrency}/`);
      setConversionRate(response.data.rate);
    } catch (err) {
      console.error('Error fetching conversion rate:', err);
      setConversionRate(null);
    }
  };

  const lookupRecipient = async () => {
    if (!formData.recipientAddress) return;
    
    try {
      const response = await axios.get(`/wallet/lookup/${formData.recipientAddress}/`);
      setRecipientInfo(response.data);
      setFormErrors(prev => ({ ...prev, recipientAddress: null }));
    } catch (err) {
      console.error('Error looking up recipient:', err);
      setRecipientInfo(null);
      setFormErrors(prev => ({ 
        ...prev, 
        recipientAddress: 'Invalid recipient address' 
      }));
    }
  };

  const calculateFee = () => {
    const amount = parseFloat(formData.amount) || 0;
    const feeRate = 0.01;
    const calculatedFee = amount * feeRate;
    
    setEstimatedFee(calculatedFee);
    return calculatedFee;
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.sourceWalletId) {
      errors.sourceWalletId = 'Please select a source wallet';
    }
    
    if (!formData.recipientAddress) {
      errors.recipientAddress = 'Recipient address is required';
    }
    
    if (!formData.amount) {
      errors.amount = 'Amount is required';
    } else if (isNaN(formData.amount) || parseFloat(formData.amount) <= 0) {
      errors.amount = 'Amount must be a positive number';
    } else {
      const selectedWallet = wallets.find(wallet => wallet.id === formData.sourceWalletId);
      if (selectedWallet) {
        // Check balance based on transaction type
        if (formData.isCryptoTransaction) {
          // For crypto transactions, check stablecoin balance
          const cryptoBalance = parseFloat(selectedWallet.stablecoin_balance || 0);
          if (parseFloat(formData.amount) > cryptoBalance) {
            errors.amount = `Insufficient ${formData.cryptoCurrency} funds in the source wallet`;
          }
        } else {
          // For regular transactions, check fiat balance
          const amountInSourceCurrency = formData.currency === selectedWallet.currency
            ? parseFloat(formData.amount)
            : parseFloat(formData.amount) / (conversionRate || 1);
          
          const walletBalance = parseFloat(selectedWallet.fiat_balance || selectedWallet.balance || 0);
          
          if (amountInSourceCurrency > walletBalance) {
            errors.amount = 'Insufficient funds in the source wallet';
          }
        }
      }
    }
    
    if (!formData.isCryptoTransaction && !formData.currency) {
      errors.currency = 'Currency is required';
    }
    
    if (formData.isCryptoTransaction && !formData.cryptoCurrency) {
      errors.cryptoCurrency = 'Cryptocurrency is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: null
      });
    }
  };

  const handleRecipientChange = (e) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      recipientAddress: value
    }));
    
    setRecipientInfo(null);
  };

  const handleSubmit = async () => {
    setSendingFunds(true);
    setError(null);
    
    try {
      if (!isAuthenticated || !currentUser || !currentUser.id) {
        throw new Error('You must be logged in to send funds');
      }
      
      const selectedWallet = wallets.find(wallet => wallet.id === formData.sourceWalletId);
      if (!selectedWallet || selectedWallet.user_id !== currentUser.id) {
        throw new Error('Invalid source wallet selected');
      }

      // Handle different transaction types
      let response;
      
      if (formData.isCryptoTransaction) {
        // For crypto transactions, use the crypto endpoint
        response = await axios.post('/transaction/crypto/', {
          sender_id: currentUser.id,
          recipient_id: parseInt(formData.recipientAddress), // Assuming this is a user ID
          amount: parseFloat(formData.amount),
          crypto_currency: formData.cryptoCurrency,
          description: formData.description || 'Crypto transfer'
        });
      } else {
        // For regular transactions, use the standard endpoint with automatic stablecoin conversion
        response = await axios.post('/transaction/', {
          sender_id: currentUser.id,
          recipient_id: parseInt(formData.recipientAddress), // Assuming this is a user ID
          amount: parseFloat(formData.amount),
          source_currency: selectedWallet.base_currency || selectedWallet.currency,
          target_currency: formData.currency,
          description: formData.description || 'Standard transfer'
        });
      }
      
      setSuccess(true);
      setTransactionId(response.data.transaction_id);
      
      setFormData({
        sourceWalletId: '',
        recipientAddress: '',
        amount: '',
        currency: 'USD',
        description: '',
        isCryptoTransaction: false,
        cryptoCurrency: 'USDT'
      });
    } catch (err) {
      console.error('Error sending funds:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to send funds. Please try again.');
    } finally {
      setSendingFunds(false);
    }
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!formData.sourceWalletId) {
        setFormErrors(prev => ({ ...prev, sourceWalletId: 'Please select a source wallet' }));
        return;
      }
    } else if (activeStep === 1) {
      if (!validateForm()) {
        return;
      }
      calculateFee();
      lookupRecipient();
    } else if (activeStep === 2) {
      handleSubmit();
      return;
    }
    
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
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
        currency
      }).format(amount || 0);
    } catch (error) {
      console.error("Error formatting currency:", error);
      return `${parseFloat(amount || 0).toFixed(2)} ${currency}`;
    }
  };

  const getSelectedWallet = () => {
    return wallets.find(wallet => wallet.id === formData.sourceWalletId);
  };

  const calculateTotal = () => {
    const amount = parseFloat(formData.amount) || 0;
    return amount + estimatedFee;
  };

  const formatWalletDisplay = (wallet) => {
    if (!wallet) return 'Unknown Wallet';
    
    return (
      <Box>
        <Typography variant="body1" component="span" fontWeight="medium">
          {currentUser.username}'s Wallet
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          {formatCurrency(wallet.fiat_balance, wallet.base_currency || wallet.currency)} • {wallet.base_currency || wallet.currency}
          {wallet.stablecoin_balance > 0 && ` • ${formatCurrency(wallet.stablecoin_balance, 'USDT')} USDT`}
        </Typography>
      </Box>
    );
  };

  const getRecipientDisplayName = (recipient) => {
    if (!recipient) return '';
    
    try {
      const name = recipient.name || recipient.username || '';
      const address = recipient.wallet_address || recipient.address || '';
      
      if (name) {
        return `${name} (${address ? address.substring(0, 8) + '...' : 'No address'})`;
      }
      
      return address ? address.substring(0, 12) + '...' : 'Unknown recipient';
    } catch (error) {
      console.error('Error getting recipient display name:', error);
      return 'Unknown recipient';
    }
  };

  const renderWalletOptions = () => {
    if (!wallets || wallets.length === 0) {
      return [
        <MenuItem key="no-wallets" value="" disabled>
          No wallets available
        </MenuItem>
      ];
    }
    
    return wallets.map(wallet => {
      try {
        if (!wallet) return null;
        
        const id = wallet.id != null ? wallet.id : '';
        if (id === '') return null;
        
        const balance = wallet.fiat_balance || wallet.balance || 0;
        const currency = wallet.currency || 'USD'; 
        const walletAddress = wallet.wallet_address || wallet.address || '';
        const displayAddress = walletAddress && typeof walletAddress === 'string' && walletAddress.length >= 6 
          ? `${walletAddress.substring(0, 6)}...` 
          : id.toString().substring(0, 6);
        
        return (
          <MenuItem key={id} value={id}>
            {`${displayAddress} (${balance} ${currency})`}
          </MenuItem>
        );
      } catch (error) {
        console.error('Error rendering wallet option:', error, wallet);
        return null;
      }
    }).filter(Boolean);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (success) {
    return (
      <Container maxWidth="md">
        <Paper sx={{ p: 4, mt: 4, textAlign: 'center' }}>
          <Check sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Transfer Successful!
          </Typography>
          <Typography variant="body1" paragraph>
            Your transfer has been successfully initiated. Transaction ID: {transactionId}
          </Typography>
          <Box mt={4}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => navigate('/dashboard')}
            >
              Back to Dashboard
            </Button>
            <Button 
              variant="outlined" 
              sx={{ ml: 2 }}
              onClick={() => {
                setSuccess(false);
                setActiveStep(0);
              }}
            >
              Send Another Payment
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  if (!isAuthenticated) {
    return (
      <Container maxWidth="md">
        <Paper sx={{ p: 4, mt: 4, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom>
            Authentication Required
          </Typography>
          <Typography variant="body1" paragraph>
            You must be logged in to send money.
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => navigate('/login', { state: { from: '/send' } })}
          >
            Login
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Send Money
          </Typography>
          
          <Stepper activeStep={activeStep} sx={{ mb: 4, mt: 3 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          {activeStep === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Select Source Wallet
              </Typography>
              
              {wallets.length === 0 ? (
                <Box textAlign="center" py={3}>
                  <AccountBalanceWallet sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    No Wallets Found
                  </Typography>
                  <Typography variant="body1" color="text.secondary" paragraph>
                    You need to create a wallet before you can send funds.
                  </Typography>
                  <Button 
                    variant="contained" 
                    onClick={() => navigate('/wallets/new')}
                  >
                    Create Wallet
                  </Button>
                </Box>
              ) : (
                <Grid container spacing={3}>
                  {wallets.map((wallet) => {
                    if (!wallet || wallet.id == null) return null;
                    
                    if (wallet.user_id !== currentUser.id) return null;
                    
                    return (
                      <Grid item xs={12} sm={6} key={wallet.id}>
                        <Card 
                          sx={{ 
                            cursor: 'pointer',
                            border: formData.sourceWalletId === wallet.id ? 2 : 0,
                            borderColor: 'primary.main',
                            transition: 'all 0.3s'
                          }}
                          onClick={() => setFormData(prev => ({ 
                            ...prev, 
                            sourceWalletId: wallet.id,
                            currency: wallet.currency
                          }))}
                        >
                          <CardContent>
                            <Typography variant="h6" gutterBottom>
                              {formatWalletDisplay(wallet)}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
              
              {formErrors.sourceWalletId && (
                <FormHelperText error>{formErrors.sourceWalletId}</FormHelperText>
              )}
            </Box>
          )}
          
          {activeStep === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Enter Recipient Details
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Recipient Address"
                    name="recipientAddress"
                    value={formData.recipientAddress}
                    onChange={handleRecipientChange}
                    error={!!formErrors.recipientAddress}
                    helperText={formErrors.recipientAddress}
                    onBlur={lookupRecipient}
                  />
                </Grid>
                
                {recipientInfo && (
                  <Grid item xs={12}>
                    <Alert severity="info" icon={<Person />}>
                      Recipient: {getRecipientDisplayName(recipientInfo)}
                    </Alert>
                  </Grid>
                )}
                
                <Grid item xs={12}>
                  <FormControl component="fieldset">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.isCryptoTransaction}
                          onChange={(e) => setFormData({
                            ...formData,
                            isCryptoTransaction: e.target.checked
                          })}
                          name="isCryptoTransaction"
                        />
                      }
                      label="Send as cryptocurrency"
                    />
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Amount"
                    name="amount"
                    type="number"
                    value={formData.amount}
                    onChange={handleInputChange}
                    error={!!formErrors.amount}
                    helperText={formErrors.amount}
                    InputProps={{
                      inputProps: { min: 0, step: "0.01" }
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  {formData.isCryptoTransaction ? (
                    <FormControl fullWidth error={!!formErrors.cryptoCurrency}>
                      <InputLabel id="crypto-currency-select-label">Cryptocurrency</InputLabel>
                      <Select
                        labelId="crypto-currency-select-label"
                        id="crypto-currency-select"
                        name="cryptoCurrency"
                        value={formData.cryptoCurrency}
                        onChange={handleInputChange}
                        label="Cryptocurrency"
                      >
                        <MenuItem value="USDT">USDT (Tether)</MenuItem>
                        <MenuItem value="BTC">BTC (Bitcoin)</MenuItem>
                        <MenuItem value="ETH">ETH (Ethereum)</MenuItem>
                        <MenuItem value="USDC">USDC (USD Coin)</MenuItem>
                      </Select>
                      {formErrors.cryptoCurrency && (
                        <FormHelperText>{formErrors.cryptoCurrency}</FormHelperText>
                      )}
                    </FormControl>
                  ) : (
                    <FormControl fullWidth error={!!formErrors.currency}>
                      <InputLabel id="currency-select-label">Currency</InputLabel>
                      <Select
                        labelId="currency-select-label"
                        id="currency-select"
                        name="currency"
                        value={formData.currency}
                        onChange={handleInputChange}
                        label="Currency"
                      >
                        <MenuItem value="USD">USD</MenuItem>
                        <MenuItem value="EUR">EUR</MenuItem>
                        <MenuItem value="GBP">GBP</MenuItem>
                        <MenuItem value="JPY">JPY</MenuItem>
                      </Select>
                      {formErrors.currency && (
                        <FormHelperText>{formErrors.currency}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description (Optional)"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    multiline
                    rows={2}
                  />
                </Grid>
              </Grid>
              
              {!formData.isCryptoTransaction && conversionRate && formData.amount && (
                <Alert severity="info" sx={{ mt: 3 }}>
                  You're sending {formatCurrency(formData.amount, formData.currency)}. 
                  This will convert to approximately {formatCurrency(
                    parseFloat(formData.amount) / conversionRate, 
                    getSelectedWallet()?.currency
                  )} from your wallet.
                </Alert>
              )}
              
              {formData.isCryptoTransaction && formData.amount && (
                <Alert severity="info" sx={{ mt: 3 }}>
                  You're sending {formatCurrency(formData.amount, formData.cryptoCurrency)} directly as cryptocurrency.
                  This transaction will use the blockchain network and may take longer to process than regular transfers.
                </Alert>
              )}
            </Box>
          )}
          
          {activeStep === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Review and Confirm
              </Typography>
              
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        From
                      </Typography>
                      <Typography variant="body1">
                        {formatWalletDisplay(getSelectedWallet())}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        To
                      </Typography>
                      <Typography variant="body1">
                        {getRecipientDisplayName(recipientInfo)}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Amount
                      </Typography>
                      <Typography variant="h6">
                        {formatCurrency(formData.amount, formData.currency)}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Fee
                      </Typography>
                      <Typography variant="body1">
                        {formatCurrency(estimatedFee, formData.currency)}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Total
                      </Typography>
                      <Typography variant="h5">
                        {formatCurrency(calculateTotal(), formData.currency)}
                      </Typography>
                    </Grid>
                    
                    {formData.description && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Description
                        </Typography>
                        <Typography variant="body1">
                          {formData.description}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
              
              <Alert severity="warning" sx={{ mb: 3 }}>
                Please review the transaction details carefully. All transactions are final and cannot be reversed.
              </Alert>
            </Box>
          )}
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              variant="outlined"
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={activeStep === steps.length - 1 ? <Send /> : null}
              disabled={
                wallets.length === 0 || 
                sendingFunds || 
                (activeStep === 0 && !formData.sourceWalletId)
              }
            >
              {sendingFunds ? (
                <>
                  <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
                  Processing...
                </>
              ) : activeStep === steps.length - 1 ? (
                'Send Money'
              ) : (
                'Next'
              )}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default SendMoney; 
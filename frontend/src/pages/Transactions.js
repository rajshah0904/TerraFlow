import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Paper, 
  Typography, 
  Box, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  TablePagination,
  Chip,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
} from '@mui/material';
import {
  Search,
  FilterList,
  ArrowUpward,
  ArrowDownward,
  SwapHoriz,
  ContentCopy,
  Info,
  Download,
  ReceiptLong
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { format } from 'date-fns';

const Transactions = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [filters, setFilters] = useState({
    type: 'all',
    dateRange: 'all',
    status: 'all',
    wallet: 'all'
  });
  const [wallets, setWallets] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [walletFilter, setWalletFilter] = useState('all');

  // Safe formatting functions to avoid undefined errors
  const formatCurrency = (amount, currency = 'USD') => {
    if (amount == null || amount === undefined) return 'N/A';
    
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

  const formatDateSafely = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      return format(new Date(dateString), 'MMM d, yyyy HH:mm');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const determineTransactionType = (transaction) => {
    if (!transaction) return 'UNKNOWN';
    
    if (transaction.type) return String(transaction.type).toUpperCase();
    if (transaction.transaction_type) return String(transaction.transaction_type).toUpperCase();
    
    // If we have the current user, determine if it's a send or receive
    if (currentUser && currentUser.id) {
      if (transaction.sender_id === currentUser.id) return 'SEND';
      if (transaction.recipient_id === currentUser.id) return 'RECEIVE';
    }
    
    return 'TRANSFER';
  };

  // Safely process transactions to prevent null/undefined errors
  const processTransactions = (data) => {
    if (!Array.isArray(data)) {
      console.warn('Transaction data is not an array:', data);
      return [];
    }
    
    return data.map(transaction => {
      if (!transaction) return null;
      
      // Safely extract values with fallbacks
      const amount = transaction.amount || transaction.source_amount || 0;
      const currency = transaction.currency || transaction.source_currency || 'USD';
      const date = transaction.date || transaction.timestamp || null;
      // Ensure status is not undefined before calling toString()
      const status = transaction.status ? transaction.status.toString() : 'Completed';
      
      return {
        ...transaction,
        formattedAmount: formatCurrency(amount, currency),
        formattedDate: formatDateSafely(date),
        type: determineTransactionType(transaction),
        status: status
      };
    }).filter(Boolean); // Remove any null entries
  };

  useEffect(() => {
    fetchTransactions();
    fetchWallets();
  }, [page, rowsPerPage, filters]);

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching transactions...');
      let transactionsData = [];
      
      // Try to get transactions for the specific user if we have a user ID
      if (currentUser && currentUser.id) {
        try {
          const response = await api.get(`/transaction/user/${currentUser.id}`);
          console.log('User transactions response:', response.data);
          if (Array.isArray(response.data)) {
            transactionsData = response.data;
          } else if (response.data && Array.isArray(response.data.transactions)) {
            transactionsData = response.data.transactions;
          }
        } catch (userTransactionsErr) {
          console.warn('Error fetching user-specific transactions, trying general endpoint:', userTransactionsErr);
        }
      }
      
      // If we couldn't get user-specific transactions or they were empty, try the general endpoint
      if (transactionsData.length === 0) {
        try {
          const allTransactionsResponse = await api.get('/transaction/');
          console.log('All transactions response:', allTransactionsResponse.data);
          if (Array.isArray(allTransactionsResponse.data)) {
            transactionsData = allTransactionsResponse.data;
          } else if (allTransactionsResponse.data && Array.isArray(allTransactionsResponse.data.transactions)) {
            transactionsData = allTransactionsResponse.data.transactions;
          }
        } catch (allTransactionsErr) {
          console.error('Error fetching all transactions:', allTransactionsErr);
          throw allTransactionsErr; // Re-throw to be caught by the outer catch
        }
      }
      
      // Process transaction data with our safe function
      const processedTransactions = processTransactions(transactionsData);
      
      console.log('Processed transactions:', processedTransactions);
      setTransactions(processedTransactions);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchWallets = async () => {
    try {
      console.log('Fetching wallets...');
      let walletsData = [];
      
      // Try to get wallets for the specific user if we have a user ID
      if (currentUser && currentUser.id) {
        try {
          const response = await api.get(`/wallet/${currentUser.id}`);
          console.log('User wallet response:', response.data);
          if (Array.isArray(response.data)) {
            walletsData = response.data;
          } else if (response.data) {
            walletsData = [response.data];
          }
        } catch (error) {
          console.warn('Error fetching user wallets:', error);
          // Try the general endpoint
          const allWalletsResponse = await api.get('/wallet/');
          console.log('All wallets response:', allWalletsResponse.data);
          if (Array.isArray(allWalletsResponse.data)) {
            walletsData = allWalletsResponse.data;
          } else if (allWalletsResponse.data) {
            walletsData = [allWalletsResponse.data];
          }
        }
      }
      
      // Filter out wallets without IDs
      const validWallets = walletsData.filter(wallet => {
        if (!wallet) {
          console.warn('Found null/undefined wallet in data');
          return false;
        }
        if (wallet.id == null) {
          console.warn('Found wallet without ID:', wallet);
          return false;
        }
        return true;
      });
      
      console.log(`Filtered wallets: ${validWallets.length} valid wallets out of ${walletsData.length} total`);
      setWallets(validWallets);
    } catch (err) {
      console.error('Error fetching wallets for filter:', err);
      setWallets([]);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      fetchTransactions();
    }
  };

  const handleFilterMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleFilterMenuClose = () => {
    setAnchorEl(null);
  };

  const handleFilterChange = (name, value) => {
    setFilters({
      ...filters,
      [name]: value
    });
    setPage(0); // Reset to first page when filter changes
  };

  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
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

  const getStatusChip = (status) => {
    // If status is null/undefined, provide a fallback
    if (!status) {
      return <Chip label="Unknown" color="default" size="small" />;
    }
    
    let color = 'default';
    let label = 'Unknown';
    
    try {
      // Safely convert to string and uppercase
      const safeStatus = String(status).toUpperCase();
      
      switch (safeStatus) {
        case 'COMPLETED':
          color = 'success';
          label = status;
          break;
        case 'PENDING':
          color = 'warning';
          label = status;
          break;
        case 'FAILED':
          color = 'error';
          label = status;
          break;
        default:
          color = 'default';
          label = status;
          break;
      }
    } catch (error) {
      console.error('Error processing status chip:', error);
      // Keep default values if error occurs
    }
    
    return <Chip label={label} color={color} size="small" />;
  };

  const getTypeIcon = (type) => {
    // Default icon for null/undefined
    if (!type) {
      return <SwapHoriz fontSize="small" color="primary" />;
    }

    try {
      // Safely convert to string and uppercase for comparison
      const safeType = String(type).toUpperCase();
      
      if (safeType === 'DEPOSIT' || safeType === 'RECEIVE') {
        return <ArrowDownward fontSize="small" color="success" />;
      }
      
      if (safeType === 'WITHDRAWAL' || safeType === 'SEND') {
        return <ArrowUpward fontSize="small" color="error" />;
      }
    } catch (error) {
      console.error('Error processing type icon:', error);
      // Continue to default return if error occurs
    }
    
    // Default for unknown types
    return <SwapHoriz fontSize="small" color="primary" />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      return new Date(dateString).toLocaleDateString('en-US', options);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const getWalletName = (walletId) => {
    // If no wallet ID provided, return a default
    if (walletId == null) return 'Unknown Wallet';
    
    try {
      // Convert wallet ID to string for safer comparison
      const safeWalletId = String(walletId);
      
      // Find wallet with matching ID
      const wallet = wallets.find(w => {
        if (!w) return false;
        if (w.id == null) return false;
        return String(w.id) === safeWalletId;
      });
      
      // Return appropriate name based on wallet data
      if (!wallet) return 'Unknown Wallet';
      if (!wallet.name) return `Wallet #${safeWalletId}`;
      return wallet.name;
    } catch (error) {
      console.error('Error getting wallet name:', error);
      return 'Unknown Wallet';
    }
  };

  const handleStatusFilterChange = (event) => {
    setStatusFilter(event.target.value);
    setPage(0);
  };

  const handleTypeFilterChange = (event) => {
    setTypeFilter(event.target.value);
    setPage(0);
  };

  const handleWalletFilterChange = (event) => {
    setWalletFilter(event.target.value);
    setPage(0);
  };

  const handleSortChange = (field) => {
    const isAsc = sortField === field && sortDirection === 'asc';
    setSortDirection(isAsc ? 'desc' : 'asc');
    setSortField(field);
  };

  // Filter transactions based on search term and filters
  const filteredTransactions = (Array.isArray(transactions) ? transactions : []).filter((transaction) => {
    if (!transaction) return false;
    
    try {
      // Search term filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (transaction.id != null ? String(transaction.id).includes(searchLower) : false) ||
        (transaction.formattedAmount ? transaction.formattedAmount.toLowerCase().includes(searchLower) : false) ||
        (transaction.description ? transaction.description.toLowerCase().includes(searchLower) : false) ||
        (transaction.formattedDate ? transaction.formattedDate.toLowerCase().includes(searchLower) : false) ||
        (transaction.type ? transaction.type.toLowerCase().includes(searchLower) : false);
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || 
        (transaction.status ? transaction.status.toLowerCase() === statusFilter.toLowerCase() : false);
      
      // Type filter
      const matchesType = typeFilter === 'all' || 
        (transaction.type ? transaction.type.toLowerCase() === typeFilter.toLowerCase() : false);
      
      // Wallet filter
      const matchesWallet = walletFilter === 'all' || (() => {
        try {
          // Safe wallet matching that handles missing or malformed data
          if (transaction.from_wallet_id != null) {
            const fromWalletStr = String(transaction.from_wallet_id);
            if (fromWalletStr === walletFilter) return true;
          }
          
          if (transaction.to_wallet_id != null) {
            const toWalletStr = String(transaction.to_wallet_id);
            if (toWalletStr === walletFilter) return true;
          }
          
          if (transaction.source_wallet_id != null) {
            const sourceWalletStr = String(transaction.source_wallet_id);
            if (sourceWalletStr === walletFilter) return true;
          }
          
          if (transaction.recipient_wallet_id != null) {
            const recipientWalletStr = String(transaction.recipient_wallet_id);
            if (recipientWalletStr === walletFilter) return true;
          }
          
          return false;
        } catch (error) {
          console.error('Error filtering by wallet:', error, transaction);
          return false;
        }
      })();
      
      return matchesSearch && matchesStatus && matchesType && matchesWallet;
    } catch (error) {
      console.error('Error filtering transaction:', error, transaction);
      return false;
    }
  });

  // Sort filtered transactions - with additional null checks
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (!a || !b) return 0;
    
    let comparison = 0;
    
    switch (sortField) {
      case 'date':
        const dateA = a.date || a.timestamp || new Date(0);
        const dateB = b.date || b.timestamp || new Date(0);
        comparison = new Date(dateB) - new Date(dateA);
        break;
      case 'amount':
        const amountA = a.amount || a.source_amount || 0;
        const amountB = b.amount || b.source_amount || 0; 
        comparison = amountB - amountA;
        break;
      case 'description':
        const descA = a.description || '';
        const descB = b.description || '';
        comparison = descA.localeCompare(descB);
        break;
      case 'status':
        const statusA = a.status || '';
        const statusB = b.status || '';
        comparison = statusA.localeCompare(statusB);
        break;
      case 'type':
        const typeA = a.type || '';
        const typeB = b.type || '';
        comparison = typeA.localeCompare(typeB);
        break;
      default:
        comparison = 0;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Paginate with null check
  const paginatedTransactions = sortedTransactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Helper function to safely render transaction data
  const renderSafely = (item, defaultValue = '—') => {
    return item != null ? String(item) : defaultValue;
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ width: '100%', mb: 2 }}>
          <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 } }}>
            <Typography
              sx={{ flex: '1 1 100%' }}
              variant="h5"
              component="div"
            >
              Transactions
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TextField
                margin="dense"
                placeholder="Search transactions..."
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={handleSearchChange}
                onKeyPress={handleSearch}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                sx={{ mr: 2, width: '220px' }}
              />
              
              <IconButton onClick={handleFilterMenuOpen}>
                <FilterList />
              </IconButton>
              
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleFilterMenuClose}
                sx={{ mt: 1 }}
              >
                <Box sx={{ px: 2, py: 1, width: 200 }}>
                  <FormControl fullWidth margin="dense" size="small">
                    <InputLabel id="transaction-type-label">Type</InputLabel>
                    <Select
                      labelId="transaction-type-label"
                      value={typeFilter}
                      label="Type"
                      onChange={handleTypeFilterChange}
                    >
                      <MenuItem value="all">All Types</MenuItem>
                      <MenuItem value="SEND">Send</MenuItem>
                      <MenuItem value="RECEIVE">Receive</MenuItem>
                      <MenuItem value="DEPOSIT">Deposit</MenuItem>
                      <MenuItem value="WITHDRAWAL">Withdrawal</MenuItem>
                      <MenuItem value="EXCHANGE">Exchange</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <FormControl fullWidth margin="dense" size="small">
                    <InputLabel id="transaction-date-label">Date Range</InputLabel>
                    <Select
                      labelId="transaction-date-label"
                      value={filters.dateRange}
                      label="Date Range"
                      onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                    >
                      <MenuItem value="all">All Time</MenuItem>
                      <MenuItem value="7days">Last 7 Days</MenuItem>
                      <MenuItem value="30days">Last 30 Days</MenuItem>
                      <MenuItem value="90days">Last 90 Days</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <FormControl fullWidth margin="dense" size="small">
                    <InputLabel id="transaction-status-label">Status</InputLabel>
                    <Select
                      labelId="transaction-status-label"
                      value={statusFilter}
                      label="Status"
                      onChange={handleStatusFilterChange}
                    >
                      <MenuItem value="all">All Statuses</MenuItem>
                      <MenuItem value="COMPLETED">Completed</MenuItem>
                      <MenuItem value="PENDING">Pending</MenuItem>
                      <MenuItem value="FAILED">Failed</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <FormControl fullWidth margin="dense" size="small">
                    <InputLabel id="transaction-wallet-label">Wallet</InputLabel>
                    <Select
                      labelId="transaction-wallet-label"
                      value={walletFilter}
                      label="Wallet"
                      onChange={handleWalletFilterChange}
                    >
                      <MenuItem value="all">All Wallets</MenuItem>
                      {wallets.map((wallet) => {
                        // Skip null or undefined wallets
                        if (!wallet) return null;
                        
                        // Create a safe ID value that won't cause toString() errors
                        const safeId = wallet.id != null ? wallet.id.toString() : `unknown-${Math.random()}`;
                        const safeName = wallet.name || 'Unnamed Wallet';
                        
                        return (
                          <MenuItem key={safeId} value={safeId}>
                            {safeName}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                  
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button 
                      variant="outlined" 
                      size="small"
                      onClick={() => {
                        setFilters({
                          type: 'all',
                          dateRange: 'all',
                          status: 'all',
                          wallet: 'all'
                        });
                        handleFilterMenuClose();
                      }}
                    >
                      Reset
                    </Button>
                    <Button 
                      variant="contained" 
                      size="small" 
                      sx={{ ml: 1 }}
                      onClick={handleFilterMenuClose}
                    >
                      Apply
                    </Button>
                  </Box>
                </Box>
              </Menu>
            </Box>
          </Toolbar>
          
          {copySuccess && (
            <Alert severity="success" sx={{ mx: 2 }}>
              {copySuccess}
            </Alert>
          )}
          
          {error && (
            <Alert severity="error" sx={{ m: 2 }}>
              {error}
            </Alert>
          )}
          
          <TableContainer>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                <CircularProgress />
              </Box>
            ) : transactions.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="h6" color="text.secondary">
                  No transactions found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Try adjusting your filters or make your first transaction
                </Typography>
                <Button 
                  variant="contained" 
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/send')}
                >
                  Send Money
                </Button>
              </Box>
            ) : (
              <Table aria-label="transactions table">
                <TableHead>
                  <TableRow>
                    <TableCell 
                      onClick={() => handleSortChange('date')}
                      style={{ cursor: 'pointer' }}
                    >
                      <Box display="flex" alignItems="center">
                        Date
                        {sortField === 'date' && (
                          <IconButton size="small">
                            {sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell 
                      onClick={() => handleSortChange('type')}
                      style={{ cursor: 'pointer' }}
                    >
                      <Box display="flex" alignItems="center">
                        Type
                        {sortField === 'type' && (
                          <IconButton size="small">
                            {sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell 
                      onClick={() => handleSortChange('description')}
                      style={{ cursor: 'pointer' }}
                    >
                      <Box display="flex" alignItems="center">
                        Description
                        {sortField === 'description' && (
                          <IconButton size="small">
                            {sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell 
                      onClick={() => handleSortChange('amount')}
                      style={{ cursor: 'pointer' }}
                      align="right"
                    >
                      <Box display="flex" alignItems="center" justifyContent="flex-end">
                        Amount
                        {sortField === 'amount' && (
                          <IconButton size="small">
                            {sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell 
                      onClick={() => handleSortChange('status')}
                      style={{ cursor: 'pointer' }}
                      align="right"
                    >
                      <Box display="flex" alignItems="center" justifyContent="flex-end">
                        Status
                        {sortField === 'status' && (
                          <IconButton size="small">
                            {sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.isArray(paginatedTransactions) ? paginatedTransactions.map((transaction) => {
                    // Exit early if transaction is null or undefined
                    if (!transaction) return null;
                    
                    // Create safe versions of all values to prevent any toString() errors
                    const safeId = transaction.id ? String(transaction.id) : `unknown-${Math.random()}`;
                    const safeDate = transaction.formattedDate || 'N/A';
                    const safeType = transaction.type || 'Unknown';
                    const safeDesc = transaction.description || '—';
                    const safeAmount = transaction.formattedAmount || '$0.00';
                    const safeStatus = transaction.status || 'Unknown';
                    
                    return (
                      <TableRow key={safeId} hover>
                        <TableCell>{safeDate}</TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            {getTypeIcon(safeType)}
                            <Typography variant="body2" sx={{ ml: 1 }}>
                              {safeType}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{safeDesc}</TableCell>
                        <TableCell>{safeAmount}</TableCell>
                        <TableCell>{safeStatus ? getStatusChip(safeStatus) : '—'}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleViewDetails(transaction)}>
                            <Info fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Box display="flex" justifyContent="center" p={2}>
                          <Typography variant="body1">No transaction data available</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      </Box>
      
      {/* Transaction Details Dialog */}
      <Dialog open={detailsOpen} onClose={handleCloseDetails} maxWidth="sm" fullWidth>
        {selectedTransaction && (
          <>
            <DialogTitle>
              Transaction Details
              <IconButton
                aria-label="close"
                onClick={handleCloseDetails}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                }}
              >
                <Info />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Box mb={2}>
                <Typography variant="overline" color="text.secondary">
                  Transaction ID
                </Typography>
                <Box display="flex" alignItems="center">
                  <Typography variant="body2" sx={{ mr: 1, wordBreak: 'break-all' }}>
                    {renderSafely(selectedTransaction.id)}
                  </Typography>
                  <IconButton 
                    size="small"
                    onClick={() => copyToClipboard(selectedTransaction.id || '', 'Transaction ID')}
                  >
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="overline" color="text.secondary">
                    Type
                  </Typography>
                  <Typography variant="body1">
                    {renderSafely(selectedTransaction.type)}
                  </Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="overline" color="text.secondary">
                    Status
                  </Typography>
                  <Box>
                    {selectedTransaction.status ? getStatusChip(selectedTransaction.status) : '—'}
                  </Box>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="overline" color="text.secondary">
                    Amount
                  </Typography>
                  <Typography variant="body1">
                    {formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}
                  </Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="overline" color="text.secondary">
                    Fee
                  </Typography>
                  <Typography variant="body1">
                    {formatCurrency(selectedTransaction.fee || 0, selectedTransaction.currency)}
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="overline" color="text.secondary">
                    Date & Time
                  </Typography>
                  <Typography variant="body1">
                    {selectedTransaction.timestamp ? formatDate(selectedTransaction.timestamp) : 'N/A'}
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="overline" color="text.secondary">
                    Source Wallet
                  </Typography>
                  <Typography variant="body1">
                    {getWalletName(selectedTransaction.source_wallet_id)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                    {renderSafely(selectedTransaction.source_wallet_id)}
                  </Typography>
                </Grid>
                
                {selectedTransaction.recipient_address && (
                  <Grid item xs={12}>
                    <Typography variant="overline" color="text.secondary">
                      Recipient Address
                    </Typography>
                    <Box display="flex" alignItems="center">
                      <Typography variant="body2" sx={{ mr: 1, wordBreak: 'break-all' }}>
                        {renderSafely(selectedTransaction.recipient_address)}
                      </Typography>
                      <IconButton 
                        size="small"
                        onClick={() => copyToClipboard(selectedTransaction.recipient_address || '', 'Recipient Address')}
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Box>
                  </Grid>
                )}
                
                {selectedTransaction.description && (
                  <Grid item xs={12}>
                    <Typography variant="overline" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body1">
                      {renderSafely(selectedTransaction.description)}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button 
                startIcon={<Download />}
                onClick={handleCloseDetails}
              >
                Export
              </Button>
              <Button 
                variant="contained" 
                onClick={handleCloseDetails}
              >
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default Transactions; 

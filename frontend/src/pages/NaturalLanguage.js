import React, { useState, useEffect, useRef } from 'react';
import { 
  Container, 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  IconButton,
  Grid,
  Chip,
  CircularProgress,
  Card,
  CardContent,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Snackbar,
  Alert,
  Divider
} from '@mui/material';
import { 
  Send, 
  Chat, 
  ExpandMore, 
  ArrowRightAlt, 
  Refresh,
  Person,
  MoreVert,
  Computer
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const NaturalLanguage = () => {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [agentType, setAgentType] = useState('finance');
  const messagesEndRef = useRef(null);
  
  useEffect(() => {
    // Initial data load
    fetchConversations();
  }, []);
  
  useEffect(() => {
    // Fetch messages when a conversation is selected
    if (selectedConversation) {
      fetchMessages(selectedConversation);
    }
  }, [selectedConversation]);
  
  useEffect(() => {
    // Scroll to bottom when messages change
    scrollToBottom();
  }, [messages]);
  
  const fetchConversations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // In a real app, we would fetch from the server
      // For now use placeholder data or attempt to fetch if endpoint exists
      try {
        const response = await api.get('/ai/conversations');
        setConversations(response.data);
      } catch (err) {
        console.warn('Error fetching conversations (endpoint may not exist yet):', err);
        // Fallback to sample data
        setConversations([
          { id: 1, title: 'Finance help', lastMessageAt: new Date().toISOString() },
          { id: 2, title: 'Payment issue', lastMessageAt: new Date(Date.now() - 86400000).toISOString() }
        ]);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchMessages = async (conversationId) => {
    setLoading(true);
    setError(null);
    
    try {
      // In a real app, we would fetch from the server
      // For now use placeholder data or attempt to fetch if endpoint exists
      try {
        const response = await api.get(`/ai/conversations/${conversationId}/messages`);
        setMessages(response.data);
      } catch (err) {
        console.warn('Error fetching messages (endpoint may not exist yet):', err);
        // Fallback to sample data
        setMessages([
          { id: 1, role: 'assistant', content: 'Hello! How can I help you today?', timestamp: new Date().toISOString() },
          { id: 2, role: 'user', content: 'I need help with my finances', timestamp: new Date().toISOString() }
        ]);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleStartNewConversation = () => {
    setSelectedConversation(null);
    setMessages([{ id: 0, role: 'assistant', content: 'Hello! How can I help you today?', timestamp: new Date().toISOString() }]);
  };
  
  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    
    // Add user message to UI immediately
    const newUserMessage = {
      id: messages.length + 1,
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    
    const tempInput = userInput;
    setUserInput('');
    setLoading(true);
    setError(null);
    
    try {
      // Prepare request payload
      const requestPayload = {
        user_id: currentUser?.id || 'anonymous',
        agent_type: agentType,
        message: tempInput,
        conversation_id: selectedConversation
      };
      
      console.log('Sending message:', requestPayload);
      
      // In a real app, we would send to the server
      let responseData = null;
      
      try {
        // Try to use the API if it exists
        const response = await api.post('/ai/message', requestPayload);
        responseData = response.data;
      } catch (apiErr) {
        console.warn('Error sending message to API (endpoint may not exist yet):', apiErr);
        
        // Fallback to mock response
        responseData = {
          message: {
            id: messages.length + 2,
            role: 'assistant',
            content: getSimulatedResponse(tempInput, agentType),
            timestamp: new Date().toISOString()
          },
          conversation_id: selectedConversation || Date.now()
        };
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Update the conversation ID if this is a new conversation
      if (!selectedConversation) {
        setSelectedConversation(responseData.conversation_id);
        
        // Add the new conversation to the list
        setConversations(prev => [
          {
            id: responseData.conversation_id,
            title: tempInput.substring(0, 30) + (tempInput.length > 30 ? '...' : ''),
            lastMessageAt: new Date().toISOString()
          },
          ...prev
        ]);
      }
      
      // Add the assistant's response to the messages
      setMessages(prev => [...prev, responseData.message]);
      
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const getSuggestions = () => {
    switch (agentType) {
      case 'finance':
        return [
          'How do I transfer money between wallets?',
          'What\'s the best way to save on transaction fees?',
          'Can you explain stablecoins to me?',
        ];
      case 'payments':
        return [
          'I want to send USD to someone with a EUR wallet',
          'How do I set up recurring payments?',
          'What\'s the status of my last transaction?',
        ];
      default:
        return [
          'Help me understand how this platform works',
          'What can you help me with?',
          'Show me my account summary',
        ];
    }
  };
  
  const handleSuggestionClick = (suggestion) => {
    setUserInput(suggestion);
  };
  
  // Function to simulate AI responses for demo purposes
  const getSimulatedResponse = (message, type) => {
    const normalizedMessage = message.toLowerCase();
    
    if (normalizedMessage.includes('hello') || normalizedMessage.includes('hi')) {
      return `Hello there! I'm your ${type} assistant. How can I help you today?`;
    }
    
    if (normalizedMessage.includes('transfer') || normalizedMessage.includes('send money')) {
      return 'To transfer money, go to the Send Money page from the dashboard. You\'ll need to select a source wallet, enter the recipient\'s details, and confirm the amount and currency.';
    }
    
    if (normalizedMessage.includes('fee') || normalizedMessage.includes('transaction fee')) {
      return 'Transaction fees vary based on the currencies and amount. TerraFlow uses stablecoins as an intermediary for cross-currency transfers, which helps reduce costs. Large transfers are usually more cost-effective.';
    }
    
    if (normalizedMessage.includes('stablecoin')) {
      return 'Stablecoins are cryptocurrencies designed to maintain a stable value, usually pegged to a fiat currency like USD. TerraFlow uses stablecoins as an intermediary for cross-currency transfers, which reduces volatility risks during the transfer process.';
    }
    
    if (normalizedMessage.includes('wallet')) {
      return 'Your wallets can be managed in the Wallets section. You can create multiple wallets in different currencies, view balances, and see transaction history for each wallet.';
    }
    
    if (normalizedMessage.includes('usd') && normalizedMessage.includes('eur')) {
      return 'To send USD to someone with a EUR wallet, you can use the Send Money feature. The system will automatically handle the currency conversion using USDT as an intermediary. Current exchange rates will be displayed before you confirm the transaction.';
    }
    
    return 'I understand you\'re asking about ' + message + '. While I\'m still learning, I can help with basic questions about transfers, wallets, and transactions. Can you provide more details about what you need help with?';
  };
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Natural Language Interface
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Chat with our AI assistant to manage your finances, make payments, or get help with TerraFlow.
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}
        
        <Grid container spacing={3}>
          {/* Conversations sidebar */}
          <Grid item xs={12} md={3}>
            <Card variant="outlined" sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Button 
                  fullWidth 
                  variant="contained" 
                  startIcon={<Chat />}
                  onClick={handleStartNewConversation}
                >
                  New Chat
                </Button>
              </Box>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <FormControl component="fieldset">
                  <Typography variant="subtitle2" gutterBottom>
                    Assistant Type
                  </Typography>
                  <RadioGroup 
                    value={agentType} 
                    onChange={(e) => setAgentType(e.target.value)}
                    row
                  >
                    <FormControlLabel value="finance" control={<Radio size="small" />} label="Finance" />
                    <FormControlLabel value="payments" control={<Radio size="small" />} label="Payments" />
                    <FormControlLabel value="general" control={<Radio size="small" />} label="General" />
                  </RadioGroup>
                </FormControl>
              </Box>
              <Box sx={{ overflowY: 'auto', flexGrow: 1, p: 1 }}>
                {conversations.length === 0 ? (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No conversations yet. Start a new chat!
                    </Typography>
                  </Box>
                ) : (
                  conversations.map((conversation) => (
                    <Box 
                      key={conversation.id}
                      sx={{ 
                        p: 2, 
                        mb: 1, 
                        borderRadius: 1,
                        cursor: 'pointer',
                        bgcolor: selectedConversation === conversation.id ? 'action.selected' : 'background.paper',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                      onClick={() => setSelectedConversation(conversation.id)}
                    >
                      <Typography variant="subtitle2" noWrap>
                        {conversation.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(conversation.lastMessageAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>
            </Card>
          </Grid>
          
          {/* Chat area */}
          <Grid item xs={12} md={9}>
            <Card variant="outlined" sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
              {/* Messages area */}
              <Box sx={{ 
                p: 3, 
                overflowY: 'auto', 
                flexGrow: 1, 
                display: 'flex', 
                flexDirection: 'column',
                gap: 2 
              }}>
                {messages.length === 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Chat sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      No Conversation Selected
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center">
                      Select an existing conversation from the sidebar or start a new chat to begin.
                    </Typography>
                    <Button 
                      variant="contained" 
                      startIcon={<Chat />} 
                      sx={{ mt: 2 }}
                      onClick={handleStartNewConversation}
                    >
                      Start New Chat
                    </Button>
                  </Box>
                ) : (
                  messages.map((message) => (
                    <Box 
                      key={message.id}
                      sx={{
                        display: 'flex',
                        justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                        mb: 2
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: '70%',
                          p: 2,
                          borderRadius: 2,
                          bgcolor: message.role === 'user' ? 'primary.main' : 'grey.100',
                          color: message.role === 'user' ? 'white' : 'text.primary',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          {message.role === 'user' ? 
                            <Person fontSize="small" /> : 
                            <Computer fontSize="small" />
                          }
                          <Typography variant="caption" sx={{ ml: 1 }}>
                            {message.role === 'user' ? 'You' : 'Assistant'} • {formatTimestamp(message.timestamp)}
                          </Typography>
                        </Box>
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                          {message.content}
                        </Typography>
                      </Box>
                    </Box>
                  ))
                )}
                <div ref={messagesEndRef} />
                
                {/* Suggested queries */}
                {messages.length > 0 && !loading && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Suggested queries:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {getSuggestions().map((suggestion, index) => (
                        <Chip 
                          key={index}
                          label={suggestion}
                          variant="outlined"
                          size="small"
                          onClick={() => handleSuggestionClick(suggestion)}
                          clickable
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
              
              {/* Input area */}
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FormControl fullWidth variant="outlined" error={Boolean(error)}>
                    <TextField
                      placeholder="Type your message..."
                      multiline
                      maxRows={4}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      variant="outlined"
                      InputProps={{
                        endAdornment: (
                          <IconButton 
                            color="primary" 
                            onClick={handleSendMessage}
                            disabled={loading || !userInput.trim()}
                          >
                            {loading ? <CircularProgress size={24} /> : <Send />}
                          </IconButton>
                        ),
                      }}
                    />
                  </FormControl>
                </Box>
              </Box>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default NaturalLanguage; 
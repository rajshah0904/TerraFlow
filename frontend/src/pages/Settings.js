import React, { useState } from 'react';
import { 
  Container, 
  Typography, 
  Paper, 
  Divider, 
  Box, 
  TextField, 
  Button, 
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  Stack
} from '@mui/material';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
  const { currentUser } = useAuth();
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [notification, setNotification] = useState({
    emailNotifications: true,
    appNotifications: true
  });
  const [message, setMessage] = useState(null);

  const handlePasswordChange = (e) => {
    setPasswordForm({
      ...passwordForm,
      [e.target.name]: e.target.value
    });
  };

  const handleNotificationChange = (e) => {
    setNotification({
      ...notification,
      [e.target.name]: e.target.checked
    });
  };

  const submitPasswordChange = (e) => {
    e.preventDefault();
    
    // Password validation
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({
        type: 'error',
        text: 'New passwords do not match'
      });
      return;
    }
    
    if (passwordForm.newPassword.length < 8) {
      setMessage({
        type: 'error',
        text: 'Password must be at least 8 characters'
      });
      return;
    }
    
    // TODO: API call to change password

    setMessage({
      type: 'success',
      text: 'Password updated successfully'
    });
    
    // Reset form
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  const saveNotificationSettings = () => {
    // TODO: API call to save notification settings
    setMessage({
      type: 'success',
      text: 'Notification settings saved'
    });
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" component="h1" gutterBottom>
        Account Settings
      </Typography>
      
      {message && (
        <Alert 
          severity={message.type} 
          sx={{ mb: 3 }}
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Profile Information
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Username"
              value={currentUser?.username || ''}
              disabled
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email"
              value={currentUser?.email || ''}
              disabled
            />
          </Grid>
        </Grid>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Change Password
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        <form onSubmit={submitPasswordChange}>
          <Stack spacing={3}>
            <TextField
              fullWidth
              type="password"
              label="Current Password"
              name="currentPassword"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              required
            />
            <TextField
              fullWidth
              type="password"
              label="New Password"
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              required
            />
            <TextField
              fullWidth
              type="password"
              label="Confirm New Password"
              name="confirmPassword"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
              required
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="contained">
                Update Password
              </Button>
            </Box>
          </Stack>
        </form>
      </Paper>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Notification Settings
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        <FormControlLabel
          control={
            <Switch
              name="emailNotifications"
              checked={notification.emailNotifications}
              onChange={handleNotificationChange}
            />
          }
          label="Email Notifications"
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
          Receive notifications about transactions and account activity via email
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              name="appNotifications"
              checked={notification.appNotifications}
              onChange={handleNotificationChange}
            />
          }
          label="In-App Notifications"
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 3 }}>
          Receive push notifications within the app
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={saveNotificationSettings}>
            Save Notification Settings
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default Settings; 
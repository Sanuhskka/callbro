import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
} from '@mui/material';
import { Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface LoginFormProps {
  onSwitchToRegister?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { login, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (error) {
      clearError();
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await login(formData.username, formData.password);
      // Don't reload - let React Router handle navigation automatically
      // The AppRoutes component will redirect to '/' when isAuthenticated becomes true
    } catch (error) {
      // Error is handled by the auth context
      console.error('Login failed:', error);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 1, sm: 2 },
        }}
      >
        <Card
          sx={{
            width: '100%',
            maxWidth: 400,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
            <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 4 } }}>
              <Phone size={48} />
              <Typography 
                variant="h4" 
                component="h1" 
                sx={{ 
                  mt: 2, 
                  fontWeight: 'bold',
                  fontSize: { xs: '1.5rem', sm: '2rem' },
                }}
              >
                Secure P2P Messenger
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  mt: 1,
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                }}
              >
                End-to-end encrypted communication
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={clearError}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                error={!!errors.username}
                helperText={errors.username}
                disabled={isLoading}
                margin="normal"
                variant="outlined"
                autoComplete="username"
                autoFocus
              />

              <TextField
                fullWidth
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                error={!!errors.password}
                helperText={errors.password}
                disabled={isLoading}
                margin="normal"
                variant="outlined"
                autoComplete="current-password"
                InputProps={{
                  endAdornment: (
                    <Button
                      onClick={togglePasswordVisibility}
                      disabled={isLoading}
                      sx={{ minWidth: 'auto', p: 1 }}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </Button>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading}
                sx={{ mt: 3, mb: 2, py: 1.5 }}
              >
                {isLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  style={{
                    color: '#1976d2',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                  }}
                >
                  Sign up
                </Link>
              </Typography>
            </Box>

            <Box sx={{ mt: { xs: 3, sm: 4 }, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ 
                  display: 'block', 
                  mb: 1,
                  fontSize: { xs: '0.65rem', sm: '0.75rem' },
                }}
              >
                🔐 Your messages are encrypted end-to-end
              </Typography>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ 
                  display: 'block', 
                  mb: 1,
                  fontSize: { xs: '0.65rem', sm: '0.75rem' },
                }}
              >
                🔑 Private keys never leave your device
              </Typography>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ 
                  display: 'block',
                  fontSize: { xs: '0.65rem', sm: '0.75rem' },
                }}
              >
                🌐 P2P calls without server interference
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default LoginForm;

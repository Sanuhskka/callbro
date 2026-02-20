import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useTheme } from '@mui/system';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Eye,
  EyeOff,
  User,
  Lock,
  Check,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const RegisterEnhanced: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    
    if (error) setError('');
    
    // Calculate password strength
    if (name === 'password') {
      const strength = calculatePasswordStrength(value);
      setPasswordStrength(strength);
    }
  };

  const calculatePasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 12.5;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 12.5;
    return Math.min(strength, 100);
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 30) return 'error';
    if (passwordStrength < 60) return 'warning';
    if (passwordStrength < 80) return 'info';
    return 'success';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 30) return 'Слабый';
    if (passwordStrength < 60) return 'Средний';
    if (passwordStrength < 80) return 'Хороший';
    return 'Отличный';
  };

  const validateForm = (): string => {
    if (!formData.username.trim()) return 'Введите имя пользователя';
    if (formData.username.length < 3) return 'Имя пользователя должно содержать минимум 3 символа';
    if (!formData.email.trim()) return 'Введите email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'Введите корректный email';
    if (!formData.password.trim()) return 'Введите пароль';
    if (formData.password.length < 8) return 'Пароль должен содержать минимум 8 символов';
    if (formData.password !== formData.confirmPassword) return 'Пароли не совпадают';
    if (!agreed) return 'Примите условия использования';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      await register(formData.username, formData.password);
      navigate('/chat');
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        p: 2,
      }}
    >
      <Paper
        elevation={isMobile ? 0 : 24}
        sx={{
          p: { xs: 3, sm: 4 },
          width: { xs: '100%', sm: 500 },
          maxWidth: 500,
          borderRadius: { xs: 0, sm: 3 },
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              mb: 2,
            }}
          >
            <Lock size={32} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
            Создать аккаунт
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Присоединяйтесь к безопасному мессенджеру
          </Typography>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Form */}
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Имя пользователя"
            name="username"
            value={formData.username}
            onChange={handleChange}
            margin="normal"
            variant="outlined"
            disabled={loading}
            InputProps={{
              startAdornment: (
                <Box sx={{ mr: 1, color: '#666', display: 'flex' }}>
                  <User size={20} />
                </Box>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />

          <TextField
            fullWidth
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            margin="normal"
            variant="outlined"
            disabled={loading}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />

          <TextField
            fullWidth
            label="Пароль"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={handleChange}
            margin="normal"
            variant="outlined"
            disabled={loading}
            InputProps={{
              startAdornment: (
                <Box sx={{ mr: 1, color: '#666', display: 'flex' }}>
                  <Lock size={20} />
                </Box>
              ),
              endAdornment: (
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </IconButton>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />

          {/* Password Strength Indicator */}
          {formData.password && (
            <Box sx={{ mt: 1, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Надежность пароля
                </Typography>
                <Typography variant="caption" color={getPasswordStrengthColor()}>
                  {getPasswordStrengthText()}
                </Typography>
              </Box>
              <Box
                sx={{
                  height: 4,
                  bgcolor: 'grey.200',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${passwordStrength}%`,
                    bgcolor: getPasswordStrengthColor(),
                    transition: 'all 0.3s ease',
                  }}
                />
              </Box>
            </Box>
          )}

          <TextField
            fullWidth
            label="Подтвердите пароль"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={handleChange}
            margin="normal"
            variant="outlined"
            disabled={loading}
            InputProps={{
              startAdornment: (
                <Box sx={{ mr: 1, color: '#666', display: 'flex' }}>
                  <Lock size={20} />
                </Box>
              ),
              endAdornment: (
                <IconButton
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  edge="end"
                  disabled={loading}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </IconButton>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={agreed}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgreed(e.target.checked)}
                disabled={loading}
              />
            }
            label={
              <Typography variant="body2">
                Я согласен с{' '}
                <Link to="/terms" style={{ color: theme.palette.primary.main }}>
                  условиями использования
                </Link>{' '}
                и{' '}
                <Link to="/privacy" style={{ color: theme.palette.primary.main }}>
                  политикой конфиденциальности
                </Link>
              </Typography>
            }
            sx={{ mt: 2, mb: 3 }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '1.1rem',
              fontWeight: 600,
            }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Создать аккаунт
              </Box>
            )}
          </Button>
        </Box>

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Уже есть аккаунт?{' '}
            <Link
              to="/login"
              style={{
                color: theme.palette.primary.main,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Войти
            </Link>
          </Typography>
        </Box>

        {/* Security Features */}
        <Box
          sx={{
            mt: 3,
            p: 2,
            bgcolor: 'grey.50',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'grey.200',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Lock size={14} />
              Безопасность и приватность
            </Box>
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ color: 'success.main', display: 'flex' }}>
                <Check size={12} />
              </Box>
              End-to-end шифрование
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ color: 'success.main', display: 'flex' }}>
                <Check size={12} />
              </Box>
              Никаких сторонних серверов
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ color: 'success.main', display: 'flex' }}>
                <Check size={12} />
              </Box>
              P2P соединения
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default RegisterEnhanced;

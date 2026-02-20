import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import { WebRTCProvider } from './contexts/WebRTCContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { CryptoProvider } from './contexts/CryptoContext';

// Enhanced Components
import { LoginEnhanced } from './components/Enhanced';
import { RegisterEnhanced } from './components/Enhanced';
import { ChatLayoutEnhanced } from './components/Enhanced';
import { ChatWindowEnhanced } from './components/Enhanced';
import { CallWindowEnhanced } from './components/Enhanced';

// Original Components (fallbacks)
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ChatLayout from './components/Chat/ChatLayout';
import ChatWindow from './components/Chat/ChatWindow';
import CallWindow from './components/Call/CallWindow';

// Import global styles
import './styles/global.css';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#f06292',
      dark: '#b71c1c',
    },
    background: {
      default: '#121212',
      paper: '#272727',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Oxygen"',
      'Ubuntu',
      'Cantarell',
      '"Fira Sans"',
      '"Droid Sans"',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
  },
});

const AppEnhanced: React.FC = () => {
  // Use enhanced components when available, fallback to originals
  const LoginComponent = LoginEnhanced || Login;
  const RegisterComponent = RegisterEnhanced || Register;
  const ChatLayoutComponent = ChatLayoutEnhanced || ChatLayout;
  const ChatWindowComponent = ChatWindowEnhanced || ChatWindow;
  const CallWindowComponent = CallWindowEnhanced || CallWindow;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <CryptoProvider>
        <NotificationProvider>
          <WebRTCProvider>
            <AuthProvider>
              <Router>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<LoginComponent />} />
                  <Route path="/register" element={<RegisterComponent />} />
                  
                  {/* Protected Routes */}
                  <Route path="/chat" element={<ChatLayoutComponent />}>
                    <Route index element={<Navigate to="/chat/contacts" replace />} />
                    <Route path="contacts" element={<div>Contacts List</div>} />
                    <Route path=":userId" element={<ChatWindowComponent />} />
                  </Route>
                  
                  {/* Call Routes */}
                  <Route path="/call/:userId" element={<CallWindowComponent />} />
                  
                  {/* Default Route */}
                  <Route path="/" element={<Navigate to="/chat" replace />} />
                  
                  {/* Catch all */}
                  <Route path="*" element={<Navigate to="/chat" replace />} />
                </Routes>
              </Router>
            </AuthProvider>
          </WebRTCProvider>
        </NotificationProvider>
      </CryptoProvider>
    </ThemeProvider>
  );
};

export default AppEnhanced;

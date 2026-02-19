import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ChatWindow from '../ChatWindow';
import { AuthContext } from '../../../contexts/AuthContext';

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const mockUser = {
  id: 'user1',
  username: 'testuser',
  publicKey: 'mock-public-key',
  createdAt: new Date().toISOString(),
};

const mockAuthContext = {
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  clearError: jest.fn(),
};

// Mock the services
jest.mock('../../../services/MessagingService', () => ({
  MessagingService: jest.fn().mockImplementation(() => ({
    getMessageHistory: jest.fn().mockResolvedValue({
      messages: [],
      hasMore: false,
      total: 0,
    }),
    sendTextMessage: jest.fn(),
    sendMediaFile: jest.fn(),
  })),
}));

jest.mock('../../../services/CryptoService', () => ({
  CryptoService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../services/AuthService', () => ({
  AuthService: jest.fn().mockImplementation(() => ({})),
}));

describe('ChatWindow Component', () => {
  const renderChatWindow = (userId?: string) => {
    const path = userId ? `/chat/${userId}` : '/chat';
    window.history.pushState({}, 'Test page', path);

    return render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <AuthContext.Provider value={mockAuthContext}>
            <ChatWindow />
          </AuthContext.Provider>
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  it('should render empty state when no contact is selected', () => {
    renderChatWindow();
    expect(screen.getByText(/select a contact to start chatting/i)).toBeInTheDocument();
  });

  it('should render chat interface when contact is selected', async () => {
    renderChatWindow('user2');

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
    });
  });

  it('should display message input field', async () => {
    renderChatWindow('user2');

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/type a message/i);
      expect(input).toBeInTheDocument();
      expect(input).not.toBeDisabled();
    });
  });

  it('should display send button', async () => {
    renderChatWindow('user2');

    await waitFor(() => {
      const sendButtons = screen.getAllByRole('button');
      expect(sendButtons.length).toBeGreaterThan(0);
    });
  });

  it('should display file attachment button', async () => {
    renderChatWindow('user2');

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it('should show no messages text when chat is empty', async () => {
    renderChatWindow('user2');

    await waitFor(() => {
      expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
    });
  });
});

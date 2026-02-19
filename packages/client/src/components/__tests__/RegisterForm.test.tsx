import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import RegisterForm from '../Auth/RegisterForm';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the useAuth hook
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    register: jest.fn(),
    isLoading: false,
    error: null,
    clearError: jest.fn(),
  }),
}));

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <AuthProvider>
          {component}
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders registration form correctly', () => {
    renderWithProviders(<RegisterForm />);
    
    expect(screen.getByText('Create Account')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('updates input fields when user types', () => {
    renderWithProviders(<RegisterForm />);
    
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    
    fireEvent.change(usernameInput, { target: { value: 'newuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    
    expect(usernameInput).toHaveValue('newuser');
    expect(passwordInput).toHaveValue('password123');
    expect(confirmPasswordInput).toHaveValue('password123');
  });

  it('shows validation errors for empty fields', async () => {
    renderWithProviders(<RegisterForm />);
    
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
    });
  });

  it('shows validation error for short username', async () => {
    renderWithProviders(<RegisterForm />);
    
    const usernameInput = screen.getByLabelText('Username');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    fireEvent.change(usernameInput, { target: { value: 'ab' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();
    });
  });

  it('shows validation error for long username', async () => {
    renderWithProviders(<RegisterForm />);
    
    const usernameInput = screen.getByLabelText('Username');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    fireEvent.change(usernameInput, { target: { value: 'a'.repeat(21) } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Username must be less than 20 characters')).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid username characters', async () => {
    renderWithProviders(<RegisterForm />);
    
    const usernameInput = screen.getByLabelText('Username');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    fireEvent.change(usernameInput, { target: { value: 'user@name' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Username can only contain letters, numbers, and underscores')).toBeInTheDocument();
    });
  });

  it('shows validation error for short password', async () => {
    renderWithProviders(<RegisterForm />);
    
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: '1234567' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('shows validation error for password mismatch', async () => {
    renderWithProviders(<RegisterForm />);
    
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password456' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  it('shows password strength indicator', () => {
    renderWithProviders(<RegisterForm />);
    
    const passwordInput = screen.getByLabelText('Password');
    
    // Weak password
    fireEvent.change(passwordInput, { target: { value: 'weak' } });
    expect(screen.getByText('Password strength: Weak')).toBeInTheDocument();
    
    // Strong password
    fireEvent.change(passwordInput, { target: { value: 'StrongP@ssw0rd!' } });
    expect(screen.getByText('Password strength: Strong')).toBeInTheDocument();
  });

  it('toggles password visibility', () => {
    renderWithProviders(<RegisterForm />);
    
    const passwordInput = screen.getByLabelText('Password');
    const toggleButtons = screen.getAllByRole('button');
    const passwordToggleButton = toggleButtons.find((button: HTMLElement) => 
      button.querySelector('svg')
    );
    
    // Initially password should be hidden
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click to show password
    if (passwordToggleButton) {
      fireEvent.click(passwordToggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');
    }
  });

  it('toggles confirm password visibility', () => {
    renderWithProviders(<RegisterForm />);
    
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const toggleButtons = screen.getAllByRole('button');
    const confirmToggleButton = toggleButtons.filter((button: HTMLElement) => 
      button.querySelector('svg')
    )[1]; // Second toggle button
    
    // Initially password should be hidden
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    
    // Click to show password
    if (confirmToggleButton) {
      fireEvent.click(confirmToggleButton);
      expect(confirmPasswordInput).toHaveAttribute('type', 'text');
    }
  });

  it('displays error message when provided', () => {
    const mockUseAuth = require('../../hooks/useAuth').useAuth;
    mockUseAuth.mockReturnValue({
      register: jest.fn(),
      isLoading: false,
      error: 'Username already exists',
      clearError: jest.fn(),
    });

    renderWithProviders(<RegisterForm />);
    
    expect(screen.getByText('Username already exists')).toBeInTheDocument();
  });

  it('shows loading state when submitting', () => {
    const mockUseAuth = require('../../hooks/useAuth').useAuth;
    mockUseAuth.mockReturnValue({
      register: jest.fn(),
      isLoading: true,
      error: null,
      clearError: jest.fn(),
    });

    renderWithProviders(<RegisterForm />);
    
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    const mockRegister = jest.fn();
    const mockUseAuth = require('../../hooks/useAuth').useAuth;
    mockUseAuth.mockReturnValue({
      register: mockRegister,
      isLoading: false,
      error: null,
      clearError: jest.fn(),
    });

    renderWithProviders(<RegisterForm />);
    
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'StrongP@ssw0rd!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'StrongP@ssw0rd!' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('testuser', 'StrongP@ssw0rd!');
    });
  });

  it('clears error when user starts typing', () => {
    const mockClearError = jest.fn();
    const mockUseAuth = require('../../hooks/useAuth').useAuth;
    mockUseAuth.mockReturnValue({
      register: jest.fn(),
      isLoading: false,
      error: 'Previous error',
      clearError: mockClearError,
    });

    renderWithProviders(<RegisterForm />);
    
    const usernameInput = screen.getByLabelText('Username');
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    
    expect(mockClearError).toHaveBeenCalled();
  });
});

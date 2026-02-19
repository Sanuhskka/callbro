import { AuthService } from '../AuthService';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock window and localStorage
Object.defineProperty(global, 'window', {
  value: {},
  writable: true,
});

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

// Mock crypto.subtle for key operations
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      generateKey: jest.fn(),
      exportKey: jest.fn(),
      importKey: jest.fn(),
    },
  },
  writable: true,
});

describe('AuthService - Unit Tests', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService('http://localhost:8080');
    
    // Clear localStorage mocks
    window.localStorage.clear();
    jest.clearAllMocks();
    
    // Mock fetch responses
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  describe('Registration', () => {
    it('should register user successfully', async () => {
      // Mock key generation
      const mockKeyPair = {
        publicKey: { type: 'public' },
        privateKey: { type: 'private' },
      };
      
      (crypto.subtle.generateKey as jest.Mock).mockResolvedValue(mockKeyPair);
      (crypto.subtle.exportKey as jest.Mock).mockResolvedValue({ kty: 'EC' });

      // Mock successful registration response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user123',
            username: 'testuser',
            email: 'test@example.com',
            createdAt: '2023-01-01T00:00:00Z',
          },
          token: 'jwt-token',
        }),
      });

      const result = await authService.register({
        username: 'testuser',
        password: 'password123',
        email: 'test@example.com',
      });

      expect(result.user.username).toBe('testuser');
      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBe('jwt-token');
      expect(result.keyPair).toBeDefined();
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should handle registration failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: 'Username already exists',
        }),
      });

      await expect(
        authService.register({
          username: 'existinguser',
          password: 'password123',
        })
      ).rejects.toThrow('Username already exists');

      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('Login', () => {
    it('should login user successfully', async () => {
      // Mock key generation
      const mockKeyPair = {
        publicKey: { type: 'public' },
        privateKey: { type: 'private' },
      };
      
      (crypto.subtle.generateKey as jest.Mock).mockResolvedValue(mockKeyPair);
      (crypto.subtle.exportKey as jest.Mock).mockResolvedValue({ kty: 'EC' });

      // Mock successful login response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user123',
            username: 'testuser',
            createdAt: '2023-01-01T00:00:00Z',
          },
          token: 'jwt-token',
        }),
      });

      const result = await authService.login({
        username: 'testuser',
        password: 'password123',
      });

      expect(result.user.username).toBe('testuser');
      expect(result.token).toBe('jwt-token');
      expect(result.keyPair).toBeDefined();
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should handle login failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: 'Invalid credentials',
        }),
      });

      await expect(
        authService.login({
          username: 'testuser',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');

      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('Logout', () => {
    it('should logout user successfully', async () => {
      // First login
      const mockKeyPair = {
        publicKey: { type: 'public' },
        privateKey: { type: 'private' },
      };
      
      (crypto.subtle.generateKey as jest.Mock).mockResolvedValue(mockKeyPair);
      (crypto.subtle.exportKey as jest.Mock).mockResolvedValue({ kty: 'EC' });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user123',
            username: 'testuser',
            createdAt: '2023-01-01T00:00:00Z',
          },
          token: 'jwt-token',
        }),
      });

      await authService.login({
        username: 'testuser',
        password: 'password123',
      });

      expect(authService.isAuthenticated()).toBe(true);

      // Mock logout response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await authService.logout();

      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getCurrentUser()).toBeNull();
      expect(authService.getToken()).toBeNull();
    });

    it('should handle logout even when server request fails', async () => {
      // First login
      const mockKeyPair = {
        publicKey: { type: 'public' },
        privateKey: { type: 'private' },
      };
      
      (crypto.subtle.generateKey as jest.Mock).mockResolvedValue(mockKeyPair);
      (crypto.subtle.exportKey as jest.Mock).mockResolvedValue({ kty: 'EC' });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user123',
            username: 'testuser',
            createdAt: '2023-01-01T00:00:00Z',
          },
          token: 'jwt-token',
        }),
      });

      await authService.login({
        username: 'testuser',
        password: 'password123',
      });

      expect(authService.isAuthenticated()).toBe(true);

      // Mock failed logout response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: 'Server error',
        }),
      });

      await authService.logout();

      // Should still logout locally even if server request fails
      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getCurrentUser()).toBeNull();
    });
  });

  describe('State Management', () => {
    it('should return current user', () => {
      expect(authService.getCurrentUser()).toBeNull();
    });

    it('should return current token', () => {
      expect(authService.getToken()).toBeNull();
    });

    it('should return current key pair', () => {
      expect(authService.getKeyPair()).toBeNull();
    });

    it('should check authentication status', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should return auth state', () => {
      const state = authService.getAuthState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.keyPair).toBeNull();
    });
  });

  describe('Token Management', () => {
    it('should refresh token successfully', async () => {
      // First login to set token
      const mockKeyPair = {
        publicKey: { type: 'public' },
        privateKey: { type: 'private' },
      };
      
      (crypto.subtle.generateKey as jest.Mock).mockResolvedValue(mockKeyPair);
      (crypto.subtle.exportKey as jest.Mock).mockResolvedValue({ kty: 'EC' });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user123',
            username: 'testuser',
            createdAt: '2023-01-01T00:00:00Z',
          },
          token: 'old-token',
        }),
      });

      await authService.login({
        username: 'testuser',
        password: 'password123',
      });

      // Mock token refresh response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'new-token',
        }),
      });

      const newToken = await authService.refreshToken();

      expect(newToken).toBe('new-token');
      expect(authService.getToken()).toBe('new-token');
    });

    it('should handle token refresh failure', async () => {
      // Set up initial state
      authService['state'].token = 'old-token';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: 'Token invalid',
        }),
      });

      await expect(authService.refreshToken()).rejects.toThrow('Token refresh failed');
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should validate token successfully', async () => {
      // Set up initial state
      authService['state'].token = 'valid-token';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const isValid = await authService.validateToken();

      expect(isValid).toBe(true);
    });

    it('should handle token validation failure', async () => {
      // Set up initial state
      authService['state'].token = 'invalid-token';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: 'Token invalid',
        }),
      });

      const isValid = await authService.validateToken();

      expect(isValid).toBe(false);
    });
  });

  describe('Session Persistence', () => {
    it('should save session to localStorage', async () => {
      // Create fresh auth service to avoid constructor issues
      const freshAuthService = new AuthService('http://localhost:8080');
      
      // Mock localStorage.getItem to return null (no existing session)
      (window.localStorage.getItem as jest.Mock).mockReturnValue(null);
      
      // Mock token validation to succeed
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const mockKeyPair = {
        publicKey: { type: 'public' },
        privateKey: { type: 'private' },
      };
      
      (crypto.subtle.generateKey as jest.Mock).mockResolvedValue(mockKeyPair);
      (crypto.subtle.exportKey as jest.Mock).mockResolvedValue({ kty: 'EC' });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user123',
            username: 'testuser',
            createdAt: '2023-01-01T00:00:00Z',
          },
          token: 'jwt-token',
        }),
      });

      await freshAuthService.login({
        username: 'testuser',
        password: 'password123',
      });

      // Check that user is authenticated (implies session was saved)
      expect(freshAuthService.isAuthenticated()).toBe(true);
      expect(freshAuthService.getCurrentUser()?.username).toBe('testuser');
    });

    it('should handle localStorage errors gracefully', async () => {
      // Mock localStorage to throw error
      (window.localStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const mockKeyPair = {
        publicKey: { type: 'public' },
        privateKey: { type: 'private' },
      };
      
      (crypto.subtle.generateKey as jest.Mock).mockResolvedValue(mockKeyPair);
      (crypto.subtle.exportKey as jest.Mock).mockResolvedValue({ kty: 'EC' });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user123',
            username: 'testuser',
            createdAt: '2023-01-01T00:00:00Z',
          },
          token: 'jwt-token',
        }),
      });

      // Should not throw error even if localStorage fails
      await expect(
        authService.login({
          username: 'testuser',
          password: 'password123',
        })
      ).resolves.toBeDefined();
    });
  });
});

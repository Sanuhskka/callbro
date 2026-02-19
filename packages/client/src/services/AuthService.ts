import { CryptoService, KeyPair } from './CryptoService';

/**
 * AuthService - Модуль аутентификации клиента
 * 
 * Управляет:
 * - Регистрацией пользователей с генерацией ключевой пары
 * - Входом и выходом из системы
 * - Хранением JWT токенов и приватных ключей
 * - Сессиями пользователей
 */

export interface User {
  id: string;
  username: string;
  email?: string;
  publicKey?: string;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  keyPair: KeyPair;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  keyPair: KeyPair | null;
}

export class AuthService {
  private cryptoService: CryptoService;
  private serverUrl: string;
  private state: AuthState;

  constructor(serverUrl: string = 'ws://localhost:8080') {
    this.cryptoService = new CryptoService();
    this.serverUrl = serverUrl;
    this.state = {
      isAuthenticated: false,
      user: null,
      token: null,
      keyPair: null,
    };

    // Загружаем сохраненную сессию при инициализации
    this.loadStoredSession();
  }

  /**
   * Регистрирует нового пользователя с генерацией ключевой пары
   */
  async register(request: RegisterRequest): Promise<AuthResponse> {
    try {
      // Генерируем ключевую пару для пользователя
      const keyPair = await this.cryptoService.generateKeyPair();
      
      // Экспортируем публичный ключ в формате PEM для отправки на сервер
      const publicKeyPem = await this.exportPublicKey(keyPair.publicKey);

      // Отправляем запрос на регистрацию
      const response = await this.makeRequest('/api/auth/register', {
        username: request.username,
        password: request.password,
        email: request.email,
        publicKey: publicKeyPem,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      const data = await response.json();
      
      // Сохраняем данные аутентификации
      this.setAuthState({
        isAuthenticated: true,
        user: data.user,
        token: data.token,
        keyPair,
      });

      // Сохраняем сессию в localStorage
      await this.saveSession();

      console.log(`User registered: ${data.user.username}`);
      return {
        user: data.user,
        token: data.token,
        keyPair,
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Выполняет вход пользователя с созданием сессии
   */
  async login(request: LoginRequest): Promise<AuthResponse> {
    try {
      // Отправляем запрос на вход
      const response = await this.makeRequest('/api/auth/login', {
        username: request.username,
        password: request.password,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();
      
      // Генерируем новую ключевую пару для сессии
      const keyPair = await this.cryptoService.generateKeyPair();
      
      // Обновляем публичный ключ на сервере
      try {
        const publicKeyPem = await this.exportPublicKey(keyPair.publicKey);
        await this.updatePublicKey(data.token, publicKeyPem);
      } catch (error) {
        console.warn('Failed to update public key:', error);
      }

      // Сохраняем данные аутентификации
      this.setAuthState({
        isAuthenticated: true,
        user: data.user,
        token: data.token,
        keyPair,
      });

      // Сохраняем сессию в localStorage
      await this.saveSession();

      console.log(`User logged in: ${data.user.username}`);
      return {
        user: data.user,
        token: data.token,
        keyPair,
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Выполняет выход из системы
   */
  async logout(): Promise<void> {
    try {
      if (this.state.token) {
        // Уведомляем сервер о выходе
        await this.makeRequest('/api/auth/logout', {}, this.state.token);
      }
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      // Очищаем локальное состояние независимо от успеха запроса
      this.clearAuthState();
      this.clearStoredSession();
      console.log('User logged out');
    }
  }

  /**
   * Получает текущего пользователя
   */
  getCurrentUser(): User | null {
    return this.state.user;
  }

  /**
   * Получает текущий токен
   */
  getToken(): string | null {
    return this.state.token;
  }

  /**
   * Получает текущую ключевую пару
   */
  getKeyPair(): KeyPair | null {
    return this.state.keyPair;
  }

  /**
   * Проверяет, аутентифицирован ли пользователь
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated && !!this.state.token;
  }

  /**
   * Получает текущее состояние аутентификации
   */
  getAuthState(): AuthState {
    return { ...this.state };
  }

  /**
   * Обновляет токен (refresh)
   */
  async refreshToken(): Promise<string> {
    if (!this.state.token) {
      throw new Error('No token to refresh');
    }

    try {
      const response = await this.makeRequest('/api/auth/refresh', {}, this.state.token);
      
      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      
      this.state.token = data.token;
      await this.saveSession();

      return data.token;
    } catch (error) {
      console.error('Token refresh error:', error);
      // При ошибке обновления токена разлогиниваем пользователя
      this.clearAuthState();
      this.clearStoredSession();
      throw error;
    }
  }

  /**
   * Проверяет валидность токена
   */
  async validateToken(): Promise<boolean> {
    if (!this.state.token) {
      return false;
    }

    try {
      const response = await this.makeRequest('/api/auth/validate', {}, this.state.token);
      return response.ok;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  /**
   * Экспортирует публичный ключ в PEM формат
   */
  private async exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('spki', publicKey);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Импортирует публичный ключ из PEM формата
   */
  private async importPublicKey(pem: string): Promise<CryptoKey> {
    const binaryDer = this.base64ToArrayBuffer(pem);
    return crypto.subtle.importKey(
      'spki',
      binaryDer,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );
  }

  /**
   * Обновляет публичный ключ на сервере
   */
  private async updatePublicKey(token: string, publicKey: string): Promise<void> {
    const response = await this.makeRequest('/api/user/update-key', {
      publicKey,
    }, token);

    if (!response.ok) {
      throw new Error('Failed to update public key');
    }
  }

  /**
   * Выполняет HTTP запрос к серверу
   */
  private async makeRequest(
    endpoint: string, 
    data: any, 
    token?: string
  ): Promise<Response> {
    const url = `${this.serverUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    return response;
  }

  /**
   * Устанавливает состояние аутентификации
   */
  private setAuthState(state: Partial<AuthState>): void {
    this.state = { ...this.state, ...state };
  }

  /**
   * Очищает состояние аутентификации
   */
  private clearAuthState(): void {
    this.state = {
      isAuthenticated: false,
      user: null,
      token: null,
      keyPair: null,
    };
  }

  /**
   * Сохраняет сессию в localStorage
   */
  private async saveSession(): Promise<void> {
    if (!this.state.token || !this.state.user) {
      return;
    }

    const sessionData = {
      user: this.state.user,
      token: this.state.token,
      // Сохраняем приватный ключ в виде JSON Web Key (JWK)
      privateKeyJwk: this.state.keyPair ? await this.exportPrivateKey(this.state.keyPair.privateKey) : null,
      publicKeyJwk: this.state.keyPair ? await this.exportPublicKeyJwk(this.state.keyPair.publicKey) : null,
    };

    try {
      localStorage.setItem('auth-session', JSON.stringify(sessionData));
    } catch (error) {
      console.warn('Failed to save session to localStorage:', error);
    }
  }

  /**
   * Загружает сохраненную сессию из localStorage
   */
  private async loadStoredSession(): Promise<void> {
    try {
      let sessionData: string | null = null;
      try {
        sessionData = localStorage.getItem('auth-session');
      } catch (error) {
        console.warn('localStorage not available:', error);
        return;
      }
      
      if (!sessionData) {
        return;
      }

      const session = JSON.parse(sessionData);

      // Восстанавливаем ключевую пару из JWK
      let keyPair: KeyPair | null = null;
      if (session.privateKeyJwk && session.publicKeyJwk) {
        const privateKey = await this.importPrivateKey(session.privateKeyJwk);
        const publicKey = await this.importPublicKeyJwk(session.publicKeyJwk);
        keyPair = { privateKey, publicKey };
      }

      // Проверяем валидность токена
      if (session.token) {
        const isValid = await this.validateToken();
        if (!isValid) {
          this.clearStoredSession();
          return;
        }
      }

      this.setAuthState({
        isAuthenticated: true,
        user: session.user,
        token: session.token,
        keyPair,
      });

      console.log('Session restored for user:', session.user.username);
    } catch (error) {
      console.error('Failed to load stored session:', error);
      this.clearStoredSession();
    }
  }

  /**
   * Очищает сохраненную сессию
   */
  private clearStoredSession(): void {
    try {
      localStorage.removeItem('auth-session');
    } catch (error) {
      console.warn('Failed to clear stored session:', error);
    }
  }

  /**
   * Экспортирует приватный ключ в JWK формат
   */
  private async exportPrivateKey(privateKey: CryptoKey): Promise<JsonWebKey> {
    return crypto.subtle.exportKey('jwk', privateKey) as Promise<JsonWebKey>;
  }

  /**
   * Экспортирует публичный ключ в JWK формат
   */
  private async exportPublicKeyJwk(publicKey: CryptoKey): Promise<JsonWebKey> {
    return crypto.subtle.exportKey('jwk', publicKey) as Promise<JsonWebKey>;
  }

  /**
   * Импортирует приватный ключ из JWK формата
   */
  private async importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );
  }

  /**
   * Импортирует публичный ключ из JWK формата
   */
  private async importPublicKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );
  }

  /**
   * Конвертирует ArrayBuffer в Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Конвертирует Base64 в ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

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
  deviceId?: string;
  deviceName?: string;
  userAgent?: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
  deviceId?: string;
  deviceName?: string;
  userAgent?: string;
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
  deviceId?: string;
}

export class AuthService {
  private cryptoService: CryptoService;
  private serverUrl: string;
  private state: AuthState;

  constructor(serverUrl: string = window.location.origin) {
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
   * Получает или генерирует уникальный ID устройства
   */
  private getDeviceId(): string {
    const storageKey = 'device-id';
    let deviceId = localStorage.getItem(storageKey);
    
    if (!deviceId) {
      // Генерируем новый ID устройства
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(storageKey, deviceId);
      console.log('Generated new device ID:', deviceId);
    }
    
    return deviceId;
  }

  /**
   * Получает информацию об устройстве
   */
  private getDeviceInfo(): { deviceName: string; userAgent: string } {
    const userAgent = navigator.userAgent;
    let deviceName = 'Unknown Device';
    
    // Определяем тип устройства
    if (/Mobile|Android|iPhone|iPad|iPod/.test(userAgent)) {
      deviceName = 'Mobile Device';
    } else if (/Tablet|iPad/.test(userAgent)) {
      deviceName = 'Tablet';
    } else if (/Windows/.test(userAgent)) {
      deviceName = 'Windows PC';
    } else if (/Mac/.test(userAgent)) {
      deviceName = 'Mac';
    } else if (/Linux/.test(userAgent)) {
      deviceName = 'Linux PC';
    }
    
    return { deviceName, userAgent };
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

      // Получаем информацию об устройстве
      const deviceId = this.getDeviceId();
      const deviceInfo = this.getDeviceInfo();

      // Отправляем запрос на регистрацию
      const response = await this.makeRequest('/api/auth/register', {
        username: request.username,
        password: request.password,
        email: request.email,
        publicKey: publicKeyPem,
        deviceId,
        deviceName: deviceInfo.deviceName,
        userAgent: deviceInfo.userAgent,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(errorData.error || 'Registration failed');
      }

      const data = await response.json();
      
      // Сохраняем данные аутентификации
      this.setAuthState({
        isAuthenticated: true,
        user: data.user,
        token: data.token,
        keyPair,
        deviceId,
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
      // Получаем информацию об устройстве
      const deviceId = this.getDeviceId();
      const deviceInfo = this.getDeviceInfo();

      // Отправляем запрос на вход
      const response = await this.makeRequest('/api/auth/login', {
        username: request.username,
        password: request.password,
        deviceId,
        deviceName: deviceInfo.deviceName,
        userAgent: deviceInfo.userAgent,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(errorData.error || 'Invalid username or password');
      }

      const data = await response.json();
      
      // Генерируем новую ключевую пару для сессии
      const keyPair = await this.cryptoService.generateKeyPair();
      
      // Обновляем публичный ключ на сервере
      try {
        const publicKeyPem = await this.exportPublicKey(keyPair.publicKey);
        await this.updatePublicKey(data.user.id, data.token, publicKeyPem);
      } catch (error) {
        console.warn('Failed to update public key:', error);
      }

      // Сохраняем данные аутентификации
      this.setAuthState({
        isAuthenticated: true,
        user: data.user,
        token: data.token,
        keyPair,
        deviceId,
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
   * Выполняет автоматический вход через deviceId
   */
  async autoLogin(): Promise<AuthResponse | null> {
    try {
      const deviceId = this.getDeviceId();
      
      // Отправляем запрос на автоматический вход
      const response = await this.makeRequest('/api/auth/auto-login', {
        deviceId,
      });

      if (!response.ok) {
        console.log('Auto-login failed, device not recognized');
        return null;
      }

      const data = await response.json();
      
      // Генерируем новую ключевую пару для сессии
      const keyPair = await this.cryptoService.generateKeyPair();
      
      // Обновляем публичный ключ на сервере
      try {
        const publicKeyPem = await this.exportPublicKey(keyPair.publicKey);
        await this.updatePublicKey(data.user.id, data.token, publicKeyPem);
      } catch (error) {
        console.warn('Failed to update public key:', error);
      }

      // Сохраняем данные аутентификации
      this.setAuthState({
        isAuthenticated: true,
        user: data.user,
        token: data.token,
        keyPair,
        deviceId,
      });

      // Сохраняем сессию в localStorage
      await this.saveSession();

      console.log(`Auto-login successful for user: ${data.user.username}`);
      return {
        user: data.user,
        token: data.token,
        keyPair,
      };
    } catch (error) {
      console.log('Auto-login not available:', error);
      return null;
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
  private async updatePublicKey(userId: string, token: string, publicKey: string): Promise<void> {
    const response = await this.makeRequest('/api/user/update-key', {
      userId,
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
      console.warn('Cannot save session: missing token or user');
      return;
    }

    try {
      const sessionData = {
        user: this.state.user,
        token: this.state.token,
        deviceId: this.state.deviceId,
        // Сохраняем приватный ключ в виде JSON Web Key (JWK)
        privateKeyJwk: this.state.keyPair ? await this.exportPrivateKey(this.state.keyPair.privateKey) : null,
        publicKeyJwk: this.state.keyPair ? await this.exportPublicKeyJwk(this.state.keyPair.publicKey) : null,
      };

      localStorage.setItem('auth-session', JSON.stringify(sessionData));
      console.log('Session saved successfully');
    } catch (error) {
      console.error('Failed to save session to localStorage:', error);
      // Попробуем сохранить хотя бы без ключей
      try {
        const minimalSession = {
          user: this.state.user,
          token: this.state.token,
          deviceId: this.state.deviceId,
          privateKeyJwk: null,
          publicKeyJwk: null,
        };
        localStorage.setItem('auth-session', JSON.stringify(minimalSession));
        console.log('Session saved without keys');
      } catch (fallbackError) {
        console.error('Failed to save even minimal session:', fallbackError);
      }
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
        deviceId: session.deviceId,
      });

      console.log('Session restored for user:', session.user.username, 'with device:', session.deviceId);
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

import * as jwt from 'jsonwebtoken';
import { IncomingMessage } from 'http';

/**
 * AuthMiddleware - Модуль аутентификации для WebSocket сервера
 * 
 * Использует JWT токены для аутентификации пользователей
 * Поддерживает генерацию и верификацию токенов
 */

export interface JWTPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiration: string;
  issuer?: string;
  audience?: string;
}

export interface AuthenticatedUser {
  userId: string;
  username: string;
}

export class AuthMiddleware {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = {
      issuer: 'secure-p2p-messenger',
      audience: 'secure-p2p-messenger-users',
      ...config,
    };
  }

  /**
   * Генерирует JWT токен для пользователя
   */
  generateToken(user: AuthenticatedUser): string {
    const payload: JWTPayload = {
      userId: user.userId,
      username: user.username,
    };

    const options: jwt.SignOptions = {
      expiresIn: this.config.jwtExpiration,
      issuer: this.config.issuer,
      audience: this.config.audience,
    };

    return jwt.sign(payload, this.config.jwtSecret, options);
  }

  /**
   * Верифицирует JWT токен
   */
  verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.warn('Token expired:', error.message);
      } else if (error instanceof jwt.JsonWebTokenError) {
        console.warn('Invalid token:', error.message);
      } else {
        console.warn('Token verification error:', error);
      }
      return null;
    }
  }

  /**
   * Извлекает токен из WebSocket запроса
   */
  extractTokenFromRequest(request: IncomingMessage): string | null {
    // Проверяем URL параметры
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const tokenFromUrl = url.searchParams.get('token');
    if (tokenFromUrl) {
      return tokenFromUrl;
    }

    // Проверяем заголовки
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Проверяем query string (альтернативный способ)
    const queryString = request.url?.split('?')[1];
    if (queryString) {
      const params = new URLSearchParams(queryString);
      return params.get('token');
    }

    return null;
  }

  /**
   * Проверяет аутентификацию при WebSocket подключении
   */
  authenticateWebSocket(request: IncomingMessage): {
    isAuthenticated: boolean;
    user?: AuthenticatedUser;
    error?: string;
  } {
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      return {
        isAuthenticated: false,
        error: 'No token provided',
      };
    }

    const payload = this.verifyToken(token);
    if (!payload) {
      return {
        isAuthenticated: false,
        error: 'Invalid or expired token',
      };
    }

    return {
      isAuthenticated: true,
      user: {
        userId: payload.userId,
        username: payload.username,
      },
    };
  }

  /**
   * Обновляет токен (генерирует новый для того же пользователя)
   */
  refreshToken(user: AuthenticatedUser): string {
    return this.generateToken(user);
  }

  /**
   * Проверяет срок действия токена без верификации подписи
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      if (!decoded || !decoded.exp) {
        return true;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  /**
   * Получает информацию о токене (без верификации)
   */
  getTokenInfo(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Создает middleware для Express (если понадобится)
   */
  createExpressMiddleware() {
    return (req: IncomingMessage, res: any, next: any) => {
      const auth = this.authenticateWebSocket(req);
      
      if (!auth.isAuthenticated) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: auth.error }));
        return;
      }

      // Добавляем информацию о пользователе в запрос
      (req as any).user = auth.user;
      next();
    };
  }
}

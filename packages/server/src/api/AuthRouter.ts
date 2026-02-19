import { IncomingMessage, ServerResponse } from 'http';
import { UserManager } from '../users/UserManager';

/**
 * AuthRouter - HTTP API для аутентификации
 * 
 * Обрабатывает REST API запросы для:
 * - Регистрации пользователей
 * - Входа в систему
 */

export class AuthRouter {
  private userManager: UserManager;

  constructor(userManager: UserManager) {
    this.userManager = userManager;
  }

  /**
   * Обрабатывает HTTP запросы
   */
  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Устанавливаем CORS заголовки
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Обрабатываем preflight запросы
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const path = url.pathname;

    try {
      if (path === '/api/auth/register' && req.method === 'POST') {
        await this.handleRegister(req, res);
      } else if (path === '/api/auth/login' && req.method === 'POST') {
        await this.handleLogin(req, res);
      } else if (path === '/api/user/update-key' && req.method === 'POST') {
        await this.handleUpdateKey(req, res);
      } else if (path === '/api/health' && req.method === 'GET') {
        await this.handleHealth(req, res);
      } else {
        this.sendError(res, 404, 'Not found');
      }
    } catch (error) {
      console.error('Request error:', error);
      this.sendError(res, 500, 'Internal server error');
    }
  }

  /**
   * Обрабатывает регистрацию
   */
  private async handleRegister(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseBody(req);
      
      if (!body.username || !body.password) {
        this.sendError(res, 400, 'Username and password are required');
        return;
      }

      if (body.username.length < 3) {
        this.sendError(res, 400, 'Username must be at least 3 characters');
        return;
      }

      if (body.password.length < 6) {
        this.sendError(res, 400, 'Password must be at least 6 characters');
        return;
      }

      const result = await this.userManager.createUser({
        username: body.username,
        password: body.password,
        email: body.email,
        publicKey: body.publicKey,
      });

      this.sendSuccess(res, 201, {
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          createdAt: result.user.createdAt,
        },
        token: result.token,
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.message === 'Username already exists') {
        this.sendError(res, 409, 'Username already exists');
      } else if (error.message === 'Email already exists') {
        this.sendError(res, 409, 'Email already exists');
      } else {
        this.sendError(res, 500, 'Registration failed');
      }
    }
  }

  /**
   * Обрабатывает вход
   */
  private async handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseBody(req);
      
      if (!body.username || !body.password) {
        this.sendError(res, 400, 'Username and password are required');
        return;
      }

      const result = await this.userManager.login({
        username: body.username,
        password: body.password,
      });

      this.sendSuccess(res, 200, {
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          createdAt: result.user.createdAt,
        },
        token: result.token,
      });
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.message === 'Invalid username or password') {
        this.sendError(res, 401, 'Invalid username or password');
      } else {
        this.sendError(res, 500, 'Login failed');
      }
    }
  }

  /**
   * Обрабатывает обновление публичного ключа
   */
  private async handleUpdateKey(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseBody(req);
      
      if (!body.userId || !body.publicKey) {
        this.sendError(res, 400, 'User ID and public key are required');
        return;
      }

      // Обновляем публичный ключ в базе данных
      await this.userManager.updatePublicKey(body.userId, body.publicKey);

      this.sendSuccess(res, 200, {
        success: true,
        message: 'Public key updated successfully',
      });
    } catch (error: any) {
      console.error('Update key error:', error);
      this.sendError(res, 500, 'Failed to update public key');
    }
  }

  /**
   * Обрабатывает health check
   */
  private async handleHealth(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.sendSuccess(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Парсит тело запроса
   */
  private parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });

      req.on('error', reject);
    });
  }

  /**
   * Отправляет успешный ответ
   */
  private sendSuccess(res: ServerResponse, status: number, data: any): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  /**
   * Отправляет ошибку
   */
  private sendError(res: ServerResponse, status: number, message: string): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }
}

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
      } else if (path === '/api/auth/auto-login' && req.method === 'POST') {
        await this.handleAutoLogin(req, res);
      } else if (path === '/api/user/update-key' && req.method === 'POST') {
        await this.handleUpdateKey(req, res);
      } else if (path === '/api/contacts' && req.method === 'GET') {
        await this.handleGetContacts(req, res);
      } else if (path === '/api/contacts' && req.method === 'POST') {
        await this.handleAddContact(req, res);
      } else if (path.startsWith('/api/contacts/') && req.method === 'DELETE') {
        await this.handleDeleteContact(req, res);
      } else if (path === '/api/users/search' && req.method === 'GET') {
        await this.handleSearchUsers(req, res);
      } else if (path.startsWith('/api/users/') && path.endsWith('/public-key') && req.method === 'GET') {
        await this.handleGetPublicKey(req, res);
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
        deviceId: body.deviceId,
        deviceName: body.deviceName,
        userAgent: body.userAgent,
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
        deviceId: body.deviceId,
        deviceName: body.deviceName,
        userAgent: body.userAgent,
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
   * Обрабатывает автоматический вход через deviceId
   */
  private async handleAutoLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseBody(req);
      
      if (!body.deviceId) {
        this.sendError(res, 400, 'Device ID is required');
        return;
      }

      // Ищем пользователя по deviceId
      const pool = this.userManager.getPool();
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          `SELECT u.id, u.username, u.email, u.public_key, u.created_at, u.last_seen, u.is_online
           FROM users u
           JOIN user_devices ud ON u.id = ud.user_id
           WHERE ud.device_id = $1 AND ud.is_active = TRUE
           ORDER BY ud.last_used DESC
           LIMIT 1`,
          [body.deviceId]
        );

        if (result.rows.length === 0) {
          this.sendError(res, 404, 'Device not found or inactive');
          return;
        }

        const userData = result.rows[0];
        const user = {
          id: userData.id,
          username: userData.username,
          email: userData.email,
          publicKey: userData.public_key,
          createdAt: userData.created_at,
          lastSeen: userData.last_seen,
          isOnline: userData.is_online,
        };

        // Обновляем last_seen и is_online
        await client.query(
          'UPDATE users SET last_seen = CURRENT_TIMESTAMP, is_online = TRUE WHERE id = $1',
          [user.id]
        );

        // Обновляем last_used для устройства
        await client.query(
          'UPDATE user_devices SET last_used = CURRENT_TIMESTAMP WHERE device_id = $1',
          [body.deviceId]
        );

        // Генерируем JWT токен
        const token = this.userManager['authMiddleware'].generateToken({
          userId: user.id,
          username: user.username,
        });

        console.log(`Auto-login successful for user: ${user.username} with device: ${body.deviceId}`);
        
        this.sendSuccess(res, 200, {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
          },
          token,
        });
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('Auto-login error:', error);
      this.sendError(res, 500, 'Auto-login failed');
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
   * Обрабатывает получение списка контактов
   */
  private async handleGetContacts(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const token = this.extractToken(req);
      if (!token) {
        this.sendError(res, 401, 'Unauthorized');
        return;
      }

      // TODO: Verify token and get userId
      // For now, extract userId from query params
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const userId = url.searchParams.get('userId');

      if (!userId) {
        this.sendError(res, 400, 'User ID is required');
        return;
      }

      const contacts = await this.userManager.getContacts(userId);

      this.sendSuccess(res, 200, { contacts });
    } catch (error: any) {
      console.error('Get contacts error:', error);
      this.sendError(res, 500, 'Failed to get contacts');
    }
  }

  /**
   * Обрабатывает добавление контакта
   */
  private async handleAddContact(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const token = this.extractToken(req);
      if (!token) {
        this.sendError(res, 401, 'Unauthorized');
        return;
      }

      const body = await this.parseBody(req);
      
      if (!body.userId || !body.contactUsername) {
        this.sendError(res, 400, 'User ID and contact username are required');
        return;
      }

      const contact = await this.userManager.addContact(
        body.userId,
        body.contactUsername,
        body.nickname
      );

      this.sendSuccess(res, 201, { contact });
    } catch (error: any) {
      console.error('Add contact error:', error);
      
      if (error.message === 'User not found') {
        this.sendError(res, 404, 'User not found');
      } else if (error.message === 'Contact already exists') {
        this.sendError(res, 409, 'Contact already exists');
      } else {
        this.sendError(res, 500, 'Failed to add contact');
      }
    }
  }

  /**
   * Обрабатывает удаление контакта
   */
  private async handleDeleteContact(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const token = this.extractToken(req);
      if (!token) {
        this.sendError(res, 401, 'Unauthorized');
        return;
      }

      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const pathParts = url.pathname.split('/');
      const contactUserId = pathParts[pathParts.length - 1];

      const userId = url.searchParams.get('userId');

      if (!userId || !contactUserId) {
        this.sendError(res, 400, 'User ID and contact user ID are required');
        return;
      }

      await this.userManager.removeContact(userId, contactUserId);

      this.sendSuccess(res, 200, { success: true });
    } catch (error: any) {
      console.error('Delete contact error:', error);
      this.sendError(res, 500, 'Failed to delete contact');
    }
  }

  /**
   * Обрабатывает поиск пользователей
   */
  private async handleSearchUsers(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const token = this.extractToken(req);
      if (!token) {
        this.sendError(res, 401, 'Unauthorized');
        return;
      }

      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const query = url.searchParams.get('q');

      if (!query) {
        this.sendError(res, 400, 'Search query is required');
        return;
      }

      const user = await this.userManager.getUserByUsername(query);

      if (user) {
        this.sendSuccess(res, 200, {
          users: [{
            id: user.id,
            username: user.username,
            isOnline: user.isOnline,
          }]
        });
      } else {
        this.sendSuccess(res, 200, { users: [] });
      }
    } catch (error: any) {
      console.error('Search users error:', error);
      this.sendError(res, 500, 'Failed to search users');
    }
  }

  /**
   * Обрабатывает получение публичного ключа пользователя
   */
  private async handleGetPublicKey(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const pathParts = url.pathname.split('/');
      const userId = pathParts[pathParts.length - 2]; // Получаем ID из /api/users/{id}/public-key

      if (!userId) {
        this.sendError(res, 400, 'User ID is required');
        return;
      }

      const user = await this.userManager.getUserById(userId);

      if (!user) {
        this.sendError(res, 404, 'User not found');
        return;
      }

      if (!user.publicKey) {
        this.sendError(res, 404, 'Public key not found');
        return;
      }

      this.sendSuccess(res, 200, {
        userId: user.id,
        publicKey: user.publicKey,
      });
    } catch (error: any) {
      console.error('Get public key error:', error);
      this.sendError(res, 500, 'Failed to get public key');
    }
  }

  /**
   * Извлекает токен из заголовков
   */
  private extractToken(req: IncomingMessage): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
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

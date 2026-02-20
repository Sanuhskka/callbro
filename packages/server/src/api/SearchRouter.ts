import { IncomingMessage, ServerResponse } from 'http';
import { UserManager } from '../users/UserManager';
import { AuthMiddleware } from '../auth/AuthMiddleware';

/**
 * SearchRouter - HTTP API для поиска пользователей и сообщений
 * 
 * Обрабатывает REST API запросы для:
 * - Поиска пользователей по username
 * - Поиска сообщений по содержимому
 */

export class SearchRouter {
  private userManager: UserManager;
  private authMiddleware: AuthMiddleware;

  constructor(userManager: UserManager, authMiddleware: AuthMiddleware) {
    this.userManager = userManager;
    this.authMiddleware = authMiddleware;
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
      if (path === '/api/search/users' && req.method === 'GET') {
        await this.handleSearchUsers(req, res);
      } else if (path === '/api/search/messages' && req.method === 'GET') {
        await this.handleSearchMessages(req, res);
      } else {
        this.sendError(res, 404, 'Not found');
      }
    } catch (error) {
      console.error('SearchRouter error:', error);
      this.sendError(res, 500, 'Internal server error');
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

      const authenticatedUser = this.authMiddleware.verifyToken(token);
      if (!authenticatedUser) {
        this.sendError(res, 401, 'Invalid token');
        return;
      }

      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const query = url.searchParams.get('q');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      if (!query || query.trim().length < 2) {
        this.sendError(res, 400, 'Query must be at least 2 characters long');
        return;
      }

      if (limit > 50) {
        this.sendError(res, 400, 'limit cannot exceed 50');
        return;
      }

      const users = await this.userManager.searchUsers(
        query.trim(),
        authenticatedUser.userId,
        limit
      );

      this.sendSuccess(res, 200, { users });
    } catch (error: any) {
      console.error('Search users error:', error);
      this.sendError(res, 500, 'Failed to search users');
    }
  }

  /**
   * Обрабатывает поиск сообщений
   */
  private async handleSearchMessages(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const token = this.extractToken(req);
      if (!token) {
        this.sendError(res, 401, 'Unauthorized');
        return;
      }

      const authenticatedUser = this.authMiddleware.verifyToken(token);
      if (!authenticatedUser) {
        this.sendError(res, 401, 'Invalid token');
        return;
      }

      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const query = url.searchParams.get('q');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      if (!query || query.trim().length < 2) {
        this.sendError(res, 400, 'Query must be at least 2 characters long');
        return;
      }

      if (limit > 100) {
        this.sendError(res, 400, 'limit cannot exceed 100');
        return;
      }

      const messages = await this.userManager.searchMessages(
        authenticatedUser.userId,
        query.trim(),
        limit
      );

      this.sendSuccess(res, 200, { messages });
    } catch (error: any) {
      console.error('Search messages error:', error);
      this.sendError(res, 500, 'Failed to search messages');
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

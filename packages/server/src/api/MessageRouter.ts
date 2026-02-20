import { IncomingMessage, ServerResponse } from 'http';
import { MessageService } from '../services/MessageService';
import { AuthMiddleware } from '../auth/AuthMiddleware';

/**
 * MessageRouter - HTTP API для обмена сообщениями
 * 
 * Обрабатывает REST API запросы для:
 * - Отправки сообщений
 * - Получения истории сообщений
 * - Обновления статусов сообщений
 */

export class MessageRouter {
  private messageService: MessageService;
  private authMiddleware: AuthMiddleware;

  constructor(messageService: MessageService, authMiddleware: AuthMiddleware) {
    this.messageService = messageService;
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
      if (path === '/api/messages/send' && req.method === 'POST') {
        await this.handleSendMessage(req, res);
      } else if (path.startsWith('/api/messages/history') && req.method === 'GET') {
        await this.handleGetHistory(req, res);
      } else if (path.match(/^\/api\/messages\/[^/]+\/delivered$/) && req.method === 'POST') {
        await this.handleMarkDelivered(req, res);
      } else if (path.match(/^\/api\/messages\/[^/]+\/read$/) && req.method === 'POST') {
        await this.handleMarkRead(req, res);
      } else {
        this.sendError(res, 404, 'Not found');
      }
    } catch (error) {
      console.error('MessageRouter error:', error);
      this.sendError(res, 500, 'Internal server error');
    }
  }

  /**
   * Обрабатывает отправку сообщения
   */
  private async handleSendMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

      const body = await this.parseBody(req);
      
      if (!body.toUserId || !body.content || !body.type) {
        this.sendError(res, 400, 'toUserId, content, and type are required');
        return;
      }

      if (!['text', 'media', 'voice'].includes(body.type)) {
        this.sendError(res, 400, 'Invalid message type');
        return;
      }

      const message = await this.messageService.sendMessage({
        fromUserId: authenticatedUser.userId,
        toUserId: body.toUserId,
        content: body.content,
        type: body.type,
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType,
        voiceDuration: body.voiceDuration,
        encrypted: body.encrypted || false,
      });

      this.sendSuccess(res, 201, { message });
    } catch (error: any) {
      console.error('Send message error:', error);
      
      if (error.message === 'Recipient not found') {
        this.sendError(res, 404, 'Recipient not found');
      } else if (error.message === 'Invalid message data') {
        this.sendError(res, 400, 'Invalid message data');
      } else {
        this.sendError(res, 500, 'Failed to send message');
      }
    }
  }

  /**
   * Обрабатывает получение истории сообщений
   */
  private async handleGetHistory(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
      const userId = url.searchParams.get('userId');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      if (!userId) {
        this.sendError(res, 400, 'userId is required');
        return;
      }

      if (limit > 100) {
        this.sendError(res, 400, 'limit cannot exceed 100');
        return;
      }

      const history = await this.messageService.getMessageHistory(
        authenticatedUser.userId,
        userId,
        limit,
        offset
      );

      this.sendSuccess(res, 200, history);
    } catch (error: any) {
      console.error('Get history error:', error);
      this.sendError(res, 500, 'Failed to get message history');
    }
  }

  /**
   * Обрабатывает отметку о доставке сообщения
   */
  private async handleMarkDelivered(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
      const pathParts = url.pathname.split('/');
      const messageId = pathParts[pathParts.length - 2];

      if (!messageId) {
        this.sendError(res, 400, 'Message ID is required');
        return;
      }

      await this.messageService.markMessageAsDelivered(messageId, authenticatedUser.userId);

      this.sendSuccess(res, 200, { success: true });
    } catch (error: any) {
      console.error('Mark delivered error:', error);
      
      if (error.message === 'Message not found') {
        this.sendError(res, 404, 'Message not found');
      } else if (error.message === 'Access denied') {
        this.sendError(res, 403, 'Access denied');
      } else {
        this.sendError(res, 500, 'Failed to mark message as delivered');
      }
    }
  }

  /**
   * Обрабатывает отметку о прочтении сообщения
   */
  private async handleMarkRead(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
      const pathParts = url.pathname.split('/');
      const messageId = pathParts[pathParts.length - 2];

      if (!messageId) {
        this.sendError(res, 400, 'Message ID is required');
        return;
      }

      await this.messageService.markMessageAsRead(messageId, authenticatedUser.userId);

      this.sendSuccess(res, 200, { success: true });
    } catch (error: any) {
      console.error('Mark read error:', error);
      
      if (error.message === 'Message not found') {
        this.sendError(res, 404, 'Message not found');
      } else if (error.message === 'Access denied') {
        this.sendError(res, 403, 'Access denied');
      } else {
        this.sendError(res, 500, 'Failed to mark message as read');
      }
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

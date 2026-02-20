import { IncomingMessage, ServerResponse } from 'http';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AuthMiddleware } from '../auth/AuthMiddleware';

/**
 * MediaRouter - HTTP API для загрузки медиа-файлов
 * 
 * Обрабатывает REST API запросы для:
 * - Загрузки изображений и видео
 * - Загрузки голосовых сообщений
 * - Валидации файлов
 */

export class MediaRouter {
  private authMiddleware: AuthMiddleware;
  private uploadDir: string;
  private maxFileSize: number;
  private multer: multer.Multer;

  constructor(authMiddleware: AuthMiddleware, uploadDir: string = './uploads') {
    this.authMiddleware = authMiddleware;
    this.uploadDir = uploadDir;
    this.maxFileSize = 50 * 1024 * 1024; // 50MB

    // Создаем директорию для загрузок, если она не существует
    this.ensureUploadDirectory();

    // Настраиваем multer для загрузки файлов
    this.multer = multer({
      storage: multer.diskStorage({
        destination: (req: any, file: any, cb: any) => {
          const subDir = file.mimetype.startsWith('audio/') ? 'audio' : 'media';
          const dir = path.join(this.uploadDir, subDir);
          this.ensureDirectory(dir);
          cb(null, dir);
        },
        filename: (req: any, file: any, cb: any) => {
          const extension = path.extname(file.originalname);
          const filename = `${uuidv4()}${extension}`;
          cb(null, filename);
        },
      }),
      limits: {
        fileSize: this.maxFileSize,
        files: 1,
      },
      fileFilter: (req: any, file: any, cb: any) => {
        this.validateFileType(req, file, cb);
      },
    });
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
      if (path === '/api/media/upload' && req.method === 'POST') {
        await this.handleUpload(req, res);
      } else if (path.startsWith('/api/media/') && req.method === 'GET') {
        await this.handleGetMedia(req, res);
      } else {
        this.sendError(res, 404, 'Not found');
      }
    } catch (error) {
      console.error('MediaRouter error:', error);
      this.sendError(res, 500, 'Internal server error');
    }
  }

  /**
   * Обрабатывает загрузку файла
   */
  private async handleUpload(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

      // Используем multer для загрузки файла
      await new Promise<void>((resolve, reject) => {
        const upload = this.multer.single('file');
        
        // Преобразуем IncomingMessage в формат, понятный multer
        const mockReq = this.createMockRequest(req);
        const mockRes = this.createMockResponse(res, resolve);

        upload(mockReq as any, mockRes as any, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // Получаем информацию о загруженном файле
      const fileInfo = await this.getUploadedFileInfo();
      
      if (!fileInfo) {
        this.sendError(res, 400, 'No file uploaded');
        return;
      }

      // Формируем URL для доступа к файлу
      const fileUrl = `/api/media/${fileInfo.filename}`;

      this.sendSuccess(res, 201, {
        url: fileUrl,
        filename: fileInfo.filename,
        originalName: fileInfo.originalName,
        size: fileInfo.size,
        mimeType: fileInfo.mimeType,
      });

      console.log(`File uploaded: ${fileInfo.originalName} by user ${authenticatedUser.userId}`);
    } catch (error: any) {
      console.error('Upload error:', error);
      
      if (error.message === 'File too large') {
        this.sendError(res, 413, 'File too large (max 50MB)');
      } else if (error.message === 'Invalid file type') {
        this.sendError(res, 400, 'Invalid file type');
      } else {
        this.sendError(res, 500, 'Failed to upload file');
      }
    }
  }

  /**
   * Обрабатывает получение файла
   */
  private async handleGetMedia(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const filename = url.pathname.replace('/api/media/', '');

      if (!filename) {
        this.sendError(res, 400, 'Filename is required');
        return;
      }

      // Ищем файл в поддиректориях
      const mediaPath = path.join(this.uploadDir, 'media', filename);
      const audioPath = path.join(this.uploadDir, 'audio', filename);
      
      let filePath = mediaPath;
      if (fs.existsSync(audioPath)) {
        filePath = audioPath;
      } else if (!fs.existsSync(mediaPath)) {
        this.sendError(res, 404, 'File not found');
        return;
      }

      // Определяем MIME тип
      const mimeType = this.getMimeType(filename);
      
      // Отправляем файл
      const fileStream = fs.createReadStream(filePath);
      
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000', // Кешируем на год
      });

      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          this.sendError(res, 500, 'Failed to serve file');
        }
      });
    } catch (error) {
      console.error('Get media error:', error);
      this.sendError(res, 500, 'Failed to get media file');
    }
  }

  /**
   * Валидирует тип файла
   */
  private validateFileType(req: any, file: any, cb: any): void {
    const allowedTypes = [
      // Изображения
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      // Видео
      'video/mp4',
      'video/webm',
      'video/quicktime',
      // Аудио
      'audio/webm',
      'audio/ogg',
      'audio/wav',
      'audio/mpeg',
      'audio/mp4',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }

  /**
   * Получает MIME тип по расширению файла
   */
  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Создает директорию, если она не существует
   */
  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Создает директорию для загрузок
   */
  private ensureUploadDirectory(): void {
    this.ensureDirectory(this.uploadDir);
    this.ensureDirectory(path.join(this.uploadDir, 'media'));
    this.ensureDirectory(path.join(this.uploadDir, 'audio'));
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
   * Создает mock request для multer
   */
  private createMockRequest(req: any): any {
    return {
      headers: req.headers,
      method: req.method,
      url: req.url,
      // Добавляем другие необходимые поля
    };
  }

  /**
   * Создает mock response для multer
   */
  private createMockResponse(res: ServerResponse, resolve: () => void): any {
    return {
      headersSent: false,
      locals: {},
      status: (code: number) => {
        res.statusCode = code;
        return {
          send: (data: any) => {
            res.writeHead(code, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            resolve();
          },
        };
      },
      send: (data: any) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        resolve();
      },
    };
  }

  /**
   * Получает информацию о загруженном файле (упрощенная версия)
   */
  private async getUploadedFileInfo(): Promise<any> {
    // В реальной реализации здесь нужно получить информацию из multer
    // Это упрощенная версия для демонстрации
    return new Promise((resolve) => {
      // Эмулируем получение информации о файле
      setTimeout(() => {
        resolve({
          filename: 'example.jpg',
          originalName: 'example.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
        });
      }, 100);
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

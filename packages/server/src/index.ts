import { SecureWebSocketServer } from './websocket/WebSocketServer';
import { AuthRouter } from './api/AuthRouter';
import { MessageRouter } from './api/MessageRouter';
import { MediaRouter } from './api/MediaRouter';
import { SearchRouter } from './api/SearchRouter';
import { UserManager } from './users/UserManager';
import { MessageService } from './services/MessageService';
import { AuthMiddleware } from './auth/AuthMiddleware';
import * as http from 'http';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const WS_PORT = parseInt(process.env.WS_PORT || '8081', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

console.log('🚀 Secure P2P Messenger - Server Starting...');
console.log(`📡 Server will start on port ${WS_PORT}`);

// Создаем AuthMiddleware
const authMiddleware = new AuthMiddleware({
  jwtSecret: JWT_SECRET,
  jwtExpiration: JWT_EXPIRES_IN,
});

// Создаем UserManager
const userManager = new UserManager(
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'secure_p2p_messenger',
    username: process.env.DB_USER || 'messenger_user',
    password: process.env.DB_PASSWORD || 'messenger_password_123',
  },
  authMiddleware
);

// Создаем MessageService
const messageService = new MessageService(userManager.getPool());

// Создаем AuthRouter
const authRouter = new AuthRouter(userManager);

// Создаем MessageRouter
const messageRouter = new MessageRouter(messageService, authMiddleware);

// Создаем MediaRouter
const mediaRouter = new MediaRouter(authMiddleware);

// Создаем SearchRouter
const searchRouter = new SearchRouter(userManager, authMiddleware);

// Создаем HTTP сервер для REST API
const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    // Маршрутизация запросов к соответствующим роутерам
    if (path.startsWith('/api/auth/') || path.startsWith('/api/contacts/') || path.startsWith('/api/users/') || path === '/api/health') {
      await authRouter.handleRequest(req, res);
    } else if (path.startsWith('/api/messages/')) {
      await messageRouter.handleRequest(req, res);
    } else if (path.startsWith('/api/media/')) {
      await mediaRouter.handleRequest(req, res);
    } else if (path.startsWith('/api/search/')) {
      await searchRouter.handleRequest(req, res);
    } else {
      // Если маршрут не найден, отправляем 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (error) {
    console.error('HTTP Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

// Создаем WebSocket сервер (используя тот же порт через upgrade)
const wsServer = new SecureWebSocketServer({
  server: httpServer,
  host: '0.0.0.0',
}, messageService);

// Обработчики событий
wsServer.on('started', () => {
  console.log('✅ WebSocket Server started successfully');
  console.log(`📊 Server Stats:`, wsServer.getStats());
});

wsServer.on('connection', (client) => {
  console.log(`👤 New client connected: ${client.id}`);
});

wsServer.on('authenticated', (client) => {
  console.log(`🔐 Client authenticated: ${client.userId}`);
});

wsServer.on('user-disconnected', (userId) => {
  console.log(`👋 User disconnected: ${userId}`);
});

wsServer.on('signal', (from, to, message) => {
  console.log(`📨 Signal: ${message.type} from ${from.userId} to ${to.userId}`);
});

// Обработчики событий от MessageService
messageService.on('new_message', (messageData) => {
  wsServer.sendNewMessageNotification(messageData);
});

messageService.on('message_status_updated', (statusData) => {
  wsServer.sendMessageStatusNotification(statusData);
});

wsServer.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// Запускаем HTTP сервер
httpServer.listen(WS_PORT, '0.0.0.0', () => {
  console.log(`✅ HTTP Server started on port ${WS_PORT}`);
});

// Запускаем WebSocket сервер
wsServer.start().catch((error) => {
  console.error('Failed to start WebSocket server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  httpServer.close();
  await wsServer.stop();
  await userManager.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server...');
  httpServer.close();
  await wsServer.stop();
  await userManager.close();
  process.exit(0);
});

export {};

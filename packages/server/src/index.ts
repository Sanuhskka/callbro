import { SecureWebSocketServer } from './websocket/WebSocketServer';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const WS_PORT = parseInt(process.env.WS_PORT || '8081', 10);

console.log('🚀 Secure P2P Messenger - Server Starting...');
console.log(`📡 WebSocket Server will start on port ${WS_PORT}`);

// Создаем WebSocket сервер
const wsServer = new SecureWebSocketServer({
  port: WS_PORT,
  host: '0.0.0.0',
});

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

wsServer.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// Запускаем сервер
wsServer.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await wsServer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server...');
  await wsServer.stop();
  process.exit(0);
});

export {};

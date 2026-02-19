import * as WebSocket from 'ws';
import * as https from 'https';
import * as fs from 'fs';
import { EventEmitter } from 'events';

/**
 * WebSocketServer - Сервер для сигнализации WebRTC соединений
 * 
 * Поддерживает:
 * - WebSocket (WS) и WebSocket Secure (WSS) соединения
 * - Ping/pong для проверки живых соединений
 * - Маршрутизацию сигнальных сообщений
 * - Управление онлайн статусами пользователей
 */

export interface WebSocketConfig {
  port: number;
  host?: string;
  ssl?: {
    key: string;
    cert: string;
  };
  pingInterval?: number;
  pingTimeout?: number;
}

export interface ClientConnection {
  id: string;
  userId: string;
  ws: WebSocket;
  lastPing: number;
  isAlive: boolean;
}

export type SignalMessage = {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-request' | 'call-response' | 'hangup';
  from: string;
  to: string;
  data: any;
  timestamp: number;
};

export class SecureWebSocketServer extends EventEmitter {
  private wss?: WebSocket.Server;
  private config: WebSocketConfig;
  private clients: Map<string, ClientConnection> = new Map();
  private pingInterval?: NodeJS.Timeout;
  private isStarted = false;

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      pingInterval: 30000, // 30 секунд
      pingTimeout: 5000,   // 5 секунд
      ...config,
    };
  }

  /**
   * Запускает WebSocket сервер
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('WebSocket server is already running');
    }

    try {
      if (this.config.ssl) {
        // Создаем WSS сервер с TLS
        const sslOptions = {
          key: fs.readFileSync(this.config.ssl.key),
          cert: fs.readFileSync(this.config.ssl.cert),
        };

        const httpsServer = https.createServer(sslOptions);
        this.wss = new WebSocket.Server({ server: httpsServer });

        httpsServer.listen(this.config.port, this.config.host, () => {
          console.log(`WSS Server started on ${this.config.host || 'localhost'}:${this.config.port}`);
        });
      } else {
        // Создаем обычный WS сервер
        this.wss = new WebSocket.Server({
          port: this.config.port,
          host: this.config.host,
        });

        console.log(`WS Server started on ${this.config.host || 'localhost'}:${this.config.port}`);
      }

      this.setupEventHandlers();
      this.startPingInterval();
      this.isStarted = true;

      this.emit('started');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Останавливает WebSocket сервер
   */
  async stop(): Promise<void> {
    if (!this.isStarted || !this.wss) {
      return;
    }

    try {
      // Останавливаем ping/pong
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
      }

      // Закрываем все соединения
      this.clients.forEach((client) => {
        client.ws.terminate();
      });
      this.clients.clear();

      // Закрываем сервер
      this.wss.close();
      this.isStarted = false;

      console.log('WebSocket server stopped');
      this.emit('stopped');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Устанавливает обработчики событий WebSocket
   */
  private setupEventHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Обрабатывает новое соединение
   */
  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = this.generateClientId();
    const client: ClientConnection = {
      id: clientId,
      userId: '', // Будет установлен после аутентификации
      ws,
      lastPing: Date.now(),
      isAlive: true,
    };

    this.clients.set(clientId, client);

    console.log(`New connection: ${clientId} from ${req.socket.remoteAddress}`);

    // Устанавливаем обработчики для клиента
    ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(client, data);
    });

    ws.on('pong', () => {
      client.isAlive = true;
      client.lastPing = Date.now();
    });

    ws.on('close', (code: number, reason: string) => {
      this.handleDisconnection(client, code, reason);
    });

    ws.on('error', (error) => {
      console.error(`Client error (${clientId}):`, error);
      this.handleDisconnection(client, 1006, 'Client error');
    });

    // Отправляем приветственное сообщение
    this.sendToClient(client, {
      type: 'welcome',
      clientId,
      timestamp: Date.now(),
    });

    this.emit('connection', client);
  }

  /**
   * Обрабатывает входящие сообщения
   */
  private handleMessage(client: ClientConnection, data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'auth':
          this.handleAuthentication(client, message);
          break;
        case 'offer':
        case 'answer':
        case 'ice-candidate':
        case 'call-request':
        case 'call-response':
        case 'hangup':
          this.handleSignalMessage(client, message as SignalMessage);
          break;
        case 'ping':
          this.sendToClient(client, { type: 'pong', timestamp: Date.now() });
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from ${client.id}:`, error);
    }
  }

  /**
   * Обрабатывает аутентификацию клиента
   */
  private handleAuthentication(client: ClientConnection, message: any): void {
    // TODO: Интегрировать с AuthMiddleware
    const { token, userId } = message;

    if (token && userId) {
      client.userId = userId;
      console.log(`Client ${client.id} authenticated as user ${userId}`);

      this.sendToClient(client, {
        type: 'auth-success',
        userId,
        timestamp: Date.now(),
      });

      this.emit('authenticated', client);
    } else {
      this.sendToClient(client, {
        type: 'auth-error',
        error: 'Invalid authentication data',
        timestamp: Date.now(),
      });

      client.ws.close(4001, 'Authentication failed');
    }
  }

  /**
   * Обрабатывает сигнальные сообщения
   */
  private handleSignalMessage(fromClient: ClientConnection, message: SignalMessage): void {
    if (!fromClient.userId) {
      console.warn(`Unauthenticated client ${fromClient.id} attempted to send signal`);
      return;
    }

    const toClient = this.findClientByUserId(message.to);
    
    if (!toClient) {
      // Пользователь не в сети
      this.sendToClient(fromClient, {
        type: 'user-offline',
        userId: message.to,
        timestamp: Date.now(),
      });
      return;
    }

    // Пересылаем сообщение целевому клиенту
    this.sendToClient(toClient, message);
    
    console.log(`Signal: ${message.type} from ${fromClient.userId} to ${message.to}`);
    this.emit('signal', fromClient, toClient, message);
  }

  /**
   * Обрабатывает отключение клиента
   */
  private handleDisconnection(client: ClientConnection, code: number, reason: string): void {
    this.clients.delete(client.id);
    console.log(`Client disconnected: ${client.id} (${code}: ${reason})`);

    if (client.userId) {
      this.emit('user-disconnected', client.userId);
    }

    this.emit('disconnection', client, code, reason);
  }

  /**
   * Запускает ping/pong проверку соединений
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client) => {
        if (!client.isAlive) {
          console.log(`Client ${client.id} failed ping check, terminating`);
          client.ws.terminate();
          this.clients.delete(client.id);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, this.config.pingInterval);
  }

  /**
   * Отправляет сообщение конкретному клиенту
   */
  private sendToClient(client: ClientConnection, message: any): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending message to ${client.id}:`, error);
      }
    }
  }

  /**
   * Находит клиента по ID пользователя
   */
  private findClientByUserId(userId: string): ClientConnection | undefined {
    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        return client;
      }
    }
    return undefined;
  }

  /**
   * Проверяет, находится ли пользователь в сети
   */
  public isUserOnline(userId: string): boolean {
    return this.findClientByUserId(userId) !== undefined;
  }

  /**
   * Получает список онлайн пользователей
   */
  public getOnlineUsers(): string[] {
    const onlineUsers = new Set<string>();
    this.clients.forEach((client) => {
      if (client.userId) {
        onlineUsers.add(client.userId);
      }
    });
    return Array.from(onlineUsers);
  }

  /**
   * Получает статистику сервера
   */
  public getStats(): {
    totalConnections: number;
    authenticatedUsers: number;
    onlineUsers: string[];
  } {
    const onlineUsers = this.getOnlineUsers();
    return {
      totalConnections: this.clients.size,
      authenticatedUsers: onlineUsers.length,
      onlineUsers,
    };
  }

  /**
   * Генерирует уникальный ID клиента
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

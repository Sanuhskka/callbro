import { SecureWebSocketServer, ClientConnection } from '../websocket/WebSocketServer';
import { SignalRouter } from '../signaling/SignalRouter';
import * as fc from 'fast-check';

// Mock WebSocket properly
jest.mock('ws', () => {
  return {
    OPEN: 1,
    CONNECTING: 0,
    CLOSING: 2,
    CLOSED: 3,
  };
});

/**
 * Property-Based Tests для Signal Server
 * Validates: Requirements 8.1, 8.2
 */

// Mock WebSocket implementation
class MockWebSocket {
  static OPEN = 1;
  readyState = 1;
  send = jest.fn();
  ping = jest.fn();
  terminate = jest.fn();
  close = jest.fn();
  on: any;
  addEventListener: any;

  constructor(url?: string) {
    // Mock constructor
  }
}

describe('SignalServer - Property-Based Tests', () => {
  let server: SecureWebSocketServer;
  let signalRouter: SignalRouter;
  const testPort = 8082;

  beforeEach(async () => {
    server = new SecureWebSocketServer({
      port: testPort,
      pingInterval: 1000,
      pingTimeout: 500,
    });
    
    signalRouter = new SignalRouter(server);
    await server.start();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  /**
   * Property 26: Регистрация онлайн статуса
   * Validates: Requirements 8.1
   * 
   * При подключении пользователя, его онлайн статус должен быть корректно зарегистрирован
   */
  describe('Property 26: Регистрация онлайн статуса', () => {
    it('should correctly register online status for any user connection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
          async (usernames) => {
            // Очищаем предыдущие соединения
            const initialStats = server.getStats();
            
            // Создаем mock WebSocket соединения для каждого пользователя
            const mockConnections: ClientConnection[] = [];
            
            for (const username of usernames) {
              const mockWs = new MockWebSocket() as any;

              // Симулируем подключение
              const client: ClientConnection = {
                id: `client_${username}`,
                userId: username,
                ws: mockWs,
                lastPing: Date.now(),
                isAlive: true,
              };

              mockConnections.push(client);
              server.emit('connection', client, { socket: { remoteAddress: '127.0.0.1' } });
            }

            // Проверяем, что все пользователи зарегистрированы как онлайн
            const onlineUsers = server.getOnlineUsers();
            
            for (const username of usernames) {
              expect(server.isUserOnline(username)).toBe(true);
              expect(onlineUsers).toContain(username);
            }

            // Проверяем статистику
            const stats = server.getStats();
            expect(stats.authenticatedUsers).toBe(usernames.length);
            expect(stats.onlineUsers.sort()).toEqual(usernames.sort());

            // Очищаем соединения
            mockConnections.forEach(client => {
              server.emit('disconnection', client, 1000, 'Test cleanup');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle duplicate user connections correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 20 }),
          fc.integer({ min: 2, max: 5 }),
          async (username, connectionCount) => {
            const mockConnections: ClientConnection[] = [];
            
            // Создаем несколько соединений для одного пользователя
            for (let i = 0; i < connectionCount; i++) {
              const mockWs = new MockWebSocket() as any;

              const client: ClientConnection = {
                id: `client_${username}_${i}`,
                userId: username,
                ws: mockWs,
                lastPing: Date.now(),
                isAlive: true,
              };

              mockConnections.push(client);
              server.emit('connection', client, { socket: { remoteAddress: '127.0.0.1' } });
            }

            // Пользователь должен быть онлайн (даже с несколькими соединениями)
            expect(server.isUserOnline(username)).toBe(true);
            
            const onlineUsers = server.getOnlineUsers();
            expect(onlineUsers).toContain(username);

            // В статистике пользователь должен быть посчитан один раз
            const stats = server.getStats();
            expect(stats.authenticatedUsers).toBe(1);
            expect(stats.onlineUsers).toEqual([username]);

            // Очищаем соединения
            mockConnections.forEach(client => {
              server.emit('disconnection', client, 1000, 'Test cleanup');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly update offline status when user disconnects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 5 }),
          async (usernames, disconnectIndices) => {
            const mockConnections: ClientConnection[] = [];
            
            // Подключаем всех пользователей
            for (const username of usernames) {
              const mockWs = new MockWebSocket() as any;

              const client: ClientConnection = {
                id: `client_${username}`,
                userId: username,
                ws: mockWs,
                lastPing: Date.now(),
                isAlive: true,
              };

              mockConnections.push(client);
              server.emit('connection', client, { socket: { remoteAddress: '127.0.0.1' } });
            }

            // Отключаем пользователей по указанным индексам
            const usersToDisconnect = disconnectIndices
              .filter(index => index < usernames.length)
              .map(index => usernames[index]);

            for (const username of usersToDisconnect) {
              const client = mockConnections.find(c => c.userId === username);
              if (client) {
                server.emit('disconnection', client, 1000, 'Test disconnect');
              }
            }

            // Проверяем онлайн статусы
            const remainingUsers = usernames.filter(u => !usersToDisconnect.includes(u));
            
            for (const username of usersToDisconnect) {
              expect(server.isUserOnline(username)).toBe(false);
            }

            for (const username of remainingUsers) {
              expect(server.isUserOnline(username)).toBe(true);
            }

            const onlineUsers = server.getOnlineUsers();
            expect(onlineUsers.sort()).toEqual(remainingUsers.sort());

            // Очищаем оставшиеся соединения
            mockConnections.forEach(client => {
              if (!usersToDisconnect.includes(client.userId)) {
                server.emit('disconnection', client, 1000, 'Test cleanup');
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 27: Доставка сигнальных сообщений
   * Validates: Requirements 8.2
   * 
   * Сигнальные сообщения должны доставляться целевым пользователям, когда они в сети
   */
  describe('Property 27: Доставка сигнальных сообщений', () => {
    it('should deliver messages to online users and reject for offline users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 2, maxLength: 8 }),
          fc.array(fc.constantFrom('offer', 'answer', 'ice-candidate', 'call-request'), { minLength: 1, maxLength: 5 }),
          async (usernames, messageTypes) => {
            const mockConnections: ClientConnection[] = [];
            const sentMessages: any[] = [];
            
            // Подключаем половину пользователей
            const onlineCount = Math.ceil(usernames.length / 2);
            const onlineUsers = usernames.slice(0, onlineCount);
            const offlineUsers = usernames.slice(onlineCount);

            // Создаем соединения для онлайн пользователей
            for (const username of onlineUsers) {
              const mockWs = new MockWebSocket() as any;
              mockWs.send = jest.fn((data) => {
                sentMessages.push(JSON.parse(data));
              });

              const client: ClientConnection = {
                id: `client_${username}`,
                userId: username,
                ws: mockWs,
                lastPing: Date.now(),
                isAlive: true,
              };

              mockConnections.push(client);
              server.emit('connection', client, { socket: { remoteAddress: '127.0.0.1' } });
            }

            // Отправляем сообщения различных типов
            for (let i = 0; i < messageTypes.length; i++) {
              const messageType = messageTypes[i];
              const fromUser = onlineUsers[i % onlineUsers.length];
              const toUser = usernames[i % usernames.length];
              
              const message = {
                type: messageType,
                from: fromUser,
                to: toUser,
                data: { test: `data-${i}` },
                timestamp: Date.now(),
              };

              const fromClient = mockConnections.find(c => c.userId === fromUser);
              if (fromClient) {
                server.emit('message', fromClient, Buffer.from(JSON.stringify(message)));
              }
            }

            // Проверяем результаты доставки
            const deliveredMessages = sentMessages.filter(msg => 
              messageTypes.includes(msg.type)
            );

            // Сообщения онлайн пользователям должны быть доставлены
            for (let i = 0; i < messageTypes.length; i++) {
              const messageType = messageTypes[i];
              const toUser = usernames[i % usernames.length];
              
              const expectedDelivered = onlineUsers.includes(toUser);
              const actualDelivered = deliveredMessages.some(msg => 
                msg.type === messageType && msg.to === toUser
              );

              if (expectedDelivered) {
                expect(actualDelivered).toBe(true);
              } else {
                // Для офлайн пользователей должны быть отправлены сообщения об ошибке
                const errorMessages = sentMessages.filter(msg => 
                  msg.type === 'user-offline' && msg.userId === toUser
                );
                expect(errorMessages.length).toBeGreaterThan(0);
              }
            }

            // Очищаем соединения
            mockConnections.forEach(client => {
              server.emit('disconnection', client, 1000, 'Test cleanup');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain message ordering for same sender-receiver pair', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 20 }),
          fc.string({ minLength: 3, maxLength: 20 }),
          fc.integer({ min: 5, max: 20 }),
          async (fromUser, toUser, messageCount) => {
            if (fromUser === toUser) return; // Пропускаем если отправитель = получатель

            const mockConnections: ClientConnection[] = [];
            const receivedMessages: any[] = [];
            
            // Создаем соединения для обоих пользователей
            for (const username of [fromUser, toUser]) {
              const mockWs = new MockWebSocket() as any;
              mockWs.send = jest.fn((data) => {
                const message = JSON.parse(data);
                if (message.to === toUser) {
                  receivedMessages.push(message);
                }
              });

              const client: ClientConnection = {
                id: `client_${username}`,
                userId: username,
                ws: mockWs,
                lastPing: Date.now(),
                isAlive: true,
              };

              mockConnections.push(client);
              server.emit('connection', client, { socket: { remoteAddress: '127.0.0.1' } });
            }

            const fromClient = mockConnections.find(c => c.userId === fromUser);

            // Отправляем сообщения в определенном порядке
            const sentTimestamps: number[] = [];
            for (let i = 0; i < messageCount; i++) {
              const timestamp = Date.now() + i;
              sentTimestamps.push(timestamp);

              const message = {
                type: 'offer',
                from: fromUser,
                to: toUser,
                data: { sequence: i },
                timestamp,
              };

              if (fromClient) {
                server.emit('message', fromClient, Buffer.from(JSON.stringify(message)));
              }
            }

            // Проверяем, что порядок сообщений сохранен
            expect(receivedMessages.length).toBe(messageCount);
            
            for (let i = 0; i < receivedMessages.length; i++) {
              expect(receivedMessages[i].data.sequence).toBe(i);
              expect(receivedMessages[i].timestamp).toBe(sentTimestamps[i]);
            }

            // Очищаем соединения
            mockConnections.forEach(client => {
              server.emit('disconnection', client, 1000, 'Test cleanup');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle concurrent message routing correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 2, maxLength: 6 }),
          fc.integer({ min: 1, max: 10 }),
          async (usernames, concurrentMessages) => {
            const mockConnections: ClientConnection[] = [];
            const routingPromises: Promise<boolean>[] = [];
            const routingResults: boolean[] = [];
            
            // Подключаем всех пользователей
            for (const username of usernames) {
              const mockWs = new MockWebSocket() as any;

              const client: ClientConnection = {
                id: `client_${username}`,
                userId: username,
                ws: mockWs,
                lastPing: Date.now(),
                isAlive: true,
              };

              mockConnections.push(client);
              server.emit('connection', client, { socket: { remoteAddress: '127.0.0.1' } });
            }

            // Создаем несколько маршрутизаций одновременно
            for (let i = 0; i < concurrentMessages; i++) {
              const fromUser = usernames[i % usernames.length];
              const toUser = usernames[(i + 1) % usernames.length];
              
              const message = {
                type: 'offer' as const,
                from: fromUser,
                to: toUser,
                data: { concurrentId: i },
                timestamp: Date.now() + i,
              };

              const promise = signalRouter.routeMessage(message);
              routingPromises.push(promise);
            }

            // Ждем завершения всех маршрутизаций
            const results = await Promise.all(routingPromises);
            routingResults.push(...results);

            // Все маршрутизации должны быть успешными (все пользователи онлайн)
            expect(routingResults.length).toBe(concurrentMessages);
            expect(routingResults.every(result => result === true)).toBe(true);

            // Проверяем статистику маршрутизации
            const stats = signalRouter.getStats();
            expect(stats.totalMessages).toBeGreaterThanOrEqual(concurrentMessages);
            expect(stats.successfulRoutes).toBeGreaterThanOrEqual(concurrentMessages);

            // Очищаем соединения
            mockConnections.forEach(client => {
              server.emit('disconnection', client, 1000, 'Test cleanup');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

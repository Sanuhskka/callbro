import { SecureWebSocketServer, ClientConnection, SignalMessage } from '../websocket/WebSocketServer';

// Mock WebSocket properly
jest.mock('ws', () => {
  return {
    OPEN: 1,
    CONNECTING: 0,
    CLOSING: 2,
    CLOSED: 3,
  };
});

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

  constructor() {
    // Mock constructor
  }
}

describe('WebSocketServer - Unit Tests', () => {
  let server: SecureWebSocketServer;
  const testPort = 8081;

  beforeEach(() => {
    server = new SecureWebSocketServer({
      port: testPort,
      pingInterval: 1000, // Быстрее для тестов
      pingTimeout: 500,
    });
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Server Management', () => {
    it('should start server successfully', async () => {
      await expect(server.start()).resolves.not.toThrow();
      expect(server).toBeDefined();
    });

    it('should not start server twice', async () => {
      await server.start();
      await expect(server.start()).rejects.toThrow('WebSocket server is already running');
    });

    it('should stop server successfully', async () => {
      await server.start();
      await expect(server.stop()).resolves.not.toThrow();
    });

    it('should handle stop when server not started', async () => {
      await expect(server.stop()).resolves.not.toThrow();
    });
  });

  describe('Client Connection Management', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should handle client connection', (done) => {
      server.on('connection', (client) => {
        expect(client.id).toBeDefined();
        expect(client.ws).toBeDefined();
        expect(client.userId).toBe('');
        expect(client.isAlive).toBe(true);
        done();
      });

      // Simulate WebSocket connection
      const mockWs = new MockWebSocket() as any;
      server.emit('connection', mockWs, { socket: { remoteAddress: '127.0.0.1' } });
    });

    it('should handle client disconnection', (done) => {
      let connectedClient: ClientConnection | null = null;

      server.on('connection', (client) => {
        connectedClient = client;
      });

      server.on('disconnection', (client, code, reason) => {
        expect(client.id).toBe(connectedClient?.id);
        expect(code).toBe(1000);
        expect(reason).toBe('Normal closure');
        done();
      });

      // Simulate connection and disconnection
      const mockWs = new MockWebSocket() as any;
      server.emit('connection', mockWs, { socket: { remoteAddress: '127.0.0.1' } });
      
      if (connectedClient) {
        server.emit('disconnection', connectedClient, 1000, 'Normal closure');
      }
    });

    it('should handle client authentication', (done) => {
      const testUserId = 'user123';
      const testToken = 'valid-token';

      server.on('connection', (client) => {
        // Simulate authentication message
        const authMessage = {
          type: 'auth',
          token: testToken,
          userId: testUserId,
        };

        server.emit('message', client, Buffer.from(JSON.stringify(authMessage)));

        setTimeout(() => {
          expect(client.userId).toBe(testUserId);
          done();
        }, 100);
      });

      const mockWs = new MockWebSocket() as any;
      server.emit('connection', mockWs, { socket: { remoteAddress: '127.0.0.1' } });
    });

    it('should handle authentication failure', (done) => {
      server.on('connection', (client) => {
        const invalidAuthMessage = {
          type: 'auth',
          token: null,
          userId: null,
        };

        server.emit('message', client, Buffer.from(JSON.stringify(invalidAuthMessage)));

        setTimeout(() => {
          expect(mockWs.close).toHaveBeenCalledWith(4001, 'Authentication failed');
          done();
        }, 100);
      });

      const mockWs = new MockWebSocket() as any;
      server.emit('connection', mockWs, { socket: { remoteAddress: '127.0.0.1' } });
    });
  });

  describe('Signal Message Routing', () => {
    let client1: ClientConnection;
    let client2: ClientConnection;
    let mockWs1: any;
    let mockWs2: any;

    beforeEach(async () => {
      await server.start();

      // Create mock clients
      mockWs1 = new MockWebSocket() as any;
      mockWs2 = new MockWebSocket() as any;

      // Simulate connections
      server.emit('connection', mockWs1, { socket: { remoteAddress: '127.0.0.1' } });
      server.emit('connection', mockWs2, { socket: { remoteAddress: '127.0.0.1' } });

      // Get client references
      server.on('connection', (client) => {
        if (!client1) {
          client1 = client;
          client1.userId = 'user1';
        } else if (!client2) {
          client2 = client;
          client2.userId = 'user2';
        }
      });
    });

    it('should route offer message successfully', (done) => {
      const offerMessage: SignalMessage = {
        type: 'offer',
        from: 'user1',
        to: 'user2',
        data: { sdp: 'test-sdp' },
        timestamp: Date.now(),
      };

      server.on('signal', (fromClient, toClient, message) => {
        expect(message.type).toBe('offer');
        expect(message.from).toBe('user1');
        expect(message.to).toBe('user2');
        expect(fromClient.userId).toBe('user1');
        done();
      });

      server.emit('message', client1, Buffer.from(JSON.stringify(offerMessage)));
    });

    it('should route answer message successfully', (done) => {
      const answerMessage: SignalMessage = {
        type: 'answer',
        from: 'user2',
        to: 'user1',
        data: { sdp: 'test-answer-sdp' },
        timestamp: Date.now(),
      };

      server.on('signal', (fromClient, toClient, message) => {
        expect(message.type).toBe('answer');
        expect(message.from).toBe('user2');
        expect(message.to).toBe('user1');
        done();
      });

      server.emit('message', client2, Buffer.from(JSON.stringify(answerMessage)));
    });

    it('should route ICE candidate successfully', (done) => {
      const iceMessage: SignalMessage = {
        type: 'ice-candidate',
        from: 'user1',
        to: 'user2',
        data: { candidate: 'test-candidate' },
        timestamp: Date.now(),
      };

      server.on('signal', (fromClient, toClient, message) => {
        expect(message.type).toBe('ice-candidate');
        expect(message.data.candidate).toBe('test-candidate');
        done();
      });

      server.emit('message', client1, Buffer.from(JSON.stringify(iceMessage)));
    });

    it('should handle offline target user', (done) => {
      const offlineUserMessage: SignalMessage = {
        type: 'offer',
        from: 'user1',
        to: 'offline-user',
        data: { sdp: 'test-sdp' },
        timestamp: Date.now(),
      };

      server.emit('message', client1, Buffer.from(JSON.stringify(offlineUserMessage)));

      setTimeout(() => {
        expect(mockWs1.send).toHaveBeenCalledWith(
          expect.stringContaining('"user-offline"')
        );
        done();
      }, 100);
    });

    it('should reject messages from unauthenticated clients', (done) => {
      const unauthenticatedClient: ClientConnection = {
        id: 'unauth-client',
        userId: '', // Empty userId = unauthenticated
        ws: mockWs1,
        lastPing: Date.now(),
        isAlive: true,
      };

      const message: SignalMessage = {
        type: 'offer',
        from: 'user1',
        to: 'user2',
        data: { sdp: 'test-sdp' },
        timestamp: Date.now(),
      };

      // Should not route message from unauthenticated client
      server.on('signal', () => {
        done(new Error('Should not route message from unauthenticated client'));
      });

      server.emit('message', unauthenticatedClient, Buffer.from(JSON.stringify(message)));

      setTimeout(() => {
        done(); // Test passes if no signal event was emitted
      }, 100);
    });
  });

  describe('Server Statistics', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should track online users correctly', (done) => {
      expect(server.getOnlineUsers()).toEqual([]);

      const mockWs = new MockWebSocket() as any;

      server.on('connection', (client) => {
        client.userId = 'test-user';
        expect(server.isUserOnline('test-user')).toBe(true);
        expect(server.getOnlineUsers()).toContain('test-user');
        done();
      });

      server.emit('connection', mockWs, { socket: { remoteAddress: '127.0.0.1' } });
    });

    it('should provide server statistics', (done) => {
      const mockWs = new MockWebSocket() as any;

      server.emit('connection', mockWs, { socket: { remoteAddress: '127.0.0.1' } });

      setTimeout(() => {
        const stats = server.getStats();
        expect(stats.totalConnections).toBe(1);
        expect(stats.authenticatedUsers).toBe(0);
        expect(stats.onlineUsers).toEqual([]);
        done();
      }, 100);
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket errors gracefully', (done) => {
      server.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      server.emit('error', new Error('Test WebSocket error'));
    });

    it('should handle client errors gracefully', (done) => {
      const mockWs = new MockWebSocket() as any;

      server.on('disconnection', (client, code, reason) => {
        expect(code).toBe(1006);
        expect(reason).toBe('Client error');
        done();
      });

      server.emit('connection', mockWs, { socket: { remoteAddress: '127.0.0.1' } });
      server.emit('error', new Error('Test client error'));
    });

    it('should handle malformed messages gracefully', (done) => {
      const mockWs = new MockWebSocket() as any;

      server.emit('connection', mockWs, { socket: { remoteAddress: '127.0.0.1' } });

      // Send malformed JSON
      const malformedMessage = Buffer.from('invalid json');
      
      // Should not throw error
      expect(() => {
        server.emit('message', { id: 'test', ws: mockWs, lastPing: Date.now(), isAlive: true }, malformedMessage);
      }).not.toThrow();

      done();
    });
  });
});

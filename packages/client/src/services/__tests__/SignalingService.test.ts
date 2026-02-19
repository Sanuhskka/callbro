import { SignalingService } from '../SignalingService';
import { AuthService } from '../AuthService';

// Mock CloseEvent
class MockCloseEvent extends Event {
  code: number;
  reason: string;
  wasClean: boolean;

  constructor(type: string, options: { code?: number; reason?: string; wasClean?: boolean } = {}) {
    super(type);
    this.code = options.code || 1000;
    this.reason = options.reason || '';
    this.wasClean = options.wasClean !== false;
  }
}

Object.defineProperty(global, 'CloseEvent', {
  value: MockCloseEvent,
  writable: true,
});

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  url: string = '';
  protocol: string = '';
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new MockCloseEvent('close', { code: code || 1000, reason: reason || '' }));
    }
  }

  // Helper method for testing
  simulateMessage(data: string): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  // Helper method for testing connection errors
  simulateError(): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
    if (this.onclose) {
      this.onclose(new MockCloseEvent('close', { code: 1006, reason: 'Connection failed', wasClean: false }));
    }
  }
}

// Mock WebSocket globally
const mockWebSocketClass = jest.fn().mockImplementation((url: string) => {
  const ws = new MockWebSocket(url);
  return ws;
});

Object.defineProperty(global, 'WebSocket', {
  value: mockWebSocketClass,
  writable: true,
});

describe('SignalingService - Unit Tests', () => {
  let signalingService: SignalingService;
  let authService: AuthService;
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    authService = new AuthService('http://localhost:8080');
    
    // Mock authentication
    authService['state'] = {
      isAuthenticated: true,
      user: {
        id: 'user123',
        username: 'testuser',
        createdAt: '2023-01-01T00:00:00Z',
      },
      token: 'mock-token',
      keyPair: {
        publicKey: {
          type: 'public',
          algorithm: { name: 'ECDH', namedCurve: 'P-256' },
          extractable: true,
          usages: [],
        } as CryptoKey,
        privateKey: {
          type: 'private',
          algorithm: { name: 'ECDH', namedCurve: 'P-256' },
          extractable: false,
          usages: ['deriveKey'],
        } as CryptoKey,
      },
    };

    // Reset WebSocket mock
    (global.WebSocket as any).mockClear();
    (global.WebSocket as any).mockInstances = [];

    signalingService = new SignalingService(authService, 'ws://localhost:8080');
    
    // Get the WebSocket instance
    mockWebSocket = (global.WebSocket as any).mock.instances[0] || new MockWebSocket('ws://localhost:8080');
    if ((global.WebSocket as any).mockInstances.length === 0) {
      (global.WebSocket as any).mockInstances.push(mockWebSocket);
    }
  });

  afterEach(() => {
    signalingService.disconnect();
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      const connectionChangeCallback = jest.fn();
      signalingService.onConnectionChange(connectionChangeCallback);

      await signalingService.connect();

      expect(signalingService.isConnectionActive()).toBe(true);
      expect(connectionChangeCallback).toHaveBeenCalledWith(true);
    });

    it('should handle connection failure', async () => {
      // Mock WebSocket to fail
      (global.WebSocket as any).mockImplementation(() => {
        const ws = new MockWebSocket('ws://localhost:8080');
        setTimeout(() => ws.simulateError(), 10);
        return ws;
      });

      await expect(signalingService.connect()).rejects.toThrow('WebSocket connection failed');
      expect(signalingService.isConnectionActive()).toBe(false);
    });

    it('should disconnect properly', async () => {
      await signalingService.connect();
      expect(signalingService.isConnectionActive()).toBe(true);

      signalingService.disconnect();
      expect(signalingService.isConnectionActive()).toBe(false);
    });

    it('should fail to connect without authentication token', async () => {
      authService['state'].token = null;

      await expect(signalingService.connect()).rejects.toThrow('Authentication token not available');
    });

    it('should fail to connect without user', async () => {
      authService['state'].user = null;

      await expect(signalingService.connect()).rejects.toThrow('User not authenticated');
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      await signalingService.connect();
    });

    it('should send offer message', async () => {
      const offer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'mock-sdp-offer',
      };

      await signalingService.sendOffer('user456', offer);

      expect(mockWebSocket.sentMessages).toHaveLength(1);
      const sentMessage = JSON.parse(mockWebSocket.sentMessages[0]);
      expect(sentMessage.type).toBe('offer');
      expect(sentMessage.fromUserId).toBe('user123');
      expect(sentMessage.toUserId).toBe('user456');
      expect(sentMessage.payload).toEqual(offer);
    });

    it('should send answer message', async () => {
      const answer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: 'mock-sdp-answer',
      };

      await signalingService.sendAnswer('user456', answer);

      expect(mockWebSocket.sentMessages).toHaveLength(1);
      const sentMessage = JSON.parse(mockWebSocket.sentMessages[0]);
      expect(sentMessage.type).toBe('answer');
      expect(sentMessage.fromUserId).toBe('user123');
      expect(sentMessage.toUserId).toBe('user456');
      expect(sentMessage.payload).toEqual(answer);
    });

    it('should send ICE candidate message', async () => {
      const candidate: RTCIceCandidateInit = {
        candidate: 'mock-candidate',
        sdpMLineIndex: 0,
        sdpMid: '0',
      };

      await signalingService.sendIceCandidate('user456', candidate);

      expect(mockWebSocket.sentMessages).toHaveLength(1);
      const sentMessage = JSON.parse(mockWebSocket.sentMessages[0]);
      expect(sentMessage.type).toBe('ice-candidate');
      expect(sentMessage.fromUserId).toBe('user123');
      expect(sentMessage.toUserId).toBe('user456');
      expect(sentMessage.payload).toEqual(candidate);
    });

    it('should send call request', async () => {
      const callId = await signalingService.sendCallRequest('user456', 'video');

      expect(mockWebSocket.sentMessages).toHaveLength(1);
      const sentMessage = JSON.parse(mockWebSocket.sentMessages[0]);
      expect(sentMessage.type).toBe('call');
      expect(sentMessage.fromUserId).toBe('user123');
      expect(sentMessage.toUserId).toBe('user456');
      expect(sentMessage.payload.callType).toBe('video');
      expect(sentMessage.payload.callId).toBeDefined();
      expect(callId).toBe(sentMessage.payload.payload.callId);
    });

    it('should send hangup message', async () => {
      await signalingService.sendHangup('user456', 'call123');

      expect(mockWebSocket.sentMessages).toHaveLength(1);
      const sentMessage = JSON.parse(mockWebSocket.sentMessages[0]);
      expect(sentMessage.type).toBe('hangup');
      expect(sentMessage.fromUserId).toBe('user123');
      expect(sentMessage.toUserId).toBe('user456');
      expect(sentMessage.payload.callId).toBe('call123');
    });

    it('should queue messages when not connected', async () => {
      signalingService.disconnect();

      const offer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'mock-sdp-offer',
      };

      await expect(signalingService.sendOffer('user456', offer)).rejects.toThrow('Not connected to signaling server');

      // Reconnect and check if message is processed
      await signalingService.connect();
      
      // Give some time for queue processing
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockWebSocket.sentMessages).toHaveLength(1);
    });
  });

  describe('Message Receiving', () => {
    beforeEach(async () => {
      await signalingService.connect();
    });

    it('should handle incoming call', async () => {
      const incomingCallCallback = jest.fn();
      signalingService.onIncomingCall(incomingCallCallback);

      const callMessage = {
        type: 'call',
        fromUserId: 'user456',
        toUserId: 'user123',
        payload: {
          callId: 'call123',
          callType: 'video',
        },
        timestamp: Date.now(),
      };

      mockWebSocket.simulateMessage(JSON.stringify(callMessage));

      expect(incomingCallCallback).toHaveBeenCalledWith({
        callId: 'call123',
        fromUserId: 'user456',
        toUserId: 'user123',
        callType: 'video',
        timestamp: callMessage.timestamp,
      });
    });

    it('should handle incoming offer', async () => {
      const offerCallback = jest.fn();
      signalingService.onOffer(offerCallback);

      const offerMessage = {
        type: 'offer',
        fromUserId: 'user456',
        toUserId: 'user123',
        payload: {
          type: 'offer',
          sdp: 'mock-sdp-offer',
        },
        timestamp: Date.now(),
      };

      mockWebSocket.simulateMessage(JSON.stringify(offerMessage));

      expect(offerCallback).toHaveBeenCalledWith('user456', {
        type: 'offer',
        sdp: 'mock-sdp-offer',
      });
    });

    it('should handle incoming answer', async () => {
      const answerCallback = jest.fn();
      signalingService.onAnswer(answerCallback);

      const answerMessage = {
        type: 'answer',
        fromUserId: 'user456',
        toUserId: 'user123',
        payload: {
          type: 'answer',
          sdp: 'mock-sdp-answer',
        },
        timestamp: Date.now(),
      };

      mockWebSocket.simulateMessage(JSON.stringify(answerMessage));

      expect(answerCallback).toHaveBeenCalledWith('user456', {
        type: 'answer',
        sdp: 'mock-sdp-answer',
      });
    });

    it('should handle incoming ICE candidate', async () => {
      const iceCandidateCallback = jest.fn();
      signalingService.onIceCandidate(iceCandidateCallback);

      const iceMessage = {
        type: 'ice-candidate',
        fromUserId: 'user456',
        toUserId: 'user123',
        payload: {
          candidate: 'mock-candidate',
          sdpMLineIndex: 0,
          sdpMid: '0',
        },
        timestamp: Date.now(),
      };

      mockWebSocket.simulateMessage(JSON.stringify(iceMessage));

      expect(iceCandidateCallback).toHaveBeenCalledWith('user456', {
        candidate: 'mock-candidate',
        sdpMLineIndex: 0,
        sdpMid: '0',
      });
    });

    it('should handle hangup', async () => {
      const hangupCallback = jest.fn();
      signalingService.onHangup(hangupCallback);

      const hangupMessage = {
        type: 'hangup',
        fromUserId: 'user456',
        toUserId: 'user123',
        payload: {
          callId: 'call123',
        },
        timestamp: Date.now(),
      };

      mockWebSocket.simulateMessage(JSON.stringify(hangupMessage));

      expect(hangupCallback).toHaveBeenCalledWith('user456');
    });

    it('should handle ping and send pong', async () => {
      const pingMessage = {
        type: 'ping',
        fromUserId: 'server',
        toUserId: 'user123',
        timestamp: Date.now(),
      };

      mockWebSocket.simulateMessage(JSON.stringify(pingMessage));

      expect(mockWebSocket.sentMessages).toHaveLength(1);
      const pongMessage = JSON.parse(mockWebSocket.sentMessages[0]);
      expect(pongMessage.type).toBe('pong');
      expect(pongMessage.fromUserId).toBe('user123');
      expect(pongMessage.toUserId).toBe('server');
    });

    it('should handle malformed messages', async () => {
      const errorCallback = jest.fn();
      signalingService.onError(errorCallback);

      mockWebSocket.simulateMessage('invalid json');

      expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Event Listeners', () => {
    beforeEach(async () => {
      await signalingService.connect();
    });

    it('should manage connection change listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      signalingService.onConnectionChange(callback1);
      signalingService.onConnectionChange(callback2);

      signalingService.disconnect();

      expect(callback1).toHaveBeenCalledWith(false);
      expect(callback2).toHaveBeenCalledWith(false);

      signalingService.removeAllListeners();
      signalingService.disconnect();

      // Should not call callbacks after removal
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in callbacks gracefully', async () => {
      const errorCallback = jest.fn();
      signalingService.onError(errorCallback);

      // Add callback that throws error
      signalingService.onIncomingCall(() => {
        throw new Error('Callback error');
      });

      const callMessage = {
        type: 'call',
        fromUserId: 'user456',
        toUserId: 'user123',
        payload: { callId: 'call123', callType: 'video' },
        timestamp: Date.now(),
      };

      // Should not throw, but should log error
      expect(() => {
        mockWebSocket.simulateMessage(JSON.stringify(callMessage));
      }).not.toThrow();
    });
  });

  describe('Reconnection', () => {
    it('should attempt reconnection on unexpected disconnect', async () => {
      const connectionChangeCallback = jest.fn();
      signalingService.onConnectionChange(connectionChangeCallback);

      await signalingService.connect();

      // Simulate unexpected disconnect
      mockWebSocket.close(1006, 'Connection lost');

      // Should attempt reconnection
      expect(connectionChangeCallback).toHaveBeenCalledWith(false);

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should reconnect
      expect(signalingService.isConnectionActive()).toBe(true);
      expect(connectionChangeCallback).toHaveBeenCalledWith(true);
    });

    it('should respect max retry attempts', async () => {
      signalingService.setReconnectConfig({
        maxRetries: 2,
        initialDelay: 10,
        maxDelay: 50,
        backoffFactor: 1.5,
      });

      const errorCallback = jest.fn();
      signalingService.onError(errorCallback);

      await signalingService.connect();

      // Mock WebSocket to always fail
      (global.WebSocket as any).mockImplementation(() => {
        const ws = new MockWebSocket('ws://localhost:8080');
        setTimeout(() => ws.simulateError(), 5);
        return ws;
      });

      // Simulate disconnect
      mockWebSocket.close(1006, 'Connection lost');

      // Wait for retry attempts
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Configuration', () => {
    it('should allow custom reconnection config', () => {
      const customConfig = {
        maxRetries: 5,
        initialDelay: 500,
        maxDelay: 10000,
        backoffFactor: 1.5,
      };

      signalingService.setReconnectConfig(customConfig);

      // Config should be updated (private property, but we can test behavior)
      expect(() => signalingService.setReconnectConfig(customConfig)).not.toThrow();
    });
  });
});

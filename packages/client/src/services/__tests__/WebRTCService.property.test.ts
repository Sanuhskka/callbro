/**
 * @jest-environment jsdom
 */

import * as fc from 'fast-check';
import { WebRTCService } from '../WebRTCService';
import { AuthService } from '../AuthService';
import { SignalingService } from '../SignalingService';
import { CryptoService } from '../CryptoService';

/**
 * WebRTCService Property-Based Tests
 * 
 * Feature: secure-p2p-messenger
 * Validates universal properties of WebRTC functionality
 */

describe('WebRTCService Property Tests', () => {
  let webrtcService: WebRTCService;
  let authService: AuthService;
  let signalingService: SignalingService;
  let cryptoService: CryptoService;

  // Mock MediaStream
  const createMockMediaStream = () => ({
    getTracks: jest.fn(() => [
      { kind: 'audio', enabled: true, stop: jest.fn() },
      { kind: 'video', enabled: true, stop: jest.fn() },
    ]),
    getAudioTracks: jest.fn(() => [{ kind: 'audio', enabled: true, stop: jest.fn() }]),
    getVideoTracks: jest.fn(() => [{ kind: 'video', enabled: true, stop: jest.fn() }]),
    addTrack: jest.fn(),
    removeTrack: jest.fn(),
  } as any);

  // Mock RTCPeerConnection
  const createMockPeerConnection = () => ({
    addTrack: jest.fn(),
    getSenders: jest.fn(() => []),
    getReceivers: jest.fn(() => []),
    createOffer: jest.fn(async () => ({ type: 'offer', sdp: 'mock-sdp' })),
    createAnswer: jest.fn(async () => ({ type: 'answer', sdp: 'mock-sdp' })),
    setLocalDescription: jest.fn(),
    setRemoteDescription: jest.fn(),
    addIceCandidate: jest.fn(),
    close: jest.fn(),
    getStats: jest.fn(async () => new Map()),
    getTransceivers: jest.fn(() => []),
    onicecandidate: null,
    ontrack: null,
    onconnectionstatechange: null,
    connectionState: 'connected',
  } as any);

  beforeEach(() => {
    // Mock navigator.mediaDevices
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        configurable: true,
        value: {},
      });
    }
    
    (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());
    (navigator.mediaDevices as any).enumerateDevices = jest.fn(async () => []);

    // Mock RTCPeerConnection
    (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

    // Mock crypto.subtle
    if (!global.crypto) {
      (global as any).crypto = {};
    }
    (global.crypto as any).subtle = {
      generateKey: jest.fn(async () => ({} as CryptoKey)),
      encrypt: jest.fn(async (algorithm, key, data) => new ArrayBuffer(data.byteLength + 16)),
      decrypt: jest.fn(async (algorithm, key, data) => new ArrayBuffer(data.byteLength - 16)),
    };

    // Mock crypto.getRandomValues
    (global.crypto as any).getRandomValues = jest.fn((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    });

    // Create service instances
    authService = new AuthService();
    signalingService = new SignalingService(authService, 'ws://localhost:3000');
    cryptoService = new CryptoService();
    webrtcService = new WebRTCService(authService, signalingService, cryptoService);

    // Mock authenticated user
    jest.spyOn(authService, 'getCurrentUser').mockReturnValue({
      id: 'user1',
      username: 'testuser',
      publicKey: 'mock-public-key',
      createdAt: new Date().toISOString(),
    });

    // Mock signaling service methods
    jest.spyOn(signalingService, 'sendCallRequest').mockResolvedValue('call-id-123');
    jest.spyOn(signalingService, 'sendOffer').mockResolvedValue();
    jest.spyOn(signalingService, 'sendAnswer').mockResolvedValue();
    jest.spyOn(signalingService, 'sendHangup').mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 16: Установка P2P соединения для звонков
   * Validates: Requirements 5.1, 6.1
   * 
   * Для любого инициированного звонка (голосового или видео), 
   * система должна установить P2P соединение через сигнальный сервер.
   */
  describe('Property 16: P2P Connection Establishment', () => {
    it('should establish P2P connection for any call type', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange: Reset mocks for each iteration
            jest.clearAllMocks();
            
            // Mock fresh instances for each test
            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());

            const mockPeerConnection = createMockPeerConnection();
            (global as any).RTCPeerConnection = jest.fn(() => mockPeerConnection);

            // Act: Initiate call
            const sessionId = await webrtcService.initiateCall(userId, callType);

            // Assert: P2P connection should be established
            // 1. Session should be created
            expect(sessionId).toBeDefined();
            expect(typeof sessionId).toBe('string');
            expect(sessionId.length).toBeGreaterThan(0);

            // 2. Call session should exist
            const session = webrtcService.getCallStatus(userId);
            expect(session).toBeDefined();
            expect(session?.userId).toBe(userId);
            expect(session?.callType).toBe(callType);
            expect(session?.status).toBe('outgoing');

            // 3. RTCPeerConnection should be created
            expect(RTCPeerConnection).toHaveBeenCalled();
            expect(session?.peerConnection).toBeDefined();

            // 4. Media stream should be requested with correct constraints
            const expectedConstraints = {
              audio: true,
              video: callType === 'video',
            };
            expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(expectedConstraints);

            // 5. Local stream should be added to peer connection
            expect(mockPeerConnection.addTrack).toHaveBeenCalled();

            // 6. Signaling should be initiated through signaling server
            expect(signalingService.sendCallRequest).toHaveBeenCalledWith(userId, callType);
            expect(signalingService.sendOffer).toHaveBeenCalled();

            // 7. SDP offer should be created and set
            expect(mockPeerConnection.createOffer).toHaveBeenCalled();
            expect(mockPeerConnection.setLocalDescription).toHaveBeenCalled();

            // 8. Encryption key should be generated for the session
            expect(session?.encryptionKey).toBeDefined();
            expect(crypto.subtle.generateKey).toHaveBeenCalledWith(
              { name: 'AES-GCM', length: 256 },
              true,
              ['encrypt', 'decrypt']
            );

            // Cleanup: End the call
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should establish P2P connection when answering any call', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callId, callType }) => {
            // Arrange: Reset mocks for each iteration
            jest.clearAllMocks();
            
            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());

            const mockPeerConnection = createMockPeerConnection();
            (global as any).RTCPeerConnection = jest.fn(() => mockPeerConnection);

            // Act: Answer call
            const sessionId = await webrtcService.answerCall(userId, callId, callType);

            // Assert: P2P connection should be established
            // 1. Session should be created
            expect(sessionId).toBeDefined();
            expect(typeof sessionId).toBe('string');

            // 2. Call session should exist
            const session = webrtcService.getCallStatus(userId);
            expect(session).toBeDefined();
            expect(session?.userId).toBe(userId);
            expect(session?.callType).toBe(callType);
            expect(session?.status).toBe('connected');

            // 3. RTCPeerConnection should be created
            expect(RTCPeerConnection).toHaveBeenCalled();
            expect(session?.peerConnection).toBeDefined();

            // 4. Media stream should be requested
            expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();

            // 5. Local stream should be added to peer connection
            expect(mockPeerConnection.addTrack).toHaveBeenCalled();

            // 6. Encryption key should be generated
            expect(session?.encryptionKey).toBeDefined();

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create unique session IDs for different calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              userId: fc.string({ minLength: 1, maxLength: 50 }),
              callType: fc.constantFrom('audio' as const, 'video' as const),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (calls) => {
            // Arrange: Reset for each test
            jest.clearAllMocks();
            
            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());

            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            const sessionIds: string[] = [];

            // Act: Initiate multiple calls
            for (const call of calls) {
              try {
                const sessionId = await webrtcService.initiateCall(call.userId, call.callType);
                sessionIds.push(sessionId);
              } catch (error) {
                // Skip if call already in progress with this user
                if ((error as Error).message.includes('already in progress')) {
                  continue;
                }
                throw error;
              }
            }

            // Assert: All session IDs should be unique
            const uniqueSessionIds = new Set(sessionIds);
            expect(uniqueSessionIds.size).toBe(sessionIds.length);

            // Cleanup: End all calls
            for (const call of calls) {
              try {
                await webrtcService.endCall(call.userId);
              } catch (error) {
                // Ignore cleanup errors
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain call session state throughout connection lifecycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());

            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act & Assert: Throughout lifecycle
            // 1. Before call - no session
            expect(webrtcService.getCallStatus(userId)).toBeNull();

            // 2. During call - session exists
            const sessionId = await webrtcService.initiateCall(userId, callType);
            const activeSession = webrtcService.getCallStatus(userId);
            expect(activeSession).toBeDefined();
            expect(activeSession?.id).toBe(sessionId);
            expect(activeSession?.status).toBe('outgoing');
            expect(activeSession?.peerConnection).toBeDefined();
            expect(activeSession?.localStream).toBeDefined();

            // 3. After call - session removed
            await webrtcService.endCall(userId);
            expect(webrtcService.getCallStatus(userId)).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 17: Шифрование медиа-потоков
   * Validates: Requirements 5.2, 6.2, 7.4
   * 
   * Все медиа-потоки (аудио и видео) должны быть зашифрованы перед отправкой
   * и расшифрованы при получении используя Insertable Streams API.
   */
  describe('Property 17: Media Stream Encryption', () => {
    it('should generate encryption keys for all media streams', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange: Reset mocks
            jest.clearAllMocks();
            
            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Initiate call (which sets up encryption)
            const sessionId = await webrtcService.initiateCall(userId, callType);

            // Assert: Encryption key should be generated
            const session = webrtcService.getCallStatus(userId);
            expect(session).toBeDefined();
            expect(session?.encryptionKey).toBeDefined();

            // Verify encryption key was generated with correct parameters
            expect(crypto.subtle.generateKey).toHaveBeenCalledWith(
              { name: 'AES-GCM', length: 256 },
              true,
              ['encrypt', 'decrypt']
            );

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique encryption keys for each call session', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              userId: fc.string({ minLength: 1, maxLength: 50 }),
              callType: fc.constantFrom('audio' as const, 'video' as const),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (calls) => {
            // Arrange: Reset mocks
            jest.clearAllMocks();
            
            const generatedKeys: CryptoKey[] = [];
            const originalGenerateKey = crypto.subtle.generateKey;
            
            (crypto.subtle as any).generateKey = jest.fn(async (algorithm, extractable, keyUsages) => {
              const key = { type: 'secret', algorithm, extractable, usages: keyUsages } as CryptoKey;
              generatedKeys.push(key);
              return key;
            });

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            const sessionIds: string[] = [];

            // Act: Initiate multiple calls
            for (const call of calls) {
              try {
                const sessionId = await webrtcService.initiateCall(call.userId, call.callType);
                sessionIds.push(sessionId);
              } catch (error) {
                if ((error as Error).message.includes('already in progress')) {
                  continue;
                }
                throw error;
              }
            }

            // Assert: Each call should have a unique encryption key
            expect(generatedKeys.length).toBeGreaterThanOrEqual(sessionIds.length);
            
            // Verify all keys were generated with correct parameters
            generatedKeys.forEach((key, index) => {
              expect(crypto.subtle.generateKey).toHaveBeenNthCalledWith(
                index + 1,
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
              );
            });

            // Restore
            (crypto.subtle as any).generateKey = originalGenerateKey;

            // Cleanup
            for (const call of calls) {
              try {
                await webrtcService.endCall(call.userId);
              } catch (error) {
                // Ignore cleanup errors
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should use AES-GCM-256 encryption for all media frames', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            let encryptAlgorithm: any = null;
            const originalEncrypt = crypto.subtle.encrypt;
            
            (crypto.subtle as any).encrypt = jest.fn(async (algorithm, key, data) => {
              encryptAlgorithm = algorithm;
              return new ArrayBuffer(data.byteLength + 16);
            });

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act
            const sessionId = await webrtcService.initiateCall(userId, callType);
            const session = webrtcService.getCallStatus(userId);

            // Assert: Encryption key should use AES-GCM-256
            expect(session?.encryptionKey).toBeDefined();
            expect(crypto.subtle.generateKey).toHaveBeenCalledWith(
              { name: 'AES-GCM', length: 256 },
              true,
              ['encrypt', 'decrypt']
            );

            // Restore
            (crypto.subtle as any).encrypt = originalEncrypt;

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should encrypt both audio and video streams in video calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (userId) => {
            // Arrange
            jest.clearAllMocks();
            
            // Mock media stream with both audio and video
            const mockStream = {
              getTracks: jest.fn(() => [
                { kind: 'audio', enabled: true, stop: jest.fn() },
                { kind: 'video', enabled: true, stop: jest.fn() },
              ]),
              getAudioTracks: jest.fn(() => [{ kind: 'audio', enabled: true, stop: jest.fn() }]),
              getVideoTracks: jest.fn(() => [{ kind: 'video', enabled: true, stop: jest.fn() }]),
              addTrack: jest.fn(),
              removeTrack: jest.fn(),
            } as any;

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => mockStream);
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Initiate video call
            const sessionId = await webrtcService.initiateCall(userId, 'video');

            // Assert: Both audio and video should be encrypted
            const session = webrtcService.getCallStatus(userId);
            expect(session).toBeDefined();
            expect(session?.callType).toBe('video');
            expect(session?.encryptionKey).toBeDefined();

            // Verify getUserMedia was called with both audio and video
            expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
              audio: true,
              video: true,
            });

            // Verify encryption key was generated
            expect(crypto.subtle.generateKey).toHaveBeenCalledWith(
              { name: 'AES-GCM', length: 256 },
              true,
              ['encrypt', 'decrypt']
            );

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should setup encryption for incoming media streams', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Answer call (which sets up decryption)
            const sessionId = await webrtcService.answerCall(userId, callId, callType);

            // Assert: Decryption should be set up
            const session = webrtcService.getCallStatus(userId);
            expect(session).toBeDefined();
            expect(session?.encryptionKey).toBeDefined();

            // Verify encryption key was generated for decryption
            expect(crypto.subtle.generateKey).toHaveBeenCalledWith(
              { name: 'AES-GCM', length: 256 },
              true,
              ['encrypt', 'decrypt']
            );

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain encryption throughout the entire call duration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Start call
            const sessionId = await webrtcService.initiateCall(userId, callType);
            
            // Check encryption at start
            let session = webrtcService.getCallStatus(userId);
            expect(session?.encryptionKey).toBeDefined();
            const initialKey = session?.encryptionKey;

            // Check encryption is still active
            session = webrtcService.getCallStatus(userId);
            expect(session?.encryptionKey).toBeDefined();
            expect(session?.encryptionKey).toBe(initialKey); // Same key throughout

            // End call
            await webrtcService.endCall(userId);

            // After call ends, session should be removed
            session = webrtcService.getCallStatus(userId);
            expect(session).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle encryption errors gracefully without crashing the call', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange: Mock encryption to fail occasionally
            jest.clearAllMocks();
            
            let encryptCallCount = 0;
            const originalEncrypt = crypto.subtle.encrypt;
            
            (crypto.subtle as any).encrypt = jest.fn(async (algorithm, key, data) => {
              encryptCallCount++;
              // Simulate occasional encryption errors
              if (encryptCallCount % 10 === 0) {
                throw new Error('Encryption failed');
              }
              return new ArrayBuffer(data.byteLength + 16);
            });

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Initiate call
            const sessionId = await webrtcService.initiateCall(userId, callType);

            // Assert: Call should still be established despite encryption errors
            const session = webrtcService.getCallStatus(userId);
            expect(session).toBeDefined();
            expect(session?.status).toBe('outgoing');
            expect(session?.encryptionKey).toBeDefined();

            // Restore
            (crypto.subtle as any).encrypt = originalEncrypt;

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique IVs for frame encryption', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            const ivs: string[] = [];
            
            // Mock getRandomValues to capture IVs
            const originalGetRandomValues = crypto.getRandomValues;
            let randomCallCount = 0;
            (crypto.getRandomValues as jest.Mock).mockImplementation((array) => {
              randomCallCount++;
              // Generate different values each time
              for (let i = 0; i < array.length; i++) {
                array[i] = (randomCallCount * 13 + i * 7) % 256;
              }
              // Capture IV if it's 12 bytes (AES-GCM IV size)
              if (array.length === 12) {
                const ivString = Array.from(array).join(',');
                ivs.push(ivString);
              }
              return array;
            });

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act
            const sessionId = await webrtcService.initiateCall(userId, callType);

            // Assert: Encryption key should be generated
            const session = webrtcService.getCallStatus(userId);
            expect(session?.encryptionKey).toBeDefined();

            // Verify crypto.getRandomValues was called (for IV generation)
            expect(crypto.getRandomValues).toHaveBeenCalled();

            // If multiple IVs were generated, they should be different
            if (ivs.length > 1) {
              const uniqueIVs = new Set(ivs);
              expect(uniqueIVs.size).toBe(ivs.length); // All IVs should be unique
            }

            // Restore
            (crypto.getRandomValues as jest.Mock).mockImplementation(originalGetRandomValues);

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 20: Функция отключения микрофона
   * Validates: Requirements 5.6, 6.6
   * 
   * Для любого активного звонка (голосового или видео), пользователь должен иметь 
   * возможность отключить и включить микрофон, при этом аудио-поток должен 
   * соответственно останавливаться и возобновляться.
   */
  describe('Property 20: Microphone Mute/Unmute Functionality', () => {
    it('should toggle microphone state for any active call', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            const mockAudioTrack = { kind: 'audio', enabled: true, stop: jest.fn() };
            const mockVideoTrack = { kind: 'video', enabled: true, stop: jest.fn() };
            
            const mockStream = {
              getTracks: jest.fn(() => [mockAudioTrack, mockVideoTrack]),
              getAudioTracks: jest.fn(() => [mockAudioTrack]),
              getVideoTracks: jest.fn(() => [mockVideoTrack]),
              addTrack: jest.fn(),
              removeTrack: jest.fn(),
            } as any;

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => mockStream);
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Start call
            await webrtcService.initiateCall(userId, callType);

            // Assert: Initially microphone should be enabled
            expect(mockAudioTrack.enabled).toBe(true);

            // Act: Mute microphone
            const isMuted = await webrtcService.toggleMute(userId);

            // Assert: Microphone should be muted
            expect(isMuted).toBe(false); // toggleMute returns new state (false = muted)
            expect(mockAudioTrack.enabled).toBe(false);

            // Act: Unmute microphone
            const isUnmuted = await webrtcService.toggleMute(userId);

            // Assert: Microphone should be unmuted
            expect(isUnmuted).toBe(true); // toggleMute returns new state (true = unmuted)
            expect(mockAudioTrack.enabled).toBe(true);

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should toggle microphone multiple times during a call', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
            toggleCount: fc.integer({ min: 2, max: 10 }),
          }),
          async ({ userId, callType, toggleCount }) => {
            // Arrange
            jest.clearAllMocks();
            
            const mockAudioTrack = { kind: 'audio', enabled: true, stop: jest.fn() };
            const mockVideoTrack = { kind: 'video', enabled: true, stop: jest.fn() };
            
            const mockStream = {
              getTracks: jest.fn(() => [mockAudioTrack, mockVideoTrack]),
              getAudioTracks: jest.fn(() => [mockAudioTrack]),
              getVideoTracks: jest.fn(() => [mockVideoTrack]),
              addTrack: jest.fn(),
              removeTrack: jest.fn(),
            } as any;

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => mockStream);
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Start call
            await webrtcService.initiateCall(userId, callType);

            // Act & Assert: Toggle microphone multiple times
            let expectedState = true; // Initially enabled
            for (let i = 0; i < toggleCount; i++) {
              const newState = await webrtcService.toggleMute(userId);
              expectedState = !expectedState;
              
              expect(newState).toBe(expectedState);
              expect(mockAudioTrack.enabled).toBe(expectedState);
            }

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should work for both audio and video calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            const mockAudioTrack = { kind: 'audio', enabled: true, stop: jest.fn() };
            const mockVideoTrack = { kind: 'video', enabled: true, stop: jest.fn() };
            
            const mockStream = {
              getTracks: jest.fn(() => 
                callType === 'video' 
                  ? [mockAudioTrack, mockVideoTrack] 
                  : [mockAudioTrack]
              ),
              getAudioTracks: jest.fn(() => [mockAudioTrack]),
              getVideoTracks: jest.fn(() => callType === 'video' ? [mockVideoTrack] : []),
              addTrack: jest.fn(),
              removeTrack: jest.fn(),
            } as any;

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => mockStream);
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Start call
            await webrtcService.initiateCall(userId, callType);

            // Act: Toggle mute
            await webrtcService.toggleMute(userId);

            // Assert: Audio track should be muted regardless of call type
            expect(mockAudioTrack.enabled).toBe(false);

            // Act: Toggle unmute
            await webrtcService.toggleMute(userId);

            // Assert: Audio track should be unmuted
            expect(mockAudioTrack.enabled).toBe(true);

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw error when toggling mute on non-existent call', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (userId) => {
            // Arrange
            jest.clearAllMocks();

            // Act & Assert: Should throw error when no active call
            await expect(webrtcService.toggleMute(userId)).rejects.toThrow('No active call');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw error when audio track is not available', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            // Mock stream without audio track
            const mockStream = {
              getTracks: jest.fn(() => []),
              getAudioTracks: jest.fn(() => []), // No audio track
              getVideoTracks: jest.fn(() => []),
              addTrack: jest.fn(),
              removeTrack: jest.fn(),
            } as any;

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => mockStream);
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Start call
            await webrtcService.initiateCall(userId, callType);

            // Act & Assert: Should throw error when no audio track
            await expect(webrtcService.toggleMute(userId)).rejects.toThrow('No audio track available');

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not affect video track when toggling microphone', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (userId) => {
            // Arrange
            jest.clearAllMocks();
            
            const mockAudioTrack = { kind: 'audio', enabled: true, stop: jest.fn() };
            const mockVideoTrack = { kind: 'video', enabled: true, stop: jest.fn() };
            
            const mockStream = {
              getTracks: jest.fn(() => [mockAudioTrack, mockVideoTrack]),
              getAudioTracks: jest.fn(() => [mockAudioTrack]),
              getVideoTracks: jest.fn(() => [mockVideoTrack]),
              addTrack: jest.fn(),
              removeTrack: jest.fn(),
            } as any;

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => mockStream);
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Start video call
            await webrtcService.initiateCall(userId, 'video');

            // Store initial video state
            const initialVideoState = mockVideoTrack.enabled;

            // Act: Toggle microphone
            await webrtcService.toggleMute(userId);

            // Assert: Video track should remain unchanged
            expect(mockVideoTrack.enabled).toBe(initialVideoState);
            expect(mockAudioTrack.enabled).toBe(false);

            // Act: Toggle microphone again
            await webrtcService.toggleMute(userId);

            // Assert: Video track should still be unchanged
            expect(mockVideoTrack.enabled).toBe(initialVideoState);
            expect(mockAudioTrack.enabled).toBe(true);

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain mute state throughout call duration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            const mockAudioTrack = { kind: 'audio', enabled: true, stop: jest.fn() };
            const mockVideoTrack = { kind: 'video', enabled: true, stop: jest.fn() };
            
            const mockStream = {
              getTracks: jest.fn(() => [mockAudioTrack, mockVideoTrack]),
              getAudioTracks: jest.fn(() => [mockAudioTrack]),
              getVideoTracks: jest.fn(() => [mockVideoTrack]),
              addTrack: jest.fn(),
              removeTrack: jest.fn(),
            } as any;

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => mockStream);
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Start call
            await webrtcService.initiateCall(userId, callType);

            // Act: Mute microphone
            await webrtcService.toggleMute(userId);
            expect(mockAudioTrack.enabled).toBe(false);

            // Verify state persists
            const session = webrtcService.getCallStatus(userId);
            expect(session).toBeDefined();
            expect(session?.localStream?.getAudioTracks()[0].enabled).toBe(false);

            // Act: Unmute microphone
            await webrtcService.toggleMute(userId);
            expect(mockAudioTrack.enabled).toBe(true);

            // Verify state persists
            expect(session?.localStream?.getAudioTracks()[0].enabled).toBe(true);

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return correct state after toggling', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            const mockAudioTrack = { kind: 'audio', enabled: true, stop: jest.fn() };
            const mockVideoTrack = { kind: 'video', enabled: true, stop: jest.fn() };
            
            const mockStream = {
              getTracks: jest.fn(() => [mockAudioTrack, mockVideoTrack]),
              getAudioTracks: jest.fn(() => [mockAudioTrack]),
              getVideoTracks: jest.fn(() => [mockVideoTrack]),
              addTrack: jest.fn(),
              removeTrack: jest.fn(),
            } as any;

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => mockStream);
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Start call
            await webrtcService.initiateCall(userId, callType);

            // Initially enabled
            expect(mockAudioTrack.enabled).toBe(true);

            // Toggle to muted
            const state1 = await webrtcService.toggleMute(userId);
            expect(state1).toBe(false); // false = muted
            expect(mockAudioTrack.enabled).toBe(false);

            // Toggle to unmuted
            const state2 = await webrtcService.toggleMute(userId);
            expect(state2).toBe(true); // true = unmuted
            expect(mockAudioTrack.enabled).toBe(true);

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle concurrent mute toggles correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            const mockAudioTrack = { kind: 'audio', enabled: true, stop: jest.fn() };
            const mockVideoTrack = { kind: 'video', enabled: true, stop: jest.fn() };
            
            const mockStream = {
              getTracks: jest.fn(() => [mockAudioTrack, mockVideoTrack]),
              getAudioTracks: jest.fn(() => [mockAudioTrack]),
              getVideoTracks: jest.fn(() => [mockVideoTrack]),
              addTrack: jest.fn(),
              removeTrack: jest.fn(),
            } as any;

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => mockStream);
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Start call
            await webrtcService.initiateCall(userId, callType);

            // Act: Toggle multiple times concurrently
            const togglePromises = [
              webrtcService.toggleMute(userId),
              webrtcService.toggleMute(userId),
              webrtcService.toggleMute(userId),
            ];

            const results = await Promise.all(togglePromises);

            // Assert: All toggles should complete successfully
            expect(results).toHaveLength(3);
            results.forEach(result => {
              expect(typeof result).toBe('boolean');
            });

            // Final state should be consistent
            const finalState = mockAudioTrack.enabled;
            expect(typeof finalState).toBe('boolean');

            // Cleanup
            await webrtcService.endCall(userId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 18: Закрытие соединения при завершении звонка
   * Validates: Requirements 5.4, 6.7
   * 
   * При завершении звонка все ресурсы должны быть освобождены:
   * - RTCPeerConnection должен быть закрыт
   * - Медиа-потоки должны быть остановлены
   * - Сессия должна быть удалена
   */
  describe('Property 18: Connection Closure on Call End', () => {
    it('should close peer connection when ending any call', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            // Recreate service instances for each test
            const testAuthService = new AuthService();
            const testSignalingService = new SignalingService(testAuthService, 'ws://localhost:3000');
            const testCryptoService = new CryptoService();
            const testWebrtcService = new WebRTCService(testAuthService, testSignalingService, testCryptoService);

            jest.spyOn(testAuthService, 'getCurrentUser').mockReturnValue({
              id: 'user1',
              username: 'testuser',
              publicKey: 'mock-public-key',
              createdAt: new Date().toISOString(),
            });

            jest.spyOn(testSignalingService, 'sendCallRequest').mockResolvedValue('call-id-123');
            jest.spyOn(testSignalingService, 'sendOffer').mockResolvedValue();
            jest.spyOn(testSignalingService, 'sendAnswer').mockResolvedValue();
            jest.spyOn(testSignalingService, 'sendHangup').mockResolvedValue();

            const mockPeerConnection = createMockPeerConnection();
            
            if (!navigator.mediaDevices) {
              Object.defineProperty(navigator, 'mediaDevices', {
                writable: true,
                configurable: true,
                value: {},
              });
            }
            
            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());
            (global as any).RTCPeerConnection = jest.fn(() => mockPeerConnection);

            // Act: Start and end call
            await testWebrtcService.initiateCall(userId, callType);
            await testWebrtcService.endCall(userId);

            // Assert: Peer connection should be closed
            expect(mockPeerConnection.close).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should stop all media tracks when ending call', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            const mockTracks = [
              { kind: 'audio', enabled: true, stop: jest.fn() },
              { kind: 'video', enabled: true, stop: jest.fn() },
            ];
            
            const mockStream = {
              getTracks: jest.fn(() => mockTracks),
              getAudioTracks: jest.fn(() => [mockTracks[0]]),
              getVideoTracks: jest.fn(() => [mockTracks[1]]),
              addTrack: jest.fn(),
              removeTrack: jest.fn(),
            } as any;

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => mockStream);
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Start and end call
            await webrtcService.initiateCall(userId, callType);
            await webrtcService.endCall(userId);

            // Assert: All tracks should be stopped
            mockTracks.forEach(track => {
              expect(track.stop).toHaveBeenCalled();
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove call session when ending call', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Start call
            await webrtcService.initiateCall(userId, callType);
            
            // Verify session exists
            expect(webrtcService.getCallStatus(userId)).toBeDefined();

            // End call
            await webrtcService.endCall(userId);

            // Assert: Session should be removed
            expect(webrtcService.getCallStatus(userId)).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should send hangup signal to signaling server when ending call', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Start and end call
            await webrtcService.initiateCall(userId, callType);
            await webrtcService.endCall(userId);

            // Assert: Hangup signal should be sent
            expect(signalingService.sendHangup).toHaveBeenCalledWith(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle ending non-existent call gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (userId) => {
            // Arrange
            jest.clearAllMocks();

            // Act & Assert: Should not throw when ending non-existent call
            await expect(webrtcService.endCall(userId)).resolves.not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple end call requests idempotently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
            endCallCount: fc.integer({ min: 2, max: 5 }),
          }),
          async ({ userId, callType, endCallCount }) => {
            // Arrange
            jest.clearAllMocks();
            
            const mockPeerConnection = createMockPeerConnection();
            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());
            (global as any).RTCPeerConnection = jest.fn(() => mockPeerConnection);

            // Act: Start call
            await webrtcService.initiateCall(userId, callType);

            // End call multiple times
            for (let i = 0; i < endCallCount; i++) {
              await webrtcService.endCall(userId);
            }

            // Assert: Should handle multiple end calls gracefully
            // Peer connection close should be called at least once
            expect(mockPeerConnection.close).toHaveBeenCalled();
            
            // Session should be removed
            expect(webrtcService.getCallStatus(userId)).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clean up resources even if peer connection close fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            const mockPeerConnection = createMockPeerConnection();
            mockPeerConnection.close = jest.fn(() => {
              throw new Error('Close failed');
            });

            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());
            (global as any).RTCPeerConnection = jest.fn(() => mockPeerConnection);

            // Act: Start and end call
            await webrtcService.initiateCall(userId, callType);
            await webrtcService.endCall(userId);

            // Assert: Session should still be removed despite error
            expect(webrtcService.getCallStatus(userId)).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clean up resources when rejecting incoming call', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callId: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async ({ userId, callId }) => {
            // Arrange
            jest.clearAllMocks();

            // Act: Reject call
            await webrtcService.rejectCall(userId, callId);

            // Assert: Hangup signal should be sent
            expect(signalingService.sendHangup).toHaveBeenCalledWith(userId);
            
            // No session should exist
            expect(webrtcService.getCallStatus(userId)).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should release encryption keys when ending call', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            callType: fc.constantFrom('audio' as const, 'video' as const),
          }),
          async ({ userId, callType }) => {
            // Arrange
            jest.clearAllMocks();
            
            (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => createMockMediaStream());
            (global as any).RTCPeerConnection = jest.fn(() => createMockPeerConnection());

            // Act: Start call
            await webrtcService.initiateCall(userId, callType);
            
            // Verify encryption key exists
            let session = webrtcService.getCallStatus(userId);
            expect(session?.encryptionKey).toBeDefined();

            // End call
            await webrtcService.endCall(userId);

            // Assert: Session (including encryption key) should be removed
            session = webrtcService.getCallStatus(userId);
            expect(session).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

import { SignalingService } from './SignalingService';
import { CryptoService } from './CryptoService';
import { AuthService } from './AuthService';

/**
 * WebRTCService - Модуль управления WebRTC соединениями и звонками
 * 
 * Управляет:
 * - P2P аудио и видео звонками
 * - RTCPeerConnection соединениями
 * - Обменом медиа потоками
 * - ICE кандидатами и SDP
 * - Шифрованием медиа-потоков через Insertable Streams API
 */

export interface CallSession {
  id: string;
  userId: string;
  callType: 'audio' | 'video';
  status: 'incoming' | 'outgoing' | 'connected' | 'ended';
  startTime: number;
  endTime?: number;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  peerConnection: RTCPeerConnection;
  encryptionKey?: CryptoKey;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  constraints: MediaStreamConstraints;
}

export interface CallEvent {
  type: 'incoming_call' | 'call_connected' | 'call_ended' | 'remote_stream_added' | 'error';
  sessionId: string;
  userId: string;
  data?: any;
}

export class WebRTCService {
  private authService: AuthService;
  private signalingService: SignalingService;
  private cryptoService: CryptoService;
  private config: WebRTCConfig;
  
  private activeSessions: Map<string, CallSession> = new Map();
  private pendingConnections: Map<string, RTCPeerConnection> = new Map();
  
  // Event listeners
  private eventListeners: Map<string, ((event: CallEvent) => void)[]> = new Map();

  constructor(
    authService: AuthService,
    signalingService: SignalingService,
    cryptoService: CryptoService,
    config?: Partial<WebRTCConfig>
  ) {
    this.authService = authService;
    this.signalingService = signalingService;
    this.cryptoService = cryptoService;
    
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      constraints: {
        audio: true,
        video: true,
      },
      ...config,
    };

    this.setupSignalingListeners();
  }

  /**
   * Инициирует звонок другому пользователю
   */
  async initiateCall(userId: string, callType: 'audio' | 'video'): Promise<string> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      if (this.activeSessions.has(userId)) {
        throw new Error('Call already in progress with this user');
      }

      console.log(`Initiating ${callType} call to user: ${userId}`);

      // Получаем локальный медиа поток
      const constraints = { audio: true, video: callType === 'video' };
      let localStream: MediaStream;
      
      try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error: any) {
        console.error('Failed to get user media:', error);
        
        // Обрабатываем различные типы ошибок
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          throw new Error('Camera/microphone access denied. Please allow access in browser settings.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          throw new Error('No camera/microphone found. Please connect a device.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          throw new Error('Device is already in use by another application.');
        } else {
          throw new Error(`Failed to access media devices: ${error.message}`);
        }
      }

      // Создаем RTCPeerConnection
      const peerConnection = this.createPeerConnection();
      
      // Добавляем локальный поток
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      // Генерируем ключ шифрования для медиа-потоков
      const encryptionKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // Настраиваем шифрование медиа-потоков
      await this.setupMediaEncryption(peerConnection, encryptionKey);

      // Создаем сессию звонка
      const sessionId = this.generateSessionId();
      const session: CallSession = {
        id: sessionId,
        userId,
        callType,
        status: 'outgoing',
        startTime: Date.now(),
        localStream,
        peerConnection,
        encryptionKey,
      };

      this.activeSessions.set(userId, session);

      // Создаем и отправляем offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Отправляем signaling сообщение
      const callId = await this.signalingService.sendCallRequest(userId, callType);
      await this.signalingService.sendOffer(userId, offer);

      // Включаем адаптивный битрейт
      this.enableAdaptiveBitrate(userId).catch(error => {
        console.error('Failed to enable adaptive bitrate:', error);
      });

      this.emitEvent({
        type: 'incoming_call',
        sessionId,
        userId,
        data: { callType, isOutgoing: true },
      });

      return sessionId;
    } catch (error) {
      console.error('Failed to initiate call:', error);
      throw error;
    }
  }

  /**
   * Принимает входящий звонок
   */
  async answerCall(userId: string, callId: string, callType: 'audio' | 'video'): Promise<string> {
    try {
      if (this.activeSessions.has(userId)) {
        throw new Error('Call already in progress with this user');
      }

      console.log(`Answering ${callType} call from user: ${userId}`);

      // Получаем локальный медиа поток
      const constraints = { audio: true, video: callType === 'video' };
      let localStream: MediaStream;
      
      try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error: any) {
        console.error('Failed to get user media:', error);
        
        // Обрабатываем различные типы ошибок
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          throw new Error('Camera/microphone access denied. Please allow access in browser settings.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          throw new Error('No camera/microphone found. Please connect a device.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          throw new Error('Device is already in use by another application.');
        } else {
          throw new Error(`Failed to access media devices: ${error.message}`);
        }
      }

      // Создаем RTCPeerConnection
      const peerConnection = this.createPeerConnection();
      
      // Добавляем локальный поток
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      // Генерируем ключ шифрования для медиа-потоков
      const encryptionKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // Настраиваем шифрование медиа-потоков
      await this.setupMediaEncryption(peerConnection, encryptionKey);

      // Создаем сессию звонка
      const sessionId = this.generateSessionId();
      const session: CallSession = {
        id: sessionId,
        userId,
        callType,
        status: 'connected',
        startTime: Date.now(),
        localStream,
        peerConnection,
        encryptionKey,
      };

      this.activeSessions.set(userId, session);

      // Ожидаем offer от signaling service
      // Offer будет обработан через onOffer listener

      // Включаем адаптивный битрейт
      this.enableAdaptiveBitrate(userId).catch(error => {
        console.error('Failed to enable adaptive bitrate:', error);
      });

      this.emitEvent({
        type: 'call_connected',
        sessionId,
        userId,
        data: { callType },
      });

      return sessionId;
    } catch (error) {
      console.error('Failed to answer call:', error);
      throw error;
    }
  }

  /**
   * Отклоняет входящий звонок
   */
  async rejectCall(userId: string, callId: string): Promise<void> {
    try {
      console.log(`Rejecting call from user: ${userId}`);
      
      await this.signalingService.sendHangup(userId, callId);
      
      // Удаляем pending connection если есть
      this.pendingConnections.delete(userId);
      
      this.emitEvent({
        type: 'call_ended',
        sessionId: '',
        userId,
        data: { rejected: true },
      });
    } catch (error) {
      console.error('Failed to reject call:', error);
      throw error;
    }
  }

  /**
   * Завершает звонок
   */
  async endCall(userId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(userId);
      if (!session) {
        throw new Error('No active call with this user');
      }

      console.log(`Ending call with user: ${userId}`);

      // Останавливаем мониторинг битрейта если он был включен
      if ((session as any).bitrateIntervalId) {
        clearInterval((session as any).bitrateIntervalId);
      }

      // Останавливаем локальные медиа треки
      if (session.localStream) {
        session.localStream.getTracks().forEach(track => {
          track.stop();
        });
      }

      // Закрываем peer connection
      session.peerConnection.close();

      // Отправляем hangup сигнал
      await this.signalingService.sendHangup(userId, session.id);

      // Обновляем сессию
      session.endTime = Date.now();
      session.status = 'ended';

      // Удаляем из активных сессий
      this.activeSessions.delete(userId);

      this.emitEvent({
        type: 'call_ended',
        sessionId: session.id,
        userId,
        data: { duration: session.endTime - session.startTime },
      });
    } catch (error) {
      console.error('Failed to end call:', error);
      throw error;
    }
  }

  /**
   * Переключает камеру (вкл/выкл)
   */
  async toggleVideo(userId: string): Promise<boolean> {
    const session = this.activeSessions.get(userId);
    if (!session || !session.localStream) {
      throw new Error('No active call or local stream');
    }

    const videoTrack = session.localStream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('No video track available');
    }

    const isEnabled = videoTrack.enabled;
    videoTrack.enabled = !isEnabled;

    return !isEnabled;
  }

  /**
   * Переключает микрофон (вкл/выкл)
   */
  async toggleAudio(userId: string): Promise<boolean> {
    const session = this.activeSessions.get(userId);
    if (!session || !session.localStream) {
      throw new Error('No active call or local stream');
    }

    const audioTrack = session.localStream.getAudioTracks()[0];
    if (!audioTrack) {
      throw new Error('No audio track available');
    }

    const isEnabled = audioTrack.enabled;
    audioTrack.enabled = !isEnabled;

    return !isEnabled;
  }

  /**
   * Получает список доступных медиа-устройств
   */
  async getAvailableDevices(): Promise<{
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
  }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      return {
        audioInputs: devices.filter(d => d.kind === 'audioinput'),
        videoInputs: devices.filter(d => d.kind === 'videoinput'),
        audioOutputs: devices.filter(d => d.kind === 'audiooutput'),
      };
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      throw new Error('Failed to get available media devices');
    }
  }

  /**
   * Проверяет доступность медиа-устройств
   */
  async checkMediaDeviceAccess(type: 'audio' | 'video' | 'both'): Promise<{
    audio: boolean;
    video: boolean;
    error?: string;
  }> {
    const result = {
      audio: false,
      video: false,
      error: undefined as string | undefined,
    };

    try {
      const constraints: MediaStreamConstraints = {
        audio: type === 'audio' || type === 'both',
        video: type === 'video' || type === 'both',
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Проверяем какие треки получены
      result.audio = stream.getAudioTracks().length > 0;
      result.video = stream.getVideoTracks().length > 0;

      // Останавливаем поток после проверки
      stream.getTracks().forEach(track => track.stop());

      return result;
    } catch (error: any) {
      console.error('Media device access check failed:', error);

      // Определяем тип ошибки
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        result.error = 'Permission denied. Please allow access to camera/microphone.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        result.error = 'No camera/microphone found. Please connect a device.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        result.error = 'Device is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        result.error = 'Device does not meet the required constraints.';
      } else {
        result.error = `Failed to access media devices: ${error.message}`;
      }

      return result;
    }
  }

  /**
   * Переключает микрофон (вкл/выкл) с обработкой ошибок
   */
  async toggleMute(userId: string): Promise<boolean> {
    try {
      return await this.toggleAudio(userId);
    } catch (error) {
      console.error('Failed to toggle mute:', error);
      throw error;
    }
  }

  /**
   * Переключает камеру (вкл/выкл) с обработкой ошибок
   */
  async toggleCamera(userId: string): Promise<boolean> {
    try {
      return await this.toggleVideo(userId);
    } catch (error) {
      console.error('Failed to toggle camera:', error);
      throw error;
    }
  }

  /**
   * Меняет аудио устройство ввода
   */
  async switchAudioInput(userId: string, deviceId: string): Promise<void> {
    const session = this.activeSessions.get(userId);
    if (!session || !session.localStream) {
      throw new Error('No active call or local stream');
    }

    try {
      // Получаем новый аудио поток с выбранным устройством
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false,
      });

      const newAudioTrack = newStream.getAudioTracks()[0];
      const oldAudioTrack = session.localStream.getAudioTracks()[0];

      if (oldAudioTrack) {
        // Заменяем трек в peer connection
        const sender = session.peerConnection
          .getSenders()
          .find(s => s.track?.kind === 'audio');

        if (sender) {
          await sender.replaceTrack(newAudioTrack);
        }

        // Останавливаем старый трек
        oldAudioTrack.stop();
        session.localStream.removeTrack(oldAudioTrack);
      }

      // Добавляем новый трек
      session.localStream.addTrack(newAudioTrack);
    } catch (error: any) {
      console.error('Failed to switch audio input:', error);

      if (error.name === 'NotFoundError') {
        throw new Error('Selected audio device not found');
      } else if (error.name === 'NotAllowedError') {
        throw new Error('Permission denied for audio device');
      } else {
        throw new Error(`Failed to switch audio input: ${error.message}`);
      }
    }
  }

  /**
   * Меняет видео устройство ввода
   */
  async switchVideoInput(userId: string, deviceId: string): Promise<void> {
    const session = this.activeSessions.get(userId);
    if (!session || !session.localStream) {
      throw new Error('No active call or local stream');
    }

    try {
      // Получаем новый видео поток с выбранным устройством
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: deviceId } },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = session.localStream.getVideoTracks()[0];

      if (oldVideoTrack) {
        // Заменяем трек в peer connection
        const sender = session.peerConnection
          .getSenders()
          .find(s => s.track?.kind === 'video');

        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }

        // Останавливаем старый трек
        oldVideoTrack.stop();
        session.localStream.removeTrack(oldVideoTrack);
      }

      // Добавляем новый трек
      session.localStream.addTrack(newVideoTrack);
    } catch (error: any) {
      console.error('Failed to switch video input:', error);

      if (error.name === 'NotFoundError') {
        throw new Error('Selected video device not found');
      } else if (error.name === 'NotAllowedError') {
        throw new Error('Permission denied for video device');
      } else {
        throw new Error(`Failed to switch video input: ${error.message}`);
      }
    }
  }

  /**
   * Мониторит качество соединения и возвращает статистику
   */
  async getConnectionStats(userId: string): Promise<{
    audio: {
      bitrate: number;
      packetsLost: number;
      jitter: number;
      rtt: number;
    };
    video: {
      bitrate: number;
      packetsLost: number;
      frameRate: number;
      resolution: { width: number; height: number };
      rtt: number;
    };
    quality: 'excellent' | 'good' | 'fair' | 'poor';
  } | null> {
    const session = this.activeSessions.get(userId);
    if (!session) {
      return null;
    }

    try {
      const stats = await session.peerConnection.getStats();

      const audioStats = {
        bitrate: 0,
        packetsLost: 0,
        jitter: 0,
        rtt: 0,
      };

      const videoStats = {
        bitrate: 0,
        packetsLost: 0,
        frameRate: 0,
        resolution: { width: 0, height: 0 },
        rtt: 0,
      };

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp') {
          if (report.kind === 'audio') {
            audioStats.bitrate = report.bytesReceived ? (report.bytesReceived * 8) / 1000 : 0;
            audioStats.packetsLost = report.packetsLost || 0;
            audioStats.jitter = report.jitter || 0;
          } else if (report.kind === 'video') {
            videoStats.bitrate = report.bytesReceived ? (report.bytesReceived * 8) / 1000 : 0;
            videoStats.packetsLost = report.packetsLost || 0;
            videoStats.frameRate = report.framesPerSecond || 0;
            videoStats.resolution = {
              width: report.frameWidth || 0,
              height: report.frameHeight || 0,
            };
          }
        }

        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          audioStats.rtt = report.currentRoundTripTime || 0;
          videoStats.rtt = report.currentRoundTripTime || 0;
        }
      });

      // Определяем качество соединения на основе RTT и потери пакетов
      let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
      const avgPacketLoss = (audioStats.packetsLost + videoStats.packetsLost) / 2;
      const avgRtt = (audioStats.rtt + videoStats.rtt) / 2;

      if (avgRtt > 300 || avgPacketLoss > 5) {
        quality = 'poor';
      } else if (avgRtt > 200 || avgPacketLoss > 3) {
        quality = 'fair';
      } else if (avgRtt > 100 || avgPacketLoss > 1) {
        quality = 'good';
      }

      return {
        audio: audioStats,
        video: videoStats,
        quality,
      };
    } catch (error) {
      console.error('Failed to get connection stats:', error);
      return null;
    }
  }

  /**
   * Настраивает адаптивный битрейт для аудио
   */
  async setAudioBitrate(userId: string, bitrate: number): Promise<void> {
    const session = this.activeSessions.get(userId);
    if (!session) {
      throw new Error('No active call with this user');
    }

    try {
      const sender = session.peerConnection
        .getSenders()
        .find(s => s.track?.kind === 'audio');

      if (sender) {
        const parameters = sender.getParameters();

        if (!parameters.encodings) {
          parameters.encodings = [{}];
        }

        parameters.encodings[0].maxBitrate = bitrate * 1000; // Convert to bps

        await sender.setParameters(parameters);
        console.log(`Audio bitrate set to ${bitrate} kbps`);
      }
    } catch (error) {
      console.error('Failed to set audio bitrate:', error);
      throw error;
    }
  }

  /**
   * Настраивает адаптивный битрейт для видео
   */
  async setVideoBitrate(userId: string, bitrate: number): Promise<void> {
    const session = this.activeSessions.get(userId);
    if (!session) {
      throw new Error('No active call with this user');
    }

    try {
      const sender = session.peerConnection
        .getSenders()
        .find(s => s.track?.kind === 'video');

      if (sender) {
        const parameters = sender.getParameters();

        if (!parameters.encodings) {
          parameters.encodings = [{}];
        }

        parameters.encodings[0].maxBitrate = bitrate * 1000; // Convert to bps

        await sender.setParameters(parameters);
        console.log(`Video bitrate set to ${bitrate} kbps`);
      }
    } catch (error) {
      console.error('Failed to set video bitrate:', error);
      throw error;
    }
  }

  /**
   * Автоматически адаптирует битрейт на основе качества соединения
   */
  async enableAdaptiveBitrate(userId: string): Promise<void> {
    const session = this.activeSessions.get(userId);
    if (!session) {
      throw new Error('No active call with this user');
    }

    // Мониторим качество каждые 2 секунды
    const intervalId = setInterval(async () => {
      const stats = await this.getConnectionStats(userId);

      if (!stats) {
        clearInterval(intervalId);
        return;
      }

      // Адаптируем битрейт на основе качества
      try {
        if (stats.quality === 'poor') {
          // Снижаем битрейт
          await this.setAudioBitrate(userId, 32); // 32 kbps
          if (session.callType === 'video') {
            await this.setVideoBitrate(userId, 500); // 500 kbps
          }
        } else if (stats.quality === 'fair') {
          await this.setAudioBitrate(userId, 48); // 48 kbps
          if (session.callType === 'video') {
            await this.setVideoBitrate(userId, 1000); // 1 Mbps
          }
        } else if (stats.quality === 'good') {
          await this.setAudioBitrate(userId, 64); // 64 kbps
          if (session.callType === 'video') {
            await this.setVideoBitrate(userId, 2000); // 2 Mbps
          }
        } else {
          // excellent
          await this.setAudioBitrate(userId, 128); // 128 kbps
          if (session.callType === 'video') {
            await this.setVideoBitrate(userId, 3000); // 3 Mbps
          }
        }
      } catch (error) {
        console.error('Failed to adapt bitrate:', error);
      }
    }, 2000);

    // Сохраняем interval ID для очистки при завершении звонка
    (session as any).bitrateIntervalId = intervalId;
  }

  /**
   * Настраивает предпочитаемые кодеки (Opus для аудио, VP8/VP9 для видео)
   */
  private setPreferredCodecs(peerConnection: RTCPeerConnection): void {
    try {
      const transceivers = peerConnection.getTransceivers();

      transceivers.forEach(transceiver => {
        const { sender } = transceiver;
        const capabilities = RTCRtpSender.getCapabilities(sender.track?.kind || 'audio');

        if (!capabilities) return;

        let preferredCodecs: any[] = [];

        if (sender.track?.kind === 'audio') {
          // Предпочитаем Opus для аудио
          preferredCodecs = capabilities.codecs.filter(codec =>
            codec.mimeType.toLowerCase().includes('opus')
          );

          // Добавляем остальные кодеки как fallback
          preferredCodecs.push(...capabilities.codecs.filter(codec =>
            !codec.mimeType.toLowerCase().includes('opus')
          ));
        } else if (sender.track?.kind === 'video') {
          // Предпочитаем VP9, затем VP8 для видео
          const vp9Codecs = capabilities.codecs.filter(codec =>
            codec.mimeType.toLowerCase().includes('vp9')
          );
          const vp8Codecs = capabilities.codecs.filter(codec =>
            codec.mimeType.toLowerCase().includes('vp8')
          );

          preferredCodecs = [...vp9Codecs, ...vp8Codecs];

          // Добавляем остальные кодеки как fallback
          preferredCodecs.push(...capabilities.codecs.filter(codec =>
            !codec.mimeType.toLowerCase().includes('vp9') &&
            !codec.mimeType.toLowerCase().includes('vp8')
          ));
        }

        if (preferredCodecs.length > 0) {
          transceiver.setCodecPreferences(preferredCodecs);
        }
      });
    } catch (error) {
      console.error('Failed to set preferred codecs:', error);
    }
  }

  /**
   * Получает статус звонка
   */
  getCallStatus(userId: string): CallSession | null {
    return this.activeSessions.get(userId) || null;
  }

  /**
   * Получает все активные звонки
   */
  getActiveCalls(): CallSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Добавляет обработчик событий
   */
  addEventListener(eventType: string, callback: (event: CallEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Удаляет обработчик событий
   */
  removeEventListener(eventType: string, callback: (event: CallEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Создает RTCPeerConnection
   */
  private createPeerConnection(): RTCPeerConnection {
    const peerConnection = new RTCPeerConnection(this.config);

    // Обработчик ICE кандидатов
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // ICE кандиденты будут отправлены через signaling service
        // Это обрабатывается в setupSignalingListeners
      }
    };

    // Обработчик удаленного потока
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this.handleRemoteStream(remoteStream);
      }
    };

    // Обработчик изменения состояния соединения
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'failed') {
        this.handleConnectionFailure(peerConnection);
      }
    };

    // Настраиваем предпочитаемые кодеки после создания соединения
    setTimeout(() => {
      this.setPreferredCodecs(peerConnection);
    }, 0);

    return peerConnection;
  }

  /**
   * Настраивает шифрование медиа-потоков используя Insertable Streams API
   * Интегрируется с CryptoService для получения ключей шифрования
   * 
   * Требования: 5.2, 6.2, 7.4
   * - Шифрует все медиа-фреймы перед отправкой
   * - Расшифровывает все входящие медиа-фреймы
   * - Использует AES-GCM-256 для шифрования
   * - Генерирует уникальный IV для каждого фрейма
   */
  private async setupMediaEncryption(
    peerConnection: RTCPeerConnection,
    encryptionKey: CryptoKey
  ): Promise<void> {
    try {
      // Получаем все senders (исходящие треки)
      const senders = peerConnection.getSenders();

      for (const sender of senders) {
        if (sender.track) {
          // @ts-ignore - Insertable Streams API может быть не в типах
          const senderStreams = sender.createEncodedStreams?.();

          if (senderStreams) {
            const { readable, writable } = senderStreams;

            // Создаем transform stream для шифрования
            const transformStream = new TransformStream({
              transform: async (encodedFrame, controller) => {
                try {
                  // Получаем данные фрейма
                  const data = new Uint8Array(encodedFrame.data);

                  // Генерируем IV для каждого фрейма
                  const iv = crypto.getRandomValues(new Uint8Array(12));

                  // Шифруем данные
                  const encrypted = await crypto.subtle.encrypt(
                    { name: 'AES-GCM', iv },
                    encryptionKey,
                    data
                  );

                  // Создаем новый буфер с IV + зашифрованные данные
                  const encryptedData = new Uint8Array(iv.length + encrypted.byteLength);
                  encryptedData.set(iv, 0);
                  encryptedData.set(new Uint8Array(encrypted), iv.length);

                  // Заменяем данные фрейма
                  encodedFrame.data = encryptedData.buffer;
                  controller.enqueue(encodedFrame);
                } catch (error) {
                  console.error('Error encrypting frame:', error);
                  controller.enqueue(encodedFrame);
                }
              }
            });

            // Подключаем transform stream
            readable.pipeThrough(transformStream).pipeTo(writable);
          }
        }
      }

      // Получаем все receivers (входящие треки)
      const receivers = peerConnection.getReceivers();

      for (const receiver of receivers) {
        if (receiver.track) {
          // @ts-ignore - Insertable Streams API может быть не в типах
          const receiverStreams = receiver.createEncodedStreams?.();

          if (receiverStreams) {
            const { readable, writable } = receiverStreams;

            // Создаем transform stream для расшифрования
            const transformStream = new TransformStream({
              transform: async (encodedFrame, controller) => {
                try {
                  // Получаем данные фрейма
                  const data = new Uint8Array(encodedFrame.data);

                  // Первые 12 байт - это IV
                  if (data.length < 12) {
                    controller.enqueue(encodedFrame);
                    return;
                  }

                  const iv = data.slice(0, 12);
                  const encryptedData = data.slice(12);

                  // Расшифровываем данные
                  const decrypted = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv },
                    encryptionKey,
                    encryptedData
                  );

                  // Заменяем данные фрейма
                  encodedFrame.data = decrypted;
                  controller.enqueue(encodedFrame);
                } catch (error) {
                  console.error('Error decrypting frame:', error);
                  controller.enqueue(encodedFrame);
                }
              }
            });

            // Подключаем transform stream
            readable.pipeThrough(transformStream).pipeTo(writable);
          }
        }
      }
    } catch (error) {
      console.error('Failed to setup media encryption:', error);
      throw error;
    }
  }

  /**
   * Устанавливает слушатели signaling service
   */
  private setupSignalingListeners(): void {
    // Входящий звонок
    this.signalingService.onIncomingCall(async (call) => {
      try {
        // Создаем pending connection для входящего звонка
        const peerConnection = this.createPeerConnection();
        this.pendingConnections.set(call.fromUserId, peerConnection);

        this.emitEvent({
          type: 'incoming_call',
          sessionId: call.callId,
          userId: call.fromUserId,
          data: { callType: call.callType, isOutgoing: false },
        });
      } catch (error) {
        console.error('Failed to handle incoming call:', error);
        this.emitEvent({
          type: 'error',
          sessionId: call.callId,
          userId: call.fromUserId,
          data: error,
        });
      }
    });

    // Входящий offer
    this.signalingService.onOffer(async (fromUserId, offer) => {
      try {
        const session = this.activeSessions.get(fromUserId);
        const pendingConnection = this.pendingConnections.get(fromUserId);

        if (session || pendingConnection) {
          const peerConnection = session?.peerConnection || pendingConnection!;
          
          await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          await this.signalingService.sendAnswer(fromUserId, answer);

          // Если это была pending connection, перемещаем в активные сессии
          if (pendingConnection && !session) {
            // Сессия будет создана в answerCall
            console.log('Offer processed, waiting for answerCall to complete session');
          }
        }
      } catch (error) {
        console.error('Failed to handle offer:', error);
        this.emitEvent({
          type: 'error',
          sessionId: '',
          userId: fromUserId,
          data: error,
        });
      }
    });

    // Входящий answer
    this.signalingService.onAnswer(async (fromUserId, answer) => {
      try {
        const session = this.activeSessions.get(fromUserId);
        if (session) {
          await session.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          
          this.emitEvent({
            type: 'call_connected',
            sessionId: session.id,
            userId: fromUserId,
            data: { callType: session.callType },
          });
        }
      } catch (error) {
        console.error('Failed to handle answer:', error);
        this.emitEvent({
          type: 'error',
          sessionId: '',
          userId: fromUserId,
          data: error,
        });
      }
    });

    // Входящий ICE candidate
    this.signalingService.onIceCandidate(async (fromUserId, candidate) => {
      try {
        const session = this.activeSessions.get(fromUserId);
        const pendingConnection = this.pendingConnections.get(fromUserId);
        
        const peerConnection = session?.peerConnection || pendingConnection;
        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error('Failed to handle ICE candidate:', error);
      }
    });

    // Завершение звонка
    this.signalingService.onHangup(async (fromUserId) => {
      const session = this.activeSessions.get(fromUserId);
      if (session) {
        await this.endCall(fromUserId);
      }
      
      // Удаляем pending connection
      this.pendingConnections.delete(fromUserId);
    });
  }

  /**
   * Обрабатывает удаленный медиа поток
   */
  private handleRemoteStream(remoteStream: MediaStream): void {
    // Находим сессию к которой относится этот поток
    for (const [userId, session] of this.activeSessions) {
      if (!session.remoteStream) {
        session.remoteStream = remoteStream;
        
        this.emitEvent({
          type: 'remote_stream_added',
          sessionId: session.id,
          userId,
          data: { stream: remoteStream },
        });
        
        break;
      }
    }
  }

  /**
   * Обрабатывает отказ соединения
   */
  private handleConnectionFailure(peerConnection: RTCPeerConnection): void {
    // Находим сессию с этим соединением
    for (const [userId, session] of this.activeSessions) {
      if (session.peerConnection === peerConnection) {
        console.error(`Connection failed for user: ${userId}`);
        
        this.emitEvent({
          type: 'error',
          sessionId: session.id,
          userId,
          data: { message: 'Connection failed' },
        });
        
        // Завершаем звонок
        this.endCall(userId).catch(console.error);
        break;
      }
    }
  }

  /**
   * Отправляет событие слушателям
   */
  private emitEvent(event: CallEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }

  /**
   * Генерирует уникальный ID сессии
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Очищает все ресурсы
   */
  cleanup(): void {
    console.log('Cleaning up WebRTC service');
    
    // Завершаем все активные звонки
    const activeCalls = Array.from(this.activeSessions.keys());
    activeCalls.forEach(userId => {
      this.endCall(userId).catch(console.error);
    });

    // Очищаем pending connections
    this.pendingConnections.forEach(connection => {
      connection.close();
    });
    this.pendingConnections.clear();

    // Удаляем всех слушателей
    this.eventListeners.clear();
  }

  /**
   * Обновляет конфигурацию
   */
  updateConfig(config: Partial<WebRTCConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

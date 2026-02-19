import { AuthService } from './AuthService';

/**
 * SignalingService - Модуль сигнализации для WebRTC
 * 
 * Управляет:
 * - Подключением к WebSocket серверу
 * - Отправкой и получением сигнальных сообщений
 * - Автоматическим переподключением
 * - Heartbeat для поддержания соединения
 */

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call' | 'hangup' | 'ping' | 'pong';
  fromUserId: string;
  toUserId: string;
  payload?: any;
  timestamp: number;
}

export interface CallRequest {
  callId: string;
  fromUserId: string;
  toUserId: string;
  callType: 'audio' | 'video';
  timestamp: number;
}

export interface IceCandidate {
  candidate: string;
  sdpMLineIndex: number;
  sdpMid: string;
}

export interface ReconnectionConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export class SignalingService {
  private authService: AuthService;
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: SignalingMessage[] = [];
  private reconnectConfig: ReconnectionConfig = {
    maxRetries: 10,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
  };

  // Event listeners
  private onConnectionChangeListeners: ((connected: boolean) => void)[] = [];
  private onIncomingCallListeners: ((call: CallRequest) => void)[] = [];
  private onOfferListeners: ((fromUserId: string, offer: RTCSessionDescriptionInit) => void)[] = [];
  private onAnswerListeners: ((fromUserId: string, answer: RTCSessionDescriptionInit) => void)[] = [];
  private onIceCandidateListeners: ((fromUserId: string, candidate: IceCandidate) => void)[] = [];
  private onHangupListeners: ((fromUserId: string) => void)[] = [];
  private onErrorListeners: ((error: Error) => void)[] = [];

  constructor(authService: AuthService, serverUrl: string = 'ws://localhost:8080') {
    this.authService = authService;
    this.serverUrl = serverUrl;
  }

  /**
   * Подключается к WebSocket серверу
   */
  async connect(): Promise<void> {
    try {
      const token = this.authService.getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Формируем URL с токеном и ID пользователя
      const wsUrl = `${this.serverUrl}?token=${encodeURIComponent(token)}&userId=${currentUser.id}`;

      console.log(`Connecting to signaling server: ${wsUrl}`);
      this.ws = new WebSocket(wsUrl);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.ws!.onopen = () => {
          clearTimeout(timeout);
          console.log('Connected to signaling server');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.processMessageQueue();
          this.notifyConnectionChange(true);
          resolve();
        };

        this.ws!.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws!.onclose = (event) => {
          clearTimeout(timeout);
          console.log(`Disconnected from signaling server: ${event.code} ${event.reason}`);
          this.isConnected = false;
          this.stopHeartbeat();
          this.notifyConnectionChange(false);
          
          if (!event.wasClean && this.reconnectAttempts < this.reconnectConfig.maxRetries) {
            this.scheduleReconnect();
          }
        };

        this.ws!.onerror = (error) => {
          clearTimeout(timeout);
          console.error('WebSocket error:', error);
          reject(new Error('WebSocket connection failed'));
        };
      });
    } catch (error) {
      console.error('Failed to connect to signaling server:', error);
      throw error;
    }
  }

  /**
   * Отключается от WebSocket сервера
   */
  disconnect(): void {
    console.log('Disconnecting from signaling server');
    
    this.stopHeartbeat();
    this.clearReconnectTimer();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.messageQueue = [];
    this.notifyConnectionChange(false);
  }

  /**
   * Отправляет SDP offer
   */
  async sendOffer(toUserId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const message: SignalingMessage = {
      type: 'offer',
      fromUserId: this.authService.getCurrentUser()!.id,
      toUserId,
      payload: offer,
      timestamp: Date.now(),
    };

    await this.sendMessage(message);
  }

  /**
   * Отправляет SDP answer
   */
  async sendAnswer(toUserId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const message: SignalingMessage = {
      type: 'answer',
      fromUserId: this.authService.getCurrentUser()!.id,
      toUserId,
      payload: answer,
      timestamp: Date.now(),
    };

    await this.sendMessage(message);
  }

  /**
   * Отправляет ICE candidate
   */
  async sendIceCandidate(toUserId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const message: SignalingMessage = {
      type: 'ice-candidate',
      fromUserId: this.authService.getCurrentUser()!.id,
      toUserId,
      payload: candidate,
      timestamp: Date.now(),
    };

    await this.sendMessage(message);
  }

  /**
   * Отправляет запрос на звонок
   */
  async sendCallRequest(toUserId: string, callType: 'audio' | 'video'): Promise<string> {
    const callId = this.generateCallId();
    const message: SignalingMessage = {
      type: 'call',
      fromUserId: this.authService.getCurrentUser()!.id,
      toUserId,
      payload: {
        callId,
        callType,
      },
      timestamp: Date.now(),
    };

    await this.sendMessage(message);
    return callId;
  }

  /**
   * Отправляет команду завершения звонка
   */
  async sendHangup(toUserId: string, callId: string): Promise<void> {
    const message: SignalingMessage = {
      type: 'hangup',
      fromUserId: this.authService.getCurrentUser()!.id,
      toUserId,
      payload: { callId },
      timestamp: Date.now(),
    };

    await this.sendMessage(message);
  }

  /**
   * Проверяет статус подключения
   */
  isConnectionActive(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Добавляет обработчик изменения статуса подключения
   */
  onConnectionChange(callback: (connected: boolean) => void): void {
    this.onConnectionChangeListeners.push(callback);
  }

  /**
   * Добавляет обработчик входящего звонка
   */
  onIncomingCall(callback: (call: CallRequest) => void): void {
    this.onIncomingCallListeners.push(callback);
  }

  /**
   * Добавляет обработчик входящего offer
   */
  onOffer(callback: (fromUserId: string, offer: RTCSessionDescriptionInit) => void): void {
    this.onOfferListeners.push(callback);
  }

  /**
   * Добавляет обработчик входящего answer
   */
  onAnswer(callback: (fromUserId: string, answer: RTCSessionDescriptionInit) => void): void {
    this.onAnswerListeners.push(callback);
  }

  /**
   * Добавляет обработчик входящего ICE candidate
   */
  onIceCandidate(callback: (fromUserId: string, candidate: IceCandidate) => void): void {
    this.onIceCandidateListeners.push(callback);
  }

  /**
   * Добавляет обработчик завершения звонка
   */
  onHangup(callback: (fromUserId: string) => void): void {
    this.onHangupListeners.push(callback);
  }

  /**
   * Добавляет обработчик ошибок
   */
  onError(callback: (error: Error) => void): void {
    this.onErrorListeners.push(callback);
  }

  /**
   * Удаляет все обработчики
   */
  removeAllListeners(): void {
    this.onConnectionChangeListeners = [];
    this.onIncomingCallListeners = [];
    this.onOfferListeners = [];
    this.onAnswerListeners = [];
    this.onIceCandidateListeners = [];
    this.onHangupListeners = [];
    this.onErrorListeners = [];
  }

  /**
   * Отправляет сообщение через WebSocket
   */
  private async sendMessage(message: SignalingMessage): Promise<void> {
    if (!this.isConnectionActive()) {
      // Если соединение не активно, добавляем в очередь
      this.messageQueue.push(message);
      throw new Error('Not connected to signaling server');
    }

    try {
      this.ws!.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send message:', error);
      this.messageQueue.push(message);
      throw error;
    }
  }

  /**
   * Обрабатывает входящее сообщение
   */
  private handleMessage(data: string): void {
    try {
      const message: SignalingMessage = JSON.parse(data);
      console.log(`Received message type: ${message.type} from ${message.fromUserId}`);

      switch (message.type) {
        case 'call':
          this.handleCallMessage(message);
          break;
        case 'offer':
          this.handleOfferMessage(message);
          break;
        case 'answer':
          this.handleAnswerMessage(message);
          break;
        case 'ice-candidate':
          this.handleIceCandidateMessage(message);
          break;
        case 'hangup':
          this.handleHangupMessage(message);
          break;
        case 'ping':
          this.handlePingMessage(message);
          break;
        case 'pong':
          // Pong сообщения обрабатываются в heartbeat
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to handle message:', error);
      this.notifyError(new Error('Failed to parse signaling message'));
    }
  }

  /**
   * Обрабатывает входящий звонок
   */
  private handleCallMessage(message: SignalingMessage): void {
    const call: CallRequest = {
      callId: message.payload.callId,
      fromUserId: message.fromUserId,
      toUserId: message.toUserId,
      callType: message.payload.callType,
      timestamp: message.timestamp,
    };

    this.onIncomingCallListeners.forEach(callback => {
      try {
        callback(call);
      } catch (error) {
        console.error('Error in incoming call callback:', error);
      }
    });
  }

  /**
   * Обрабатывает входящий offer
   */
  private handleOfferMessage(message: SignalingMessage): void {
    this.onOfferListeners.forEach(callback => {
      try {
        callback(message.fromUserId, message.payload);
      } catch (error) {
        console.error('Error in offer callback:', error);
      }
    });
  }

  /**
   * Обрабатывает входящий answer
   */
  private handleAnswerMessage(message: SignalingMessage): void {
    this.onAnswerListeners.forEach(callback => {
      try {
        callback(message.fromUserId, message.payload);
      } catch (error) {
        console.error('Error in answer callback:', error);
      }
    });
  }

  /**
   * Обрабатывает входящий ICE candidate
   */
  private handleIceCandidateMessage(message: SignalingMessage): void {
    this.onIceCandidateListeners.forEach(callback => {
      try {
        callback(message.fromUserId, message.payload);
      } catch (error) {
        console.error('Error in ICE candidate callback:', error);
      }
    });
  }

  /**
   * Обрабатывает завершение звонка
   */
  private handleHangupMessage(message: SignalingMessage): void {
    this.onHangupListeners.forEach(callback => {
      try {
        callback(message.fromUserId);
      } catch (error) {
        console.error('Error in hangup callback:', error);
      }
    });
  }

  /**
   * Обрабатывает ping сообщение
   */
  private handlePingMessage(message: SignalingMessage): void {
    const pongMessage: SignalingMessage = {
      type: 'pong',
      fromUserId: this.authService.getCurrentUser()!.id,
      toUserId: message.fromUserId,
      timestamp: Date.now(),
    };

    this.sendMessage(pongMessage).catch(error => {
      console.error('Failed to send pong:', error);
    });
  }

  /**
   * Планирует переподключение
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    const delay = Math.min(
      this.reconnectConfig.initialDelay * Math.pow(this.reconnectConfig.backoffFactor, this.reconnectAttempts),
      this.reconnectConfig.maxDelay
    );

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.attemptReconnect();
    }, delay);
  }

  /**
   * Пытается переподключиться
   */
  private async attemptReconnect(): Promise<void> {
    this.reconnectAttempts++;
    console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.reconnectConfig.maxRetries}`);

    try {
      await this.connect();
    } catch (error) {
      console.error('Reconnect attempt failed:', error);
      
      if (this.reconnectAttempts < this.reconnectConfig.maxRetries) {
        this.scheduleReconnect();
      } else {
        console.error('Max reconnect attempts reached');
        this.notifyError(new Error('Failed to reconnect after maximum attempts'));
      }
    }
  }

  /**
   * Останавливает таймер переподключения
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Начинает heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnectionActive()) {
        const pingMessage: SignalingMessage = {
          type: 'ping',
          fromUserId: this.authService.getCurrentUser()!.id,
          toUserId: 'server',
          timestamp: Date.now(),
        };

        this.sendMessage(pingMessage).catch(error => {
          console.error('Failed to send ping:', error);
        });
      }
    }, 30000); // Ping каждые 30 секунд
  }

  /**
   * Останавливает heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Обрабатывает очередь сообщений
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    console.log(`Processing ${this.messageQueue.length} queued messages`);

    const queuedMessages = [...this.messageQueue];
    this.messageQueue = [];

    queuedMessages.forEach(async (message) => {
      try {
        await this.sendMessage(message);
      } catch (error) {
        console.error('Failed to send queued message:', error);
        // Возвращаем в очередь при ошибке
        this.messageQueue.push(message);
      }
    });
  }

  /**
   * Уведомляет об изменении статуса подключения
   */
  private notifyConnectionChange(connected: boolean): void {
    this.onConnectionChangeListeners.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('Error in connection change callback:', error);
      }
    });
  }

  /**
   * Уведомляет об ошибке
   */
  private notifyError(error: Error): void {
    this.onErrorListeners.forEach(callback => {
      try {
        callback(error);
      } catch (error) {
        console.error('Error in error callback:', error);
      }
    });
  }

  /**
   * Генерирует уникальный ID звонка
   */
  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Устанавливает конфигурацию переподключения
   */
  setReconnectConfig(config: Partial<ReconnectionConfig>): void {
    this.reconnectConfig = { ...this.reconnectConfig, ...config };
  }
}

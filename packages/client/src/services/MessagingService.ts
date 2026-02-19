import { CryptoService } from './CryptoService';
import { AuthService } from './AuthService';

/**
 * MessagingService - Модуль обмена сообщениями
 * 
 * Управляет:
 * - Отправкой и получением текстовых сообщений с шифрованием
 * - Отправкой медиа-файлов и голосовых сообщений
 * - Хранением истории сообщений в IndexedDB
 * - Расшифровкой входящих сообщений
 */

export interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  type: 'text' | 'media' | 'voice';
  timestamp: number;
  encrypted: boolean;
  delivered?: boolean;
  read?: boolean;
  mediaUrl?: string;
  mediaType?: string;
  voiceDuration?: number;
}

export interface MessageRequest {
  toUserId: string;
  content: string;
  type: 'text' | 'media' | 'voice';
  mediaFile?: File;
  voiceDuration?: number;
}

export interface MessageHistoryRequest {
  userId: string;
  limit?: number;
  offset?: number;
  before?: number;
}

export interface MessageHistoryResponse {
  messages: Message[];
  hasMore: boolean;
  total: number;
}

export class MessagingService {
  private cryptoService: CryptoService;
  private authService: AuthService;
  private dbName = 'SecureMessengerDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  constructor(cryptoService: CryptoService, authService: AuthService) {
    this.cryptoService = cryptoService;
    this.authService = authService;
    this.initDatabase();
  }

  /**
   * Инициализирует IndexedDB для хранения сообщений
   */
  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Создаем хранилище для сообщений
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', {
            keyPath: 'id',
          });
          messageStore.createIndex('fromUserId', 'fromUserId', { unique: false });
          messageStore.createIndex('toUserId', 'toUserId', { unique: false });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
          messageStore.createIndex('conversation', ['fromUserId', 'toUserId'], { unique: false });
        }

        // Создаем хранилище для медиа-файлов
        if (!db.objectStoreNames.contains('media')) {
          const mediaStore = db.createObjectStore('media', {
            keyPath: 'id',
          });
          mediaStore.createIndex('messageId', 'messageId', { unique: false });
        }
      };
    });
  }

  /**
   * Отправляет текстовое сообщение с шифрованием
   */
  async sendTextMessage(toUserId: string, content: string): Promise<Message> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const keyPair = this.authService.getKeyPair();
      if (!keyPair) {
        throw new Error('User key pair not available');
      }

      // Получаем публичный ключ получателя
      const recipientPublicKey = await this.getRecipientPublicKey(toUserId);
      if (!recipientPublicKey) {
        throw new Error('Recipient public key not available');
      }

      const sharedSecret = await this.cryptoService.deriveSharedSecret(
        keyPair.privateKey,
        recipientPublicKey
      );

      // Шифруем сообщение
      const encryptedContent = await this.cryptoService.encryptMessage(content, sharedSecret);

      // Создаем объект сообщения
      const message: Message = {
        id: this.generateMessageId(),
        fromUserId: currentUser.id,
        toUserId,
        content: JSON.stringify(encryptedContent),
        type: 'text',
        timestamp: Date.now(),
        encrypted: true,
        delivered: false,
        read: false,
      };

      // Сохраняем сообщение локально
      await this.saveMessage(message);

      // Отправляем на сервер
      await this.sendMessageToServer(message);

      console.log(`Text message sent to ${toUserId}`);
      return message;
    } catch (error) {
      console.error('Failed to send text message:', error);
      throw error;
    }
  }

  /**
   * Отправляет медиа-файл с шифрованием
   */
  async sendMediaFile(toUserId: string, file: File): Promise<Message> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Проверяем размер файла (максимум 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        throw new Error('File size exceeds 50MB limit');
      }

      // Получаем публичный ключ получателя
      const recipientPublicKey = await this.getRecipientPublicKey(toUserId);
      if (!recipientPublicKey) {
        throw new Error('Recipient public key not available');
      }

      // Генерируем общий секретный ключ
      const keyPair = this.authService.getKeyPair();
      if (!keyPair) {
        throw new Error('User key pair not available');
      }

      const sharedSecret = await this.cryptoService.deriveSharedSecret(
        keyPair.privateKey,
        recipientPublicKey
      );

      // Шифруем файл
      const encryptedFile = await this.cryptoService.encryptFile(file, sharedSecret);

      // Конвертируем EncryptedData в Blob для загрузки
      const encryptedBlob = new Blob([
        JSON.stringify({
          ciphertext: Array.from(new Uint8Array(encryptedFile.ciphertext)),
          iv: Array.from(encryptedFile.iv),
          tag: encryptedFile.tag ? Array.from(encryptedFile.tag) : undefined,
        })
      ]);

      // Создаем объект сообщения
      const message: Message = {
        id: this.generateMessageId(),
        fromUserId: currentUser.id,
        toUserId,
        content: '', // Будет заполнено URL после загрузки
        type: 'media',
        timestamp: Date.now(),
        encrypted: true,
        delivered: false,
        read: false,
        mediaType: file.type,
      };

      // Сохраняем сообщение локально
      await this.saveMessage(message);

      // Загружаем зашифрованный файл на сервер
      const mediaUrl = await this.uploadMediaFile(encryptedBlob, message.id);
      message.mediaUrl = mediaUrl;

      // Обновляем сообщение с URL
      await this.updateMessage(message);

      // Отправляем сообщение на сервер
      await this.sendMessageToServer(message);

      console.log(`Media file sent to ${toUserId}`);
      return message;
    } catch (error) {
      console.error('Failed to send media file:', error);
      throw error;
    }
  }

  /**
   * Отправляет голосовое сообщение с шифрованием
   */
  async sendVoiceMessage(toUserId: string, audioBlob: Blob, duration: number): Promise<Message> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Проверяем длительность (максимум 5 минут)
      const maxDuration = 5 * 60 * 1000; // 5 минут
      if (duration > maxDuration) {
        throw new Error('Voice message duration exceeds 5 minutes limit');
      }

      // Получаем публичный ключ получателя
      const recipientPublicKey = await this.getRecipientPublicKey(toUserId);
      if (!recipientPublicKey) {
        throw new Error('Recipient public key not available');
      }

      // Генерируем общий секретный ключ
      const keyPair = this.authService.getKeyPair();
      if (!keyPair) {
        throw new Error('User key pair not available');
      }

      const sharedSecret = await this.cryptoService.deriveSharedSecret(
        keyPair.privateKey,
        recipientPublicKey
      );

      // Шифруем голосовое сообщение
      const encryptedAudio = await this.cryptoService.encryptFile(audioBlob, sharedSecret);

      // Конвертируем EncryptedData в Blob для загрузки
      const encryptedBlob = new Blob([
        JSON.stringify({
          ciphertext: Array.from(new Uint8Array(encryptedAudio.ciphertext)),
          iv: Array.from(encryptedAudio.iv),
          tag: encryptedAudio.tag ? Array.from(encryptedAudio.tag) : undefined,
        })
      ]);

      // Создаем объект сообщения
      const message: Message = {
        id: this.generateMessageId(),
        fromUserId: currentUser.id,
        toUserId,
        content: '', // Будет заполнено URL после загрузки
        type: 'voice',
        timestamp: Date.now(),
        encrypted: true,
        delivered: false,
        read: false,
        mediaType: 'audio/webm',
        voiceDuration: duration,
      };

      // Сохраняем сообщение локально
      await this.saveMessage(message);

      // Загружаем зашифрованный файл на сервер
      const mediaUrl = await this.uploadMediaFile(encryptedBlob, message.id);
      message.mediaUrl = mediaUrl;

      // Обновляем сообщение с URL
      await this.updateMessage(message);

      // Отправляем сообщение на сервер
      await this.sendMessageToServer(message);

      console.log(`Voice message sent to ${toUserId}`);
      return message;
    } catch (error) {
      console.error('Failed to send voice message:', error);
      throw error;
    }
  }

  /**
   * Получает историю сообщений с расшифровкой
   */
  async getMessageHistory(userId: string, limit: number = 50, offset: number = 0): Promise<MessageHistoryResponse> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Получаем сообщения из IndexedDB
      const messages = await this.getMessagesFromDB(currentUser.id, userId, limit, offset);

      // Расшифровываем содержимое сообщений
      const decryptedMessages = await this.decryptMessages(messages);

      // Получаем общее количество сообщений
      const total = await this.getMessageCount(currentUser.id, userId);

      return {
        messages: decryptedMessages,
        hasMore: offset + limit < total,
        total,
      };
    } catch (error) {
      console.error('Failed to get message history:', error);
      throw error;
    }
  }

  /**
   * Обрабатывает входящее сообщение
   */
  async handleIncomingMessage(messageData: any): Promise<Message> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Расшифровываем сообщение
      const decryptedMessage = await this.decryptMessage(messageData);

      // Сохраняем сообщение локально
      await this.saveMessage(decryptedMessage);

      console.log(`Incoming message from ${messageData.fromUserId}`);
      return decryptedMessage;
    } catch (error) {
      console.error('Failed to handle incoming message:', error);
      throw error;
    }
  }

  /**
   * Отмечает сообщение как доставленное
   */
  async markAsDelivered(messageId: string): Promise<void> {
    try {
      // Обновляем в IndexedDB
      await this.updateMessageStatus(messageId, 'delivered', true);

      // Отправляем подтверждение на сервер
      await this.sendStatusToServer(messageId, 'delivered');

      console.log(`Message ${messageId} marked as delivered`);
    } catch (error) {
      console.error('Failed to mark message as delivered:', error);
      throw error;
    }
  }

  /**
   * Отмечает сообщение как прочитанное
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      // Обновляем в IndexedDB
      await this.updateMessageStatus(messageId, 'read', true);

      // Отправляем подтверждение на сервер
      await this.sendStatusToServer(messageId, 'read');

      console.log(`Message ${messageId} marked as read`);
    } catch (error) {
      console.error('Failed to mark message as read:', error);
      throw error;
    }
  }

  /**
   * Получает публичный ключ получателя
   */
  private async getRecipientPublicKey(userId: string): Promise<CryptoKey | null> {
    try {
      // В реальном приложении здесь будет запрос к серверу
      // для получения публичного ключа пользователя
      const response = await fetch(`/api/users/${userId}/public-key`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return this.cryptoService.importPublicKey(data.publicKey);
    } catch (error) {
      console.error('Failed to get recipient public key:', error);
      return null;
    }
  }

  /**
   * Генерирует уникальный ID сообщения
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Сохраняет сообщение в IndexedDB
   */
  private async saveMessage(message: Message): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const request = store.put(message);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Обновляет сообщение в IndexedDB
   */
  private async updateMessage(message: Message): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const request = store.put(message);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Получает сообщения из IndexedDB
   */
  private async getMessagesFromDB(
    fromUserId: string,
    toUserId: string,
    limit: number,
    offset: number
  ): Promise<Message[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('conversation');
      
      // Получаем сообщения в обе стороны
      const request1 = index.getAll([fromUserId, toUserId]);
      const request2 = index.getAll([toUserId, fromUserId]);

      Promise.all([this.getRequestPromise<Message[]>(request1), this.getRequestPromise<Message[]>(request2)])
        .then(([messages1, messages2]) => {
          const allMessages = [...messages1, ...messages2]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(offset, offset + limit);
          resolve(allMessages);
        })
        .catch(reject);
    });
  }

  /**
   * Получает общее количество сообщений
   */
  private async getMessageCount(fromUserId: string, toUserId: string): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('conversation');
      
      const request1 = index.count([fromUserId, toUserId]);
      const request2 = index.count([toUserId, fromUserId]);

      Promise.all([this.getRequestPromise<number>(request1), this.getRequestPromise<number>(request2)])
        .then(([count1, count2]) => {
          resolve((count1 || 0) + (count2 || 0));
        })
        .catch(reject);
    });
  }

  /**
   * Расшифровывает сообщения
   */
  private async decryptMessages(messages: Message[]): Promise<Message[]> {
    const decryptedMessages: Message[] = [];

    for (const message of messages) {
      try {
        const decryptedMessage = await this.decryptMessage(message);
        decryptedMessages.push(decryptedMessage);
      } catch (error) {
        console.error(`Failed to decrypt message ${message.id}:`, error);
        // Добавляем сообщение с ошибкой расшифровки
        decryptedMessages.push({
          ...message,
          content: '[Decryption failed]',
        });
      }
    }

    return decryptedMessages;
  }

  /**
   * Расшифровывает одно сообщение
   */
  private async decryptMessage(message: Message): Promise<Message> {
    if (!message.encrypted) {
      return message;
    }

    const keyPair = this.authService.getKeyPair();
    if (!keyPair) {
      throw new Error('User key pair not available');
    }

    // Получаем публичный ключ отправителя
    const senderPublicKey = await this.getRecipientPublicKey(message.fromUserId);
    if (!senderPublicKey) {
      throw new Error('Sender public key not available');
    }

    // Генерируем общий секретный ключ
    const sharedSecret = await this.cryptoService.deriveSharedSecret(
      keyPair.privateKey,
      senderPublicKey
    );

    // Расшифровываем содержимое
    if (message.type === 'text') {
      const encryptedData = JSON.parse(message.content);
      const decryptedContent = await this.cryptoService.decryptMessage(encryptedData, sharedSecret);
      return { ...message, content: decryptedContent };
    } else if (message.mediaUrl) {
      // Для медиа файлов расшифровка происходит при загрузке
      return message;
    }

    return message;
  }

  /**
   * Обновляет статус сообщения
   */
  private async updateMessageStatus(messageId: string, status: 'delivered' | 'read', value: boolean): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const request = store.get(messageId);

      request.onsuccess = () => {
        const message = request.result;
        if (message) {
          message[status] = value;
          const updateRequest = store.put(message);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Отправляет сообщение на сервер
   */
  private async sendMessageToServer(message: Message): Promise<void> {
    const token = this.authService.getToken();
    if (!token) {
      throw new Error('Authentication token not available');
    }

    const response = await fetch('/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error('Failed to send message to server');
    }
  }

  /**
   * Загружает медиа-файл на сервер
   */
  private async uploadMediaFile(file: Blob, messageId: string): Promise<string> {
    const token = this.authService.getToken();
    if (!token) {
      throw new Error('Authentication token not available');
    }

    const formData = new FormData();
    formData.append('file', file, `${messageId}.encrypted`);
    formData.append('messageId', messageId);

    const response = await fetch('/api/media/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload media file');
    }

    const data = await response.json();
    return data.url;
  }

  /**
   * Отправляет статус на сервер
   */
  private async sendStatusToServer(messageId: string, status: 'delivered' | 'read'): Promise<void> {
    const token = this.authService.getToken();
    if (!token) {
      throw new Error('Authentication token not available');
    }

    const response = await fetch(`/api/messages/${messageId}/${status}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to mark message as ${status}`);
    }
  }

  /**
   * Вспомогательный метод для получения результата запроса IndexedDB
   */
  private getRequestPromise<T>(request: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  }
}

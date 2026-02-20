import { Pool } from 'pg';
import { EventEmitter } from 'events';

/**
 * MessageService - Сервис управления сообщениями
 * 
 * Управляет:
 * - Сохранением и получением сообщений
 * - Статусами доставки и прочтения
 * - Валидацией данных сообщений
 * - Интеграцией с WebSocket для реального времени
 */

export interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  type: 'text' | 'media' | 'voice';
  timestamp: Date;
  encrypted: boolean;
  delivered?: boolean;
  read?: boolean;
  mediaUrl?: string;
  mediaType?: string;
  voiceDuration?: number;
}

export interface SendMessageRequest {
  fromUserId: string;
  toUserId: string;
  content: string;
  type: 'text' | 'media' | 'voice';
  mediaUrl?: string;
  mediaType?: string;
  voiceDuration?: number;
  encrypted?: boolean;
}

export interface MessageHistoryResponse {
  messages: Message[];
  hasMore: boolean;
  total: number;
}

export class MessageService extends EventEmitter {
  private pool: Pool;

  constructor(pool: Pool) {
    super();
    this.pool = pool;
    this.initializeDatabase();
  }

  /**
   * Инициализирует таблицы для сообщений
   */
  private async initializeDatabase(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Создаем таблицу сообщений
      const createMessagesTable = `
        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          type VARCHAR(20) NOT NULL CHECK (type IN ('text', 'media', 'voice')),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          encrypted BOOLEAN DEFAULT FALSE,
          delivered BOOLEAN DEFAULT FALSE,
          read BOOLEAN DEFAULT FALSE,
          media_url TEXT,
          media_type VARCHAR(100),
          voice_duration INTEGER
        );
      `;

      // Создаем индексы
      const createIndexes = `
        CREATE INDEX IF NOT EXISTS idx_messages_from_user ON messages(from_user_id);
        CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id);
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(from_user_id, to_user_id, timestamp);
      `;

      await client.query(createMessagesTable);
      await client.query(createIndexes);
      await client.query('COMMIT');

      console.log('MessageService database initialized successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to initialize MessageService database:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Отправляет сообщение
   */
  async sendMessage(request: SendMessageRequest): Promise<Message> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Проверяем существование получателя
      const recipientCheck = await client.query(
        'SELECT id FROM users WHERE id = $1',
        [request.toUserId]
      );

      if (recipientCheck.rows.length === 0) {
        throw new Error('Recipient not found');
      }

      // Валидируем данные сообщения
      this.validateMessageData(request);

      // Создаем сообщение
      const result = await client.query(
        `INSERT INTO messages (from_user_id, to_user_id, content, type, encrypted, media_url, media_type, voice_duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, from_user_id, to_user_id, content, type, timestamp, encrypted, delivered, read, media_url, media_type, voice_duration`,
        [
          request.fromUserId,
          request.toUserId,
          request.content,
          request.type,
          request.encrypted || false,
          request.mediaUrl || null,
          request.mediaType || null,
          request.voiceDuration || null
        ]
      );

      const messageData = result.rows[0];
      const message: Message = {
        id: messageData.id,
        fromUserId: messageData.from_user_id,
        toUserId: messageData.to_user_id,
        content: messageData.content,
        type: messageData.type,
        timestamp: messageData.timestamp,
        encrypted: messageData.encrypted,
        delivered: messageData.delivered,
        read: messageData.read,
        mediaUrl: messageData.media_url,
        mediaType: messageData.media_type,
        voiceDuration: messageData.voice_duration,
      };

      await client.query('COMMIT');

      // Отправляем уведомление через WebSocket
      this.emit('new_message', {
        type: 'new_message',
        messageId: message.id,
        fromUserId: message.fromUserId,
        toUserId: message.toUserId,
        timestamp: message.timestamp.getTime(),
      });

      console.log(`Message sent from ${message.fromUserId} to ${message.toUserId}`);
      return message;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получает историю сообщений между двумя пользователями
   */
  async getMessageHistory(
    userId: string,
    otherUserId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<MessageHistoryResponse> {
    const client = await this.pool.connect();
    
    try {
      // Получаем сообщения в обе стороны
      const query = `
        SELECT id, from_user_id, to_user_id, content, type, timestamp, encrypted, 
               delivered, read, media_url, media_type, voice_duration
        FROM messages
        WHERE (from_user_id = $1 AND to_user_id = $2) 
           OR (from_user_id = $2 AND to_user_id = $1)
        ORDER BY timestamp DESC
        LIMIT $3 OFFSET $4
      `;

      const result = await client.query(query, [userId, otherUserId, limit, offset]);
      
      // Получаем общее количество сообщений
      const countQuery = `
        SELECT COUNT(*) as total
        FROM messages
        WHERE (from_user_id = $1 AND to_user_id = $2) 
           OR (from_user_id = $2 AND to_user_id = $1)
      `;

      const countResult = await client.query(countQuery, [userId, otherUserId]);
      const total = parseInt(countResult.rows[0].total);

      const messages: Message[] = result.rows.map(row => ({
        id: row.id,
        fromUserId: row.from_user_id,
        toUserId: row.to_user_id,
        content: row.content,
        type: row.type,
        timestamp: row.timestamp,
        encrypted: row.encrypted,
        delivered: row.delivered,
        read: row.read,
        mediaUrl: row.media_url,
        mediaType: row.media_type,
        voiceDuration: row.voice_duration,
      }));

      return {
        messages: messages.reverse(), // Возвращаем в хронологическом порядке
        hasMore: offset + limit < total,
        total,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Отмечает сообщение как доставленное
   */
  async markMessageAsDelivered(messageId: string, userId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Проверяем, что пользователь является получателем сообщения
      const messageCheck = await client.query(
        'SELECT id, to_user_id FROM messages WHERE id = $1',
        [messageId]
      );

      if (messageCheck.rows.length === 0) {
        throw new Error('Message not found');
      }

      const message = messageCheck.rows[0];
      if (message.to_user_id !== userId) {
        throw new Error('Access denied');
      }

      // Обновляем статус доставки
      await client.query(
        'UPDATE messages SET delivered = TRUE WHERE id = $1',
        [messageId]
      );

      await client.query('COMMIT');

      // Отправляем уведомление об обновлении статуса
      this.emit('message_status_updated', {
        type: 'message_delivered',
        messageId,
        userId,
        timestamp: Date.now(),
      });

      console.log(`Message ${messageId} marked as delivered`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Отмечает сообщение как прочитанное
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Проверяем, что пользователь является получателем сообщения
      const messageCheck = await client.query(
        'SELECT id, to_user_id FROM messages WHERE id = $1',
        [messageId]
      );

      if (messageCheck.rows.length === 0) {
        throw new Error('Message not found');
      }

      const message = messageCheck.rows[0];
      if (message.to_user_id !== userId) {
        throw new Error('Access denied');
      }

      // Обновляем статус прочтения
      await client.query(
        'UPDATE messages SET read = TRUE, delivered = TRUE WHERE id = $1',
        [messageId]
      );

      await client.query('COMMIT');

      // Отправляем уведомление об обновлении статуса
      this.emit('message_status_updated', {
        type: 'message_read',
        messageId,
        userId,
        timestamp: Date.now(),
      });

      console.log(`Message ${messageId} marked as read`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получает непрочитанные сообщения для пользователя
   */
  async getUnreadMessages(userId: string): Promise<Message[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `SELECT id, from_user_id, to_user_id, content, type, timestamp, encrypted, 
                delivered, read, media_url, media_type, voice_duration
         FROM messages
         WHERE to_user_id = $1 AND read = FALSE
         ORDER BY timestamp ASC`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        fromUserId: row.from_user_id,
        toUserId: row.to_user_id,
        content: row.content,
        type: row.type,
        timestamp: row.timestamp,
        encrypted: row.encrypted,
        delivered: row.delivered,
        read: row.read,
        mediaUrl: row.media_url,
        mediaType: row.media_type,
        voiceDuration: row.voice_duration,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Валидирует данные сообщения
   */
  private validateMessageData(request: SendMessageRequest): void {
    if (!request.fromUserId || !request.toUserId) {
      throw new Error('Invalid message data: fromUserId and toUserId are required');
    }

    if (request.fromUserId === request.toUserId) {
      throw new Error('Cannot send message to yourself');
    }

    if (!request.content || request.content.trim().length === 0) {
      throw new Error('Invalid message data: content cannot be empty');
    }

    if (request.type === 'media' && !request.mediaUrl) {
      throw new Error('Media messages must have mediaUrl');
    }

    if (request.type === 'voice' && (!request.mediaUrl || !request.voiceDuration)) {
      throw new Error('Voice messages must have mediaUrl and voiceDuration');
    }

    // Проверяем длину контента для текстовых сообщений
    if (request.type === 'text' && request.content.length > 4000) {
      throw new Error('Text message too long (max 4000 characters)');
    }

    // Проверяем длительность голосовых сообщений (максимум 5 минут)
    if (request.voiceDuration && request.voiceDuration > 300000) {
      throw new Error('Voice message duration too long (max 5 minutes)');
    }
  }

  /**
   * Получает статистику сообщений для пользователя
   */
  async getMessageStats(userId: string): Promise<{
    totalSent: number;
    totalReceived: number;
    unreadCount: number;
  }> {
    const client = await this.pool.connect();
    
    try {
      const sentQuery = await client.query(
        'SELECT COUNT(*) as count FROM messages WHERE from_user_id = $1',
        [userId]
      );

      const receivedQuery = await client.query(
        'SELECT COUNT(*) as count FROM messages WHERE to_user_id = $1',
        [userId]
      );

      const unreadQuery = await client.query(
        'SELECT COUNT(*) as count FROM messages WHERE to_user_id = $1 AND read = FALSE',
        [userId]
      );

      return {
        totalSent: parseInt(sentQuery.rows[0].count),
        totalReceived: parseInt(receivedQuery.rows[0].count),
        unreadCount: parseInt(unreadQuery.rows[0].count),
      };
    } finally {
      client.release();
    }
  }
}

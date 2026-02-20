import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { AuthMiddleware } from '../auth/AuthMiddleware';

/**
 * UserManager - Управление пользователями и контактами
 * 
 * Работает с PostgreSQL базой данных для:
 * - Создания и аутентификации пользователей
 * - Управления контактами
 * - Хранения пользовательских данных
 */

export interface User {
  id: string;
  username: string;
  email?: string;
  publicKey?: string;
  createdAt: Date;
  lastSeen?: Date;
  isOnline: boolean;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  email?: string;
  publicKey?: string;
  deviceId?: string;
  deviceName?: string;
  userAgent?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  deviceId?: string;
  deviceName?: string;
  userAgent?: string;
}

export interface Contact {
  id: string;
  userId: string;
  contactUserId: string;
  contactUsername: string;
  addedAt: Date;
  nickname?: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
}

export class UserManager {
  private pool: Pool;
  private authMiddleware: AuthMiddleware;

  constructor(dbConfig: DatabaseConfig, authMiddleware: AuthMiddleware) {
    this.authMiddleware = authMiddleware;
    
    this.pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.username,
      password: dbConfig.password,
      ssl: dbConfig.ssl,
      max: dbConfig.maxConnections || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.initializeDatabase();
  }

  /**
   * Получает пул соединений с базой данных
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * Инициализирует базу данных и создает таблицы
   */
  private async initializeDatabase(): Promise<void> {
    try {
      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Создает необходимые таблицы
   */
  private async createTables(): Promise<void> {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        public_key TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP WITH TIME ZONE,
        is_online BOOLEAN DEFAULT FALSE,
        CONSTRAINT username_length CHECK (LENGTH(username) >= 3),
        CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_-]+$')
      );
    `;

    const createDevicesTable = `
      CREATE TABLE IF NOT EXISTS user_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id VARCHAR(255) NOT NULL,
        device_name VARCHAR(100),
        user_agent TEXT,
        last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
      );
    `;

    const createContactsTable = `
      CREATE TABLE IF NOT EXISTS contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        nickname VARCHAR(100),
        CONSTRAINT unique_contact UNIQUE (user_id, contact_user_id),
        CONSTRAINT no_self_contact CHECK (user_id != contact_user_id)
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);
      CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_contact_user_id ON contacts(contact_user_id);
      CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON user_devices(device_id);
    `;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(createUsersTable);
      await client.query(createDevicesTable);
      await client.query(createContactsTable);
      await client.query(createIndexes);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Создает нового пользователя
   */
  async createUser(request: CreateUserRequest): Promise<{ user: User; token: string }> {
    const client = await this.pool.connect();
    
    try {
      // Проверяем, что пользователь с таким именем не существует
      const existingUser = await client.query(
        'SELECT id FROM users WHERE username = $1',
        [request.username]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Username already exists');
      }

      // Проверяем email, если указан
      if (request.email) {
        const existingEmail = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [request.email]
        );

        if (existingEmail.rows.length > 0) {
          throw new Error('Email already exists');
        }
      }

      // Хешируем пароль
      const passwordHash = await bcrypt.hash(request.password, 12);

      // Создаем пользователя
      const result = await client.query(
        `INSERT INTO users (username, email, password_hash, public_key) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, username, email, public_key, created_at, last_seen, is_online`,
        [request.username, request.email, passwordHash, request.publicKey]
      );

      const userData = result.rows[0];
      const user: User = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        publicKey: userData.public_key,
        createdAt: userData.created_at,
        lastSeen: userData.last_seen,
        isOnline: userData.is_online,
      };

      // Генерируем JWT токен
      const token = this.authMiddleware.generateToken({
        userId: user.id,
        username: user.username,
      });

      // Добавляем устройство, если указано
      if (request.deviceId) {
        await this.addOrUpdateDevice(user.id, request.deviceId, request.deviceName, request.userAgent);
      }

      console.log(`User created: ${user.username} (${user.id})`);
      return { user, token };
    } finally {
      client.release();
    }
  }

  /**
   * Аутентифицирует пользователя
   */
  async login(request: LoginRequest): Promise<{ user: User; token: string }> {
    const client = await this.pool.connect();
    
    try {
      // Находим пользователя по username
      const result = await client.query(
        'SELECT id, username, email, password_hash, public_key, created_at, last_seen, is_online FROM users WHERE username = $1',
        [request.username]
      );

      if (result.rows.length === 0) {
        throw new Error('Invalid username or password');
      }

      const userData = result.rows[0];

      // Проверяем пароль
      const isPasswordValid = await bcrypt.compare(request.password, userData.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid username or password');
      }

      const user: User = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        publicKey: userData.public_key,
        createdAt: userData.created_at,
        lastSeen: userData.last_seen,
        isOnline: userData.is_online,
      };

      // Обновляем last_seen и is_online
      await client.query(
        'UPDATE users SET last_seen = CURRENT_TIMESTAMP, is_online = TRUE WHERE id = $1',
        [user.id]
      );

      // Генерируем JWT токен
      const token = this.authMiddleware.generateToken({
        userId: user.id,
        username: user.username,
      });

      // Добавляем устройство, если указано
      if (request.deviceId) {
        await this.addOrUpdateDevice(user.id, request.deviceId, request.deviceName, request.userAgent);
      }

      console.log(`User logged in: ${user.username} (${user.id})`);
      return { user, token };
    } finally {
      client.release();
    }
  }

  /**
   * Получает пользователя по ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT id, username, email, public_key, created_at, last_seen, is_online FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const userData = result.rows[0];
      return {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        publicKey: userData.public_key,
        createdAt: userData.created_at,
        lastSeen: userData.last_seen,
        isOnline: userData.is_online,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Получает пользователя по username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT id, username, email, public_key, created_at, last_seen, is_online FROM users WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const userData = result.rows[0];
      return {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        publicKey: userData.public_key,
        createdAt: userData.created_at,
        lastSeen: userData.last_seen,
        isOnline: userData.is_online,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Обновляет онлайн статус пользователя
   */
  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        'UPDATE users SET is_online = $1, last_seen = CURRENT_TIMESTAMP WHERE id = $2',
        [isOnline, userId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Обновляет публичный ключ пользователя
   */
  async updatePublicKey(userId: string, publicKey: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'UPDATE users SET public_key = $1 WHERE id = $2',
        [publicKey, userId]
      );

      if (result.rowCount === 0) {
        throw new Error('User not found');
      }

      console.log(`Public key updated for user: ${userId}`);
    } finally {
      client.release();
    }
  }

  /**
   * Добавляет контакт
   */
  async addContact(userId: string, contactUsername: string, nickname?: string): Promise<Contact> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Находим контакт пользователя
      const contactResult = await client.query(
        'SELECT id, username FROM users WHERE username = $1',
        [contactUsername]
      );

      if (contactResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const contactUser = contactResult.rows[0];

      // Проверяем, что контакт еще не добавлен
      const existingContact = await client.query(
        'SELECT id FROM contacts WHERE user_id = $1 AND contact_user_id = $2',
        [userId, contactUser.id]
      );

      if (existingContact.rows.length > 0) {
        throw new Error('Contact already exists');
      }

      // Добавляем контакт
      const result = await client.query(
        `INSERT INTO contacts (user_id, contact_user_id, contact_username, nickname) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, user_id, contact_user_id, contact_username, added_at, nickname`,
        [userId, contactUser.id, contactUser.username, nickname]
      );

      await client.query('COMMIT');

      const contactData = result.rows[0];
      return {
        id: contactData.id,
        userId: contactData.user_id,
        contactUserId: contactData.contact_user_id,
        contactUsername: contactData.contact_username,
        addedAt: contactData.added_at,
        nickname: contactData.nickname,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Удаляет контакт
   */
  async removeContact(userId: string, contactUserId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'DELETE FROM contacts WHERE user_id = $1 AND contact_user_id = $2',
        [userId, contactUserId]
      );

      if (result.rowCount === 0) {
        throw new Error('Contact not found');
      }
    } finally {
      client.release();
    }
  }

  /**
   * Получает контакты пользователя
   */
  async getContacts(userId: string): Promise<Contact[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `SELECT c.id, c.user_id, c.contact_user_id, c.contact_username, c.added_at, c.nickname,
                u.is_online as contact_is_online
         FROM contacts c
         JOIN users u ON c.contact_user_id = u.id
         WHERE c.user_id = $1
         ORDER BY c.added_at DESC`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        contactUserId: row.contact_user_id,
        contactUsername: row.contact_username,
        addedAt: row.added_at,
        nickname: row.nickname,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Закрывает соединение с базой данных
   */
  async close(): Promise<void> {
    await this.pool.end();
    console.log('Database connection closed');
  }

  /**
   * Добавляет или обновляет устройство пользователя
   */
  private async addOrUpdateDevice(
    userId: string, 
    deviceId: string, 
    deviceName?: string, 
    userAgent?: string
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Проверяем, существует ли устройство
      const existingDevice = await client.query(
        'SELECT id FROM user_devices WHERE user_id = $1 AND device_id = $2',
        [userId, deviceId]
      );

      if (existingDevice.rows.length > 0) {
        // Обновляем существующее устройство
        await client.query(
          `UPDATE user_devices 
           SET last_used = CURRENT_TIMESTAMP, 
               device_name = COALESCE($3, device_name), 
               user_agent = COALESCE($4, user_agent),
               is_active = TRUE 
           WHERE user_id = $1 AND device_id = $2`,
          [userId, deviceId, deviceName, userAgent]
        );
      } else {
        // Создаем новое устройство
        await client.query(
          `INSERT INTO user_devices (user_id, device_id, device_name, user_agent) 
           VALUES ($1, $2, $3, $4)`,
          [userId, deviceId, deviceName, userAgent]
        );
      }

      console.log(`Device ${deviceId} registered/updated for user ${userId}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает устройства пользователя
   */
  async getUserDevices(userId: string): Promise<Array<{
    id: string;
    deviceId: string;
    deviceName?: string;
    userAgent?: string;
    lastUsed: Date;
    createdAt: Date;
    isActive: boolean;
  }>> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `SELECT id, device_id, device_name, user_agent, last_used, created_at, is_active
         FROM user_devices 
         WHERE user_id = $1 
         ORDER BY last_used DESC`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        deviceId: row.device_id,
        deviceName: row.device_name,
        userAgent: row.user_agent,
        lastUsed: row.last_used,
        createdAt: row.created_at,
        isActive: row.is_active,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Проверяет, существует ли устройство для пользователя
   */
  async checkDeviceExists(userId: string, deviceId: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT id FROM user_devices WHERE user_id = $1 AND device_id = $2 AND is_active = TRUE',
        [userId, deviceId]
      );

      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Деактивирует устройство пользователя
   */
  async deactivateDevice(userId: string, deviceId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        'UPDATE user_devices SET is_active = FALSE WHERE user_id = $1 AND device_id = $2',
        [userId, deviceId]
      );

      console.log(`Device ${deviceId} deactivated for user ${userId}`);
    } finally {
      client.release();
    }
  }

  /**
   * Поиск пользователей по username
   */
  async searchUsers(query: string, currentUserId: string, limit: number = 20): Promise<User[]> {
    const client = await this.pool.connect();
    
    try {
      const searchQuery = `%${query}%`;
      const result = await client.query(
        `SELECT id, username, email, public_key, created_at, last_seen, is_online
         FROM users 
         WHERE username ILIKE $1 
         AND id != $2
         ORDER BY 
           CASE WHEN username ILIKE $3 THEN 1 ELSE 2 END,
           username
         LIMIT $4`,
        [searchQuery, currentUserId, query, limit]
      );

      return result.rows.map(row => ({
        id: row.id,
        username: row.username,
        email: row.email,
        publicKey: row.public_key,
        createdAt: row.created_at,
        lastSeen: row.last_seen,
        isOnline: row.is_online,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Поиск сообщений по содержимому
   */
  async searchMessages(userId: string, query: string, limit: number = 50): Promise<Array<{
    id: string;
    fromUserId: string;
    toUserId: string;
    content: string;
    type: 'text' | 'media' | 'voice';
    timestamp: Date;
    fromUsername: string;
    toUsername: string;
  }>> {
    const client = await this.pool.connect();
    
    try {
      const searchQuery = `%${query}%`;
      const result = await client.query(
        `SELECT m.id, m.from_user_id, m.to_user_id, m.content, m.type, m.timestamp,
                u1.username as from_username, u2.username as to_username
         FROM messages m
         JOIN users u1 ON m.from_user_id = u1.id
         JOIN users u2 ON m.to_user_id = u2.id
         WHERE (m.from_user_id = $1 OR m.to_user_id = $1)
         AND m.content ILIKE $2
         AND m.type = 'text'
         ORDER BY m.timestamp DESC
         LIMIT $3`,
        [userId, searchQuery, limit]
      );

      return result.rows.map(row => ({
        id: row.id,
        fromUserId: row.from_user_id,
        toUserId: row.to_user_id,
        content: row.content,
        type: row.type,
        timestamp: row.timestamp,
        fromUsername: row.from_username,
        toUsername: row.to_username,
      }));
    } finally {
      client.release();
    }
  }
}

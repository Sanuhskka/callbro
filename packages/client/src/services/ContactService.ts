import { AuthService } from './AuthService';

/**
 * ContactService - Модуль управления контактами
 * 
 * Управляет:
 * - Добавлением и удалением контактов
 * - Получением списка контактов из IndexedDB
 * - Отслеживанием онлайн статуса контактов
 * - Счетчиком непрочитанных сообщений
 */

export interface Contact {
  id: string;
  userId: string;
  username: string;
  email?: string;
  isOnline: boolean;
  lastSeen?: number;
  unreadCount: number;
  addedAt: number;
}

export interface ContactRequest {
  userId: string;
  username: string;
  email?: string;
}

export interface ContactStatusUpdate {
  userId: string;
  isOnline: boolean;
  lastSeen?: number;
}

export class ContactService {
  private authService: AuthService;
  private dbName = 'SecureMessengerDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private statusChangeListeners: Map<string, (contact: Contact) => void> = new Map();
  private unreadCountListeners: Map<string, (count: number) => void> = new Map();

  constructor(authService: AuthService) {
    this.authService = authService;
    this.initDatabase();
  }

  /**
   * Инициализирует IndexedDB для хранения контактов
   */
  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB for contacts');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Contact IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Создаем хранилище для контактов
        if (!db.objectStoreNames.contains('contacts')) {
          const contactStore = db.createObjectStore('contacts', {
            keyPath: 'id',
          });
          contactStore.createIndex('userId', 'userId', { unique: true });
          contactStore.createIndex('username', 'username', { unique: false });
          contactStore.createIndex('isOnline', 'isOnline', { unique: false });
          contactStore.createIndex('addedAt', 'addedAt', { unique: false });
        }
      };
    });
  }

  /**
   * Добавляет контакт в список
   */
  async addContact(userId: string, _username: string, _email?: string): Promise<Contact> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Проверяем, что пользователь не добавляет самого себя
      if (userId === currentUser.id) {
        throw new Error('Cannot add yourself as a contact');
      }

      // Проверяем, что контакт еще не добавлен
      const existingContact = await this.getContactByUserId(userId);
      if (existingContact) {
        throw new Error('Contact already exists');
      }

      // Получаем информацию о пользователе с сервера
      const userInfo = await this.getUserInfo(userId);
      
      // Создаем объект контакта
      const contact: Contact = {
        id: this.generateContactId(),
        userId: userInfo.id,
        username: userInfo.username,
        email: userInfo.email,
        isOnline: false,
        lastSeen: undefined,
        unreadCount: 0,
        addedAt: Date.now(),
      };

      // Сохраняем контакт локально
      await this.saveContact(contact);

      // Отправляем запрос на сервер для добавления контакта
      await this.addContactOnServer(userId);

      console.log(`Contact added: ${contact.username}`);
      return contact;
    } catch (error) {
      console.error('Failed to add contact:', error);
      throw error;
    }
  }

  /**
   * Удаляет контакт из списка
   */
  async removeContact(contactId: string): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Получаем контакт для удаления
      const contact = await this.getContactById(contactId);
      if (!contact) {
        throw new Error('Contact not found');
      }

      // Удаляем из IndexedDB
      await this.deleteContact(contactId);

      // Отправляем запрос на сервер для удаления контакта
      await this.removeContactOnServer(contact.userId);

      // Удаляем слушателей статуса
      this.statusChangeListeners.delete(contactId);
      this.unreadCountListeners.delete(contactId);

      console.log(`Contact removed: ${contact.username}`);
    } catch (error) {
      console.error('Failed to remove contact:', error);
      throw error;
    }
  }

  /**
   * Получает список всех контактов
   */
  async getContacts(): Promise<Contact[]> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['contacts'], 'readonly');
        const store = transaction.objectStore('contacts');
        const request = store.getAll();

        request.onsuccess = () => {
          const contacts = request.result || [];
          // Сортируем по онлайн статусу и времени добавления
          const sortedContacts = contacts.sort((a: Contact, b: Contact) => {
            // Сначала онлайн контакты
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            // Затем по времени последнего видимости
            if (a.lastSeen && b.lastSeen) {
              return b.lastSeen - a.lastSeen;
            }
            // Наконец по времени добавления
            return b.addedAt - a.addedAt;
          });
          resolve(sortedContacts);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get contacts:', error);
      throw error;
    }
  }

  /**
   * Получает контакт по ID
   */
  async getContactById(contactId: string): Promise<Contact | null> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['contacts'], 'readonly');
        const store = transaction.objectStore('contacts');
        const request = store.get(contactId);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get contact by ID:', error);
      throw error;
    }
  }

  /**
   * Получает контакт по ID пользователя
   */
  async getContactByUserId(userId: string): Promise<Contact | null> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['contacts'], 'readonly');
        const store = transaction.objectStore('contacts');
        const index = store.index('userId');
        const request = index.get(userId);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get contact by user ID:', error);
      throw error;
    }
  }

  /**
   * Получает статус контакта
   */
  async getContactStatus(userId: string): Promise<{ isOnline: boolean; lastSeen?: number }> {
    try {
      const contact = await this.getContactByUserId(userId);
      if (!contact) {
        throw new Error('Contact not found');
      }

      return {
        isOnline: contact.isOnline,
        lastSeen: contact.lastSeen,
      };
    } catch (error) {
      console.error('Failed to get contact status:', error);
      throw error;
    }
  }

  /**
   * Обновляет статус контакта
   */
  async updateContactStatus(userId: string, isOnline: boolean, lastSeen?: number): Promise<void> {
    try {
      const contact = await this.getContactByUserId(userId);
      if (!contact) {
        return; // Контакт не найден, игнорируем
      }

      const oldStatus = contact.isOnline;
      contact.isOnline = isOnline;
      if (lastSeen) {
        contact.lastSeen = lastSeen;
      }

      // Сохраняем обновленный контакт
      await this.saveContact(contact);

      // Уведомляем слушателей об изменении статуса
      if (oldStatus !== isOnline) {
        const listener = this.statusChangeListeners.get(contact.id);
        if (listener) {
          listener(contact);
        }
      }

      console.log(`Contact status updated: ${contact.username} - ${isOnline ? 'online' : 'offline'}`);
    } catch (error) {
      console.error('Failed to update contact status:', error);
      throw error;
    }
  }

  /**
   * Увеличивает счетчик непрочитанных сообщений для контакта
   */
  async incrementUnreadCount(userId: string): Promise<void> {
    try {
      const contact = await this.getContactByUserId(userId);
      if (!contact) {
        return; // Контакт не найден, игнорируем
      }

      contact.unreadCount += 1;
      await this.saveContact(contact);

      // Уведомляем слушателей об изменении счетчика
      const listener = this.unreadCountListeners.get(contact.id);
      if (listener) {
        listener(contact.unreadCount);
      }

      console.log(`Unread count incremented for ${contact.username}: ${contact.unreadCount}`);
    } catch (error) {
      console.error('Failed to increment unread count:', error);
      throw error;
    }
  }

  /**
   * Сбрасывает счетчик непрочитанных сообщений для контакта
   */
  async resetUnreadCount(userId: string): Promise<void> {
    try {
      const contact = await this.getContactByUserId(userId);
      if (!contact) {
        return; // Контакт не найден, игнорируем
      }

      const oldCount = contact.unreadCount;
      contact.unreadCount = 0;
      await this.saveContact(contact);

      // Уведомляем слушателей об изменении счетчика
      if (oldCount > 0) {
        const listener = this.unreadCountListeners.get(contact.id);
        if (listener) {
          listener(0);
        }
      }

      console.log(`Unread count reset for ${contact.username}`);
    } catch (error) {
      console.error('Failed to reset unread count:', error);
      throw error;
    }
  }

  /**
   * Получает общее количество непрочитанных сообщений
   */
  async getTotalUnreadCount(): Promise<number> {
    try {
      const contacts = await this.getContacts();
      return contacts.reduce((total, contact) => total + contact.unreadCount, 0);
    } catch (error) {
      console.error('Failed to get total unread count:', error);
      throw error;
    }
  }

  /**
   * Подписывается на изменения статуса контакта
   */
  onStatusChange(contactId: string, callback: (contact: Contact) => void): void {
    this.statusChangeListeners.set(contactId, callback);
  }

  /**
   * Отписывается от изменений статуса контакта
   */
  offStatusChange(contactId: string): void {
    this.statusChangeListeners.delete(contactId);
  }

  /**
   * Подписывается на изменения счетчика непрочитанных сообщений
   */
  onUnreadCountChange(contactId: string, callback: (count: number) => void): void {
    this.unreadCountListeners.set(contactId, callback);
  }

  /**
   * Отписывается от изменений счетчика непрочитанных сообщений
   */
  offUnreadCountChange(contactId: string): void {
    this.unreadCountListeners.delete(contactId);
  }

  /**
   * Обрабатывает входящее обновление статуса от сервера
   */
  async handleStatusUpdate(update: ContactStatusUpdate): Promise<void> {
    await this.updateContactStatus(update.userId, update.isOnline, update.lastSeen);
  }

  /**
   * Получает информацию о пользователе с сервера
   */
  private async getUserInfo(userId: string): Promise<{ id: string; username: string; email?: string }> {
    try {
      const token = this.authService.getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch(`/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get user info');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get user info:', error);
      throw error;
    }
  }

  /**
   * Добавляет контакт на сервере
   */
  private async addContactOnServer(userId: string): Promise<void> {
    try {
      const token = this.authService.getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch('/api/contacts/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to add contact on server');
      }
    } catch (error) {
      console.error('Failed to add contact on server:', error);
      throw error;
    }
  }

  /**
   * Удаляет контакт на сервере
   */
  private async removeContactOnServer(userId: string): Promise<void> {
    try {
      const token = this.authService.getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch(`/api/contacts/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to remove contact on server');
      }
    } catch (error) {
      console.error('Failed to remove contact on server:', error);
      throw error;
    }
  }

  /**
   * Сохраняет контакт в IndexedDB
   */
  private async saveContact(contact: Contact): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['contacts'], 'readwrite');
      const store = transaction.objectStore('contacts');
      const request = store.put(contact);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Удаляет контакт из IndexedDB
   */
  private async deleteContact(contactId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['contacts'], 'readwrite');
      const store = transaction.objectStore('contacts');
      const request = store.delete(contactId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Генерирует уникальный ID контакта
   */
  private generateContactId(): string {
    return `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Импортирует контакты с сервера
   */
  async importContactsFromServer(): Promise<void> {
    try {
      const token = this.authService.getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch('/api/contacts', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to import contacts from server');
      }

      const serverContacts = await response.json();

      // Сохраняем контакты локально
      for (const serverContact of serverContacts) {
        const contact: Contact = {
          id: this.generateContactId(),
          userId: serverContact.userId,
          username: serverContact.username,
          email: serverContact.email,
          isOnline: serverContact.isOnline || false,
          lastSeen: serverContact.lastSeen,
          unreadCount: 0,
          addedAt: serverContact.addedAt || Date.now(),
        };

        await this.saveContact(contact);
      }

      console.log(`Imported ${serverContacts.length} contacts from server`);
    } catch (error) {
      console.error('Failed to import contacts from server:', error);
      throw error;
    }
  }
}

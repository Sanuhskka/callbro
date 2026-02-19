/// <reference lib="dom" />

/**
 * CryptoService - Модуль криптографии для end-to-end шифрования
 * 
 * Использует Web Crypto API для:
 * - Генерации ключевых пар ECDH P-256
 * - Обмена ключами (Diffie-Hellman)
 * - Шифрования/расшифрования сообщений и файлов с AES-GCM-256
 */

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface EncryptedData {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
  tag?: Uint8Array;
}

export class CryptoService {
  /**
   * Генерирует пару ключей ECDH P-256 для обмена ключами
   * @returns Пара ключей (публичный и приватный)
   */
  async generateKeyPair(): Promise<KeyPair> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true, // extractable для публичного ключа
      ['deriveKey', 'deriveBits']
    );

    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
    };
  }

  /**
   * Выводит общий секретный ключ из приватного и публичного ключей
   * Используется протокол Diffie-Hellman для обмена ключами
   * @param privateKey Приватный ключ текущего пользователя
   * @param publicKey Публичный ключ собеседника
   * @returns Общий секретный ключ AES-GCM для шифрования
   */
  async deriveSharedSecret(
    privateKey: CryptoKey,
    publicKey: CryptoKey
  ): Promise<CryptoKey> {
    const sharedSecret = await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: publicKey,
      },
      privateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false, // non-extractable для безопасности
      ['encrypt', 'decrypt']
    );

    return sharedSecret;
  }

  /**
   * Шифрует текстовое сообщение с использованием AES-GCM-256
   * @param message Текстовое сообщение для шифрования
   * @param sharedSecret Общий секретный ключ
   * @returns Зашифрованные данные с IV
   */
  async encryptMessage(
    message: string,
    sharedSecret: CryptoKey
  ): Promise<EncryptedData> {
    // Генерируем уникальный IV для каждого сообщения
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Конвертируем строку в ArrayBuffer
    const encoder = new TextEncoder();
    const data = encoder.encode(message);

    // Шифруем с AES-GCM
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      sharedSecret,
      data
    );

    return {
      ciphertext,
      iv,
    };
  }

  /**
   * Расшифровывает текстовое сообщение
   * @param encrypted Зашифрованные данные
   * @param sharedSecret Общий секретный ключ
   * @returns Расшифрованное текстовое сообщение
   */
  async decryptMessage(
    encrypted: EncryptedData,
    sharedSecret: CryptoKey
  ): Promise<string> {
    // Расшифровываем с AES-GCM
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: encrypted.iv as any,
      },
      sharedSecret,
      encrypted.ciphertext
    );

    // Конвертируем ArrayBuffer обратно в строку
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Шифрует медиа-файл (изображение, видео, аудио) с использованием AES-GCM-256
   * @param file Файл для шифрования
   * @param sharedSecret Общий секретный ключ
   * @returns Зашифрованные данные с IV
   */
  async encryptFile(
    file: Blob,
    sharedSecret: CryptoKey
  ): Promise<EncryptedData> {
    // Генерируем уникальный IV для каждого файла
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Читаем файл как ArrayBuffer
    const fileData = await file.arrayBuffer();

    // Шифруем с AES-GCM
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      sharedSecret,
      fileData
    );

    return {
      ciphertext,
      iv,
    };
  }

  /**
   * Расшифровывает медиа-файл
   * @param encrypted Зашифрованные данные
   * @param sharedSecret Общий секретный ключ
   * @returns Расшифрованный файл как Blob
   */
  async decryptFile(
    encrypted: EncryptedData,
    sharedSecret: CryptoKey
  ): Promise<Blob> {
    // Расшифровываем с AES-GCM
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: encrypted.iv as any,
      },
      sharedSecret,
      encrypted.ciphertext
    );

    // Возвращаем как Blob
    return new Blob([decrypted]);
  }

  /**
   * Импортирует публичный ключ из JWK формата
   * @param jwk Публичный ключ в JWK формате
   * @returns Публичный ключ CryptoKey
   */
  async importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      ['deriveKey']
    );
  }
}

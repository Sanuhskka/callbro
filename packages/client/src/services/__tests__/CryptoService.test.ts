import { CryptoService } from '../CryptoService';
import * as fc from 'fast-check';

describe('CryptoService', () => {
  let cryptoService: CryptoService;

  beforeEach(() => {
    cryptoService = new CryptoService();
  });

  describe('generateKeyPair', () => {
    it('should generate a valid ECDH P-256 key pair', async () => {
      const keyPair = await cryptoService.generateKeyPair();

      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKey.type).toBe('public');
      expect(keyPair.privateKey.type).toBe('private');
      expect(keyPair.publicKey.algorithm.name).toBe('ECDH');
      expect(keyPair.privateKey.algorithm.name).toBe('ECDH');
    });

    it('should generate different key pairs on each call', async () => {
      const keyPair1 = await cryptoService.generateKeyPair();
      const keyPair2 = await cryptoService.generateKeyPair();

      // Export keys to compare
      const publicKey1 = await crypto.subtle.exportKey('raw', keyPair1.publicKey);
      const publicKey2 = await crypto.subtle.exportKey('raw', keyPair2.publicKey);

      // Convert to arrays for comparison
      const array1 = Array.from(new Uint8Array(publicKey1));
      const array2 = Array.from(new Uint8Array(publicKey2));
      
      expect(array1).not.toEqual(array2);
    });
  });

  describe('deriveSharedSecret', () => {
    it('should derive the same shared secret from both sides', async () => {
      // Alice generates her key pair
      const aliceKeyPair = await cryptoService.generateKeyPair();
      
      // Bob generates his key pair
      const bobKeyPair = await cryptoService.generateKeyPair();

      // Alice derives shared secret using her private key and Bob's public key
      const aliceSharedSecret = await cryptoService.deriveSharedSecret(
        aliceKeyPair.privateKey,
        bobKeyPair.publicKey
      );

      // Bob derives shared secret using his private key and Alice's public key
      const bobSharedSecret = await cryptoService.deriveSharedSecret(
        bobKeyPair.privateKey,
        aliceKeyPair.publicKey
      );

      // Both should be able to encrypt/decrypt with their shared secrets
      const message = 'Test message';
      const encrypted = await cryptoService.encryptMessage(message, aliceSharedSecret);
      const decrypted = await cryptoService.decryptMessage(encrypted, bobSharedSecret);

      expect(decrypted).toBe(message);
    });

    it('should create AES-GCM key with 256-bit length', async () => {
      const keyPair1 = await cryptoService.generateKeyPair();
      const keyPair2 = await cryptoService.generateKeyPair();

      const sharedSecret = await cryptoService.deriveSharedSecret(
        keyPair1.privateKey,
        keyPair2.publicKey
      );

      expect(sharedSecret.algorithm.name).toBe('AES-GCM');
      expect((sharedSecret.algorithm as any).length).toBe(256);
    });
  });

  describe('encryptMessage and decryptMessage', () => {
    it('should encrypt and decrypt a text message correctly', async () => {
      const keyPair = await cryptoService.generateKeyPair();
      const sharedSecret = await cryptoService.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      const originalMessage = 'Hello, secure world!';
      const encrypted = await cryptoService.encryptMessage(originalMessage, sharedSecret);
      const decrypted = await cryptoService.decryptMessage(encrypted, sharedSecret);

      expect(decrypted).toBe(originalMessage);
    });

    /**
     * Property 1: Round-trip шифрования текстовых сообщений
     * **Validates: Requirements 2.1, 2.2, 7.2**
     * 
     * Для любого текстового сообщения, шифрование и последующее расшифрование
     * должно вернуть исходное сообщение без изменений.
     */
    it('property: any text message encrypted then decrypted returns original', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (message) => {
          // Генерируем ключевую пару для Alice
          const aliceKeyPair = await cryptoService.generateKeyPair();
          // Генерируем ключевую пару для Bob
          const bobKeyPair = await cryptoService.generateKeyPair();
          
          // Alice выводит общий секрет с Bob
          const aliceSharedSecret = await cryptoService.deriveSharedSecret(
            aliceKeyPair.privateKey,
            bobKeyPair.publicKey
          );
          
          // Bob выводит общий секрет с Alice
          const bobSharedSecret = await cryptoService.deriveSharedSecret(
            bobKeyPair.privateKey,
            aliceKeyPair.publicKey
          );
          
          // Alice шифрует сообщение
          const encrypted = await cryptoService.encryptMessage(message, aliceSharedSecret);
          
          // Bob расшифровывает сообщение
          const decrypted = await cryptoService.decryptMessage(encrypted, bobSharedSecret);
          
          // Расшифрованное сообщение должно совпадать с оригиналом
          expect(decrypted).toBe(message);
        }),
        { numRuns: 100 }
      );
    }, 30000); // Увеличиваем таймаут для 100 итераций

    it('should handle empty string', async () => {
      const keyPair = await cryptoService.generateKeyPair();
      const sharedSecret = await cryptoService.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      const originalMessage = '';
      const encrypted = await cryptoService.encryptMessage(originalMessage, sharedSecret);
      const decrypted = await cryptoService.decryptMessage(encrypted, sharedSecret);

      expect(decrypted).toBe(originalMessage);
    });

    it('should handle unicode characters', async () => {
      const keyPair = await cryptoService.generateKeyPair();
      const sharedSecret = await cryptoService.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      const originalMessage = '🔒 Привет мир! 你好世界 مرحبا بالعالم';
      const encrypted = await cryptoService.encryptMessage(originalMessage, sharedSecret);
      const decrypted = await cryptoService.decryptMessage(encrypted, sharedSecret);

      expect(decrypted).toBe(originalMessage);
    });

    it('should generate unique IV for each encryption', async () => {
      const keyPair = await cryptoService.generateKeyPair();
      const sharedSecret = await cryptoService.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      const message = 'Same message';
      const encrypted1 = await cryptoService.encryptMessage(message, sharedSecret);
      const encrypted2 = await cryptoService.encryptMessage(message, sharedSecret);

      // IVs should be different
      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
      
      // Ciphertexts should be different due to different IVs
      const cipher1 = Array.from(new Uint8Array(encrypted1.ciphertext));
      const cipher2 = Array.from(new Uint8Array(encrypted2.ciphertext));
      expect(cipher1).not.toEqual(cipher2);

      // Both should decrypt to the same message
      const decrypted1 = await cryptoService.decryptMessage(encrypted1, sharedSecret);
      const decrypted2 = await cryptoService.decryptMessage(encrypted2, sharedSecret);
      expect(decrypted1).toBe(message);
      expect(decrypted2).toBe(message);
    });

    it('should fail to decrypt with wrong key', async () => {
      const keyPair1 = await cryptoService.generateKeyPair();
      const keyPair2 = await cryptoService.generateKeyPair();
      
      const sharedSecret1 = await cryptoService.deriveSharedSecret(
        keyPair1.privateKey,
        keyPair1.publicKey
      );
      const sharedSecret2 = await cryptoService.deriveSharedSecret(
        keyPair2.privateKey,
        keyPair2.publicKey
      );

      const message = 'Secret message';
      const encrypted = await cryptoService.encryptMessage(message, sharedSecret1);

      // Attempting to decrypt with wrong key should throw
      await expect(
        cryptoService.decryptMessage(encrypted, sharedSecret2)
      ).rejects.toThrow();
    });
  });

  describe('encryptFile and decryptFile', () => {
    it('should encrypt and decrypt a file correctly', async () => {
      const keyPair = await cryptoService.generateKeyPair();
      const sharedSecret = await cryptoService.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      // Create a test file
      const originalData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const originalFile = new Blob([originalData], { type: 'application/octet-stream' });

      const encrypted = await cryptoService.encryptFile(originalFile, sharedSecret);
      const decryptedFile = await cryptoService.decryptFile(encrypted, sharedSecret);

      // Compare the decrypted data with original
      const decryptedData = new Uint8Array(await decryptedFile.arrayBuffer());
      expect(decryptedData).toEqual(originalData);
    });

    /**
     * Property 2: Round-trip шифрования медиа-файлов
     * **Validates: Requirements 3.1, 3.2, 7.3**
     * 
     * Для любого медиа-файла (изображение или видео), шифрование и последующее
     * расшифрование должно вернуть файл с идентичным содержимым.
     */
    it('property: any media file encrypted then decrypted returns identical content', async () => {
      // Генератор для различных типов медиа-файлов
      const mediaTypeArbitrary = fc.constantFrom(
        'image/jpeg',
        'image/png',
        'image/gif',
        'video/mp4',
        'video/webm'
      );

      // Генератор для размеров файлов (от 0 до 10MB для тестов)
      const fileSizeArbitrary = fc.integer({ min: 0, max: 10 * 1024 * 1024 });

      await fc.assert(
        fc.asyncProperty(
          mediaTypeArbitrary,
          fileSizeArbitrary,
          fc.uint8Array({ minLength: 0, maxLength: 1024 * 1024 }), // Ограничиваем до 1MB для скорости тестов
          async (mediaType, _fileSize, fileContent) => {
            // Генерируем ключевую пару для Alice
            const aliceKeyPair = await cryptoService.generateKeyPair();
            // Генерируем ключевую пару для Bob
            const bobKeyPair = await cryptoService.generateKeyPair();
            
            // Alice выводит общий секрет с Bob
            const aliceSharedSecret = await cryptoService.deriveSharedSecret(
              aliceKeyPair.privateKey,
              bobKeyPair.publicKey
            );
            
            // Bob выводит общий секрет с Alice
            const bobSharedSecret = await cryptoService.deriveSharedSecret(
              bobKeyPair.privateKey,
              aliceKeyPair.publicKey
            );
            
            // Создаем медиа-файл с указанным типом
            const originalFile = new Blob([new Uint8Array(fileContent)], { type: mediaType });
            
            // Alice шифрует файл
            const encrypted = await cryptoService.encryptFile(originalFile, aliceSharedSecret);
            
            // Bob расшифровывает файл
            const decryptedFile = await cryptoService.decryptFile(encrypted, bobSharedSecret);
            
            // Проверяем, что содержимое идентично
            const originalData = new Uint8Array(await originalFile.arrayBuffer());
            const decryptedData = new Uint8Array(await decryptedFile.arrayBuffer());
            
            expect(decryptedData).toEqual(originalData);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000); // Увеличиваем таймаут для 100 итераций с файлами

    it('should handle empty file', async () => {
      const keyPair = await cryptoService.generateKeyPair();
      const sharedSecret = await cryptoService.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      const emptyFile = new Blob([], { type: 'application/octet-stream' });
      const encrypted = await cryptoService.encryptFile(emptyFile, sharedSecret);
      const decryptedFile = await cryptoService.decryptFile(encrypted, sharedSecret);

      expect(decryptedFile.size).toBe(0);
    });

    it('should handle large file', async () => {
      const keyPair = await cryptoService.generateKeyPair();
      const sharedSecret = await cryptoService.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      // Create a 1MB test file
      const largeData = new Uint8Array(1024 * 1024);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }
      const largeFile = new Blob([largeData], { type: 'application/octet-stream' });

      const encrypted = await cryptoService.encryptFile(largeFile, sharedSecret);
      const decryptedFile = await cryptoService.decryptFile(encrypted, sharedSecret);

      const decryptedData = new Uint8Array(await decryptedFile.arrayBuffer());
      expect(decryptedData).toEqual(largeData);
    });

    it('should generate unique IV for each file encryption', async () => {
      const keyPair = await cryptoService.generateKeyPair();
      const sharedSecret = await cryptoService.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      const fileData = new Uint8Array([1, 2, 3, 4, 5]);
      const file = new Blob([fileData], { type: 'application/octet-stream' });

      const encrypted1 = await cryptoService.encryptFile(file, sharedSecret);
      const encrypted2 = await cryptoService.encryptFile(file, sharedSecret);

      // IVs should be different
      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
      
      // Ciphertexts should be different due to different IVs
      const cipher1 = Array.from(new Uint8Array(encrypted1.ciphertext));
      const cipher2 = Array.from(new Uint8Array(encrypted2.ciphertext));
      expect(cipher1).not.toEqual(cipher2);
    });

    it('should fail to decrypt file with wrong key', async () => {
      const keyPair1 = await cryptoService.generateKeyPair();
      const keyPair2 = await cryptoService.generateKeyPair();
      
      const sharedSecret1 = await cryptoService.deriveSharedSecret(
        keyPair1.privateKey,
        keyPair1.publicKey
      );
      const sharedSecret2 = await cryptoService.deriveSharedSecret(
        keyPair2.privateKey,
        keyPair2.publicKey
      );

      const fileData = new Uint8Array([1, 2, 3, 4, 5]);
      const file = new Blob([fileData], { type: 'application/octet-stream' });
      
      const encrypted = await cryptoService.encryptFile(file, sharedSecret1);

      // Attempting to decrypt with wrong key should throw
      await expect(
        cryptoService.decryptFile(encrypted, sharedSecret2)
      ).rejects.toThrow();
    });

    /**
     * Property 3: Round-trip шифрования голосовых сообщений
     * **Validates: Requirements 4.2, 4.3**
     * 
     * Для любого голосового сообщения, шифрование и последующее расшифрование
     * должно вернуть аудио-файл с идентичным содержимым.
     */
    it('property: any voice message encrypted then decrypted returns identical content', async () => {
      // Генератор для различных типов аудио-файлов (голосовые сообщения)
      const audioTypeArbitrary = fc.constantFrom(
        'audio/webm',
        'audio/ogg',
        'audio/mp3',
        'audio/mpeg',
        'audio/wav',
        'audio/mp4'
      );

      await fc.assert(
        fc.asyncProperty(
          audioTypeArbitrary,
          fc.uint8Array({ minLength: 0, maxLength: 1024 * 1024 }), // Ограничиваем до 1MB для скорости тестов
          async (audioType, audioContent) => {
            // Генерируем ключевую пару для Alice
            const aliceKeyPair = await cryptoService.generateKeyPair();
            // Генерируем ключевую пару для Bob
            const bobKeyPair = await cryptoService.generateKeyPair();
            
            // Alice выводит общий секрет с Bob
            const aliceSharedSecret = await cryptoService.deriveSharedSecret(
              aliceKeyPair.privateKey,
              bobKeyPair.publicKey
            );
            
            // Bob выводит общий секрет с Alice
            const bobSharedSecret = await cryptoService.deriveSharedSecret(
              bobKeyPair.privateKey,
              aliceKeyPair.publicKey
            );
            
            // Создаем голосовое сообщение (аудио-файл) с указанным типом
            const originalVoiceMessage = new Blob([new Uint8Array(audioContent)], { type: audioType });
            
            // Alice шифрует голосовое сообщение
            const encrypted = await cryptoService.encryptFile(originalVoiceMessage, aliceSharedSecret);
            
            // Bob расшифровывает голосовое сообщение
            const decryptedVoiceMessage = await cryptoService.decryptFile(encrypted, bobSharedSecret);
            
            // Проверяем, что содержимое идентично
            const originalData = new Uint8Array(await originalVoiceMessage.arrayBuffer());
            const decryptedData = new Uint8Array(await decryptedVoiceMessage.arrayBuffer());
            
            expect(decryptedData).toEqual(originalData);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000); // Увеличиваем таймаут для 100 итераций с аудио-файлами
  });
});

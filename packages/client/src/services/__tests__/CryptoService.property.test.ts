import { CryptoService } from '../CryptoService';
import * as fc from 'fast-check';

/**
 * Property-Based Tests для CryptoService
 * Используется fast-check для генерации множества тестовых случаев
 */

describe('CryptoService - Property-Based Tests', () => {
  let cryptoService: CryptoService;

  beforeEach(() => {
    cryptoService = new CryptoService();
  });

  /**
   * Property 1: Round-trip шифрования текстовых сообщений
   * Validates: Requirements 2.1, 2.2, 7.2
   * 
   * Для любого текстового сообщения, шифрование и последующее расшифрование
   * должно вернуть исходное сообщение без изменений.
   */
  describe('Property 1: Round-trip шифрования текстовых сообщений', () => {
    it('should return original message after encrypt then decrypt for any text', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (message) => {
          // Генерируем ключевую пару
          const keyPair = await cryptoService.generateKeyPair();
          
          // Выводим общий секретный ключ (в реальности это будет с другим пользователем)
          const sharedSecret = await cryptoService.deriveSharedSecret(
            keyPair.privateKey,
            keyPair.publicKey
          );

          // Шифруем сообщение
          const encrypted = await cryptoService.encryptMessage(message, sharedSecret);
          
          // Расшифровываем сообщение
          const decrypted = await cryptoService.decryptMessage(encrypted, sharedSecret);

          // Проверяем, что расшифрованное сообщение совпадает с оригиналом
          expect(decrypted).toBe(message);
        }),
        { numRuns: 100 }
      );
    });

    it('should work with unicode and special characters', async () => {
      await fc.assert(
        fc.asyncProperty(fc.fullUnicodeString(), async (message) => {
          const keyPair = await cryptoService.generateKeyPair();
          const sharedSecret = await cryptoService.deriveSharedSecret(
            keyPair.privateKey,
            keyPair.publicKey
          );

          const encrypted = await cryptoService.encryptMessage(message, sharedSecret);
          const decrypted = await cryptoService.decryptMessage(encrypted, sharedSecret);

          expect(decrypted).toBe(message);
        }),
        { numRuns: 100 }
      );
    });

    it('should work between two different users (simulated)', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string(), async (message) => {
          // Alice генерирует свою ключевую пару
          const aliceKeyPair = await cryptoService.generateKeyPair();
          
          // Bob генерирует свою ключевую пару
          const bobKeyPair = await cryptoService.generateKeyPair();

          // Alice выводит общий секрет используя свой приватный ключ и публичный ключ Bob
          const aliceSharedSecret = await cryptoService.deriveSharedSecret(
            aliceKeyPair.privateKey,
            bobKeyPair.publicKey
          );

          // Bob выводит общий секрет используя свой приватный ключ и публичный ключ Alice
          const bobSharedSecret = await cryptoService.deriveSharedSecret(
            bobKeyPair.privateKey,
            aliceKeyPair.publicKey
          );

          // Alice шифрует сообщение
          const encrypted = await cryptoService.encryptMessage(message, aliceSharedSecret);
          
          // Bob расшифровывает сообщение
          const decrypted = await cryptoService.decryptMessage(encrypted, bobSharedSecret);

          // Проверяем, что Bob получил оригинальное сообщение
          expect(decrypted).toBe(message);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Round-trip шифрования медиа-файлов
   * Validates: Requirements 3.1, 3.2, 7.3
   * 
   * Для любого медиа-файла, шифрование и последующее расшифрование
   * должно вернуть исходный файл без изменений.
   */
  describe('Property 2: Round-trip шифрования медиа-файлов', () => {
    it('should return original file after encrypt then decrypt for any media file', async () => {
      await fc.assert(
        fc.asyncProperty(fc.uint8Array(), async (fileData) => {
          // Генерируем ключевую пару
          const keyPair = await cryptoService.generateKeyPair();
          
          // Выводим общий секретный ключ
          const sharedSecret = await cryptoService.deriveSharedSecret(
            keyPair.privateKey,
            keyPair.publicKey
          );

          // Создаем Blob из массива байтов (симуляция файла)
          const originalFile = new Blob([fileData.buffer as ArrayBuffer]);
          
          // Шифруем файл
          const encrypted = await cryptoService.encryptFile(originalFile, sharedSecret);
          
          // Расшифровываем файл
          const decryptedFile = await cryptoService.decryptFile(encrypted, sharedSecret);
          
          // Сравниваем содержимое файлов
          const originalArrayBuffer = await originalFile.arrayBuffer();
          const decryptedArrayBuffer = await decryptedFile.arrayBuffer();
          
          expect(originalArrayBuffer.byteLength).toBe(decryptedArrayBuffer.byteLength);
          
          const originalBytes = new Uint8Array(originalArrayBuffer);
          const decryptedBytes = new Uint8Array(decryptedArrayBuffer);
          
          expect(decryptedBytes).toEqual(originalBytes);
        }),
        { numRuns: 100 }
      );
    });

    it('should work with different file sizes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ min: 0, max: 255 }), // uint8Array max значение 255
          fc.integer({ min: 1, max: 4096 }), // множитель для размера файла
          async (fileData, multiplier) => {
            const keyPair = await cryptoService.generateKeyPair();
            const sharedSecret = await cryptoService.deriveSharedSecret(
              keyPair.privateKey,
              keyPair.publicKey
            );

            // Создаем файл нужного размера, повторяя массив байтов
            const repeatedData = new Uint8Array(fileData.length * multiplier);
            for (let i = 0; i < multiplier; i++) {
              repeatedData.set(fileData, i * fileData.length);
            }

            const originalFile = new Blob([repeatedData]);
            const encrypted = await cryptoService.encryptFile(originalFile, sharedSecret);
            const decryptedFile = await cryptoService.decryptFile(encrypted, sharedSecret);
            
            const originalArrayBuffer = await originalFile.arrayBuffer();
            const decryptedArrayBuffer = await decryptedFile.arrayBuffer();
            
            expect(originalArrayBuffer.byteLength).toBe(decryptedArrayBuffer.byteLength);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Round-trip шифрования голосовых сообщений
   * Validates: Requirements 4.2, 4.3
   * 
   * Для любого голосового сообщения (аудио данных), шифрование и последующее 
   * расшифрование должно вернуть исходные аудио данные без изменений.
   */
  describe('Property 3: Round-trip шифрования голосовых сообщений', () => {
    it('should return original voice message after encrypt then decrypt', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ min: 100, max: 255 }), // исправлено: max не может быть больше 255
          fc.integer({ min: 1, max: 1024 }), // множитель для размера аудио
          async (audioData, multiplier) => {
            // Генерируем ключевую пару
            const keyPair = await cryptoService.generateKeyPair();
            
            // Выводим общий секретный ключ
            const sharedSecret = await cryptoService.deriveSharedSecret(
              keyPair.privateKey,
              keyPair.publicKey
            );

            // Создаем аудио данные нужного размера
            const repeatedAudioData = new Uint8Array(audioData.length * multiplier);
            for (let i = 0; i < multiplier; i++) {
              repeatedAudioData.set(audioData, i * audioData.length);
            }

            // Создаем Blob аудио данных (симуляция голосового сообщения)
            const originalVoiceMessage = new Blob([repeatedAudioData], { type: 'audio/webm' });
            
            // Шифруем голосовое сообщение
            const encrypted = await cryptoService.encryptFile(originalVoiceMessage, sharedSecret);
            
            // Расшифровываем голосовое сообщение
            const decryptedVoiceMessage = await cryptoService.decryptFile(encrypted, sharedSecret);
            
            // Сравниваем содержимое аудио данных
            const originalArrayBuffer = await originalVoiceMessage.arrayBuffer();
            const decryptedArrayBuffer = await decryptedVoiceMessage.arrayBuffer();
            
            expect(originalArrayBuffer.byteLength).toBe(decryptedArrayBuffer.byteLength);
            
            const originalBytes = new Uint8Array(originalArrayBuffer);
            const decryptedBytes = new Uint8Array(decryptedArrayBuffer);
            
            expect(decryptedBytes).toEqual(originalBytes);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should work with typical voice message durations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            1024,        // ~30 seconds simulation
            2048,        // ~1 minute simulation  
            4096,        // ~2 minutes simulation
            8192         // ~5 minutes simulation (reduced size)
          ),
          async (voiceSize) => {
            const keyPair = await cryptoService.generateKeyPair();
            const sharedSecret = await cryptoService.deriveSharedSecret(
              keyPair.privateKey,
              keyPair.publicKey
            );

            // Генерируем аудио данные указанного размера
            const audioData = new Uint8Array(voiceSize);
            crypto.getRandomValues(audioData);
            
            const originalVoiceMessage = new Blob([audioData], { type: 'audio/webm' });
            const encrypted = await cryptoService.encryptFile(originalVoiceMessage, sharedSecret);
            const decryptedVoiceMessage = await cryptoService.decryptFile(encrypted, sharedSecret);
            
            const originalArrayBuffer = await originalVoiceMessage.arrayBuffer();
            const decryptedArrayBuffer = await decryptedVoiceMessage.arrayBuffer();
            
            expect(originalArrayBuffer.byteLength).toBe(decryptedArrayBuffer.byteLength);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 23: Обмен ключами при установке соединения
   * Validates: Requirements 7.1
   * 
   * При обмене ключами между двумя пользователями, оба должны получить
   * одинаковый общий секретный ключ.
   */
  describe('Property 23: Обмен ключей при установке соединения', () => {
    it('should generate identical shared secrets for both users', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom(0, 1, 2, 3, 4), async (seed) => {
          // Используем seed для детерминированной генерации ключей
          const cryptoService1 = new CryptoService();
          const cryptoService2 = new CryptoService();
          
          // User 1 генерирует свою ключевую пару
          const user1KeyPair = await cryptoService1.generateKeyPair();
          
          // User 2 генерирует свою ключевую пару
          const user2KeyPair = await cryptoService2.generateKeyPair();

          // User 1 выводит общий секрет используя свой приватный ключ и публичный ключ User 2
          const user1SharedSecret = await cryptoService1.deriveSharedSecret(
            user1KeyPair.privateKey,
            user2KeyPair.publicKey
          );

          // User 2 выводит общий секрет используя свой приватный ключ и публичный ключ User 1
          const user2SharedSecret = await cryptoService2.deriveSharedSecret(
            user2KeyPair.privateKey,
            user1KeyPair.publicKey
          );

          // Проверяем, что оба пользователя получили одинаковый общий секрет
          // Для этого шифруем тестовое сообщение обоими ключами и сравниваем результаты
          const testMessage = `test-message-${seed}`;
          
          // Test encryption between two users
          const sharedSecret1to2 = await cryptoService1.deriveSharedSecret(
            user1KeyPair.privateKey,
            user2KeyPair.publicKey
          );
          
          const sharedSecret2to1 = await cryptoService2.deriveSharedSecret(
            user2KeyPair.privateKey,
            user1KeyPair.publicKey
          );
          
          const encryptedByUser1 = await cryptoService1.encryptMessage(
            testMessage,
            sharedSecret1to2
          );
          // Расшифровываем сообщение, зашифрованное User 1, используя ключ User 2
          const decryptedByUser2 = await cryptoService2.decryptMessage(encryptedByUser1, sharedSecret2to1);
          
          expect(decryptedByUser2).toBe(testMessage);
        }),
        { numRuns: 100 }
      );
    });

    it('should work with multiple key pairs', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(fc.constantFrom(0, 1)), async (seeds) => {
          if (seeds.length < 2) return;
          
          const cryptoServices = seeds.map(() => new CryptoService());
          const keyPairs = await Promise.all(
            cryptoServices.map(service => service.generateKeyPair())
          );

          // Тестируем обмен ключами между всеми парами
          for (let i = 0; i < keyPairs.length - 1; i++) {
            for (let j = i + 1; j < keyPairs.length; j++) {
              const sharedSecret1 = await cryptoServices[i].deriveSharedSecret(
                keyPairs[i].privateKey,
                keyPairs[j].publicKey
              );
              
              const sharedSecret2 = await cryptoServices[j].deriveSharedSecret(
                keyPairs[j].privateKey,
                keyPairs[i].publicKey
              );

              // Проверяем, что общие секреты идентичны
              const testMessage = `test-${i}-${j}`;
              const encrypted1 = await cryptoServices[i].encryptMessage(testMessage, sharedSecret1);
              const decrypted2 = await cryptoServices[j].decryptMessage(encrypted1, sharedSecret2);
              
              expect(decrypted2).toBe(testMessage);
            }
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});

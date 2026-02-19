# CryptoService

Модуль криптографии для end-to-end шифрования в защищенном P2P мессенджере.

## Обзор

CryptoService реализует все криптографические операции, необходимые для безопасного обмена сообщениями и файлами между пользователями. Модуль использует Web Crypto API, который доступен во всех современных браузерах.

## Технические характеристики

### Алгоритмы

- **Обмен ключами**: ECDH (Elliptic Curve Diffie-Hellman) с кривой P-256
- **Шифрование**: AES-GCM-256 (Advanced Encryption Standard в режиме Galois/Counter Mode)
- **Длина ключа**: 256 бит
- **Длина IV**: 12 байт (96 бит) - генерируется уникально для каждого шифрования

### Безопасность

- Приватные ключи создаются с флагом `non-extractable` для предотвращения экспорта
- Уникальный IV (Initialization Vector) генерируется для каждой операции шифрования
- AES-GCM обеспечивает как конфиденциальность, так и аутентичность данных
- Протокол Diffie-Hellman обеспечивает безопасный обмен ключами

## API

### generateKeyPair()

Генерирует пару ключей ECDH P-256 для обмена ключами.

```typescript
const keyPair = await cryptoService.generateKeyPair();
// keyPair.publicKey - публичный ключ (можно передавать собеседнику)
// keyPair.privateKey - приватный ключ (хранится только локально)
```

**Возвращает**: `Promise<KeyPair>`

**Использование**: Вызывается при регистрации пользователя или создании новой сессии.

### deriveSharedSecret(privateKey, publicKey)

Выводит общий секретный ключ из приватного ключа текущего пользователя и публичного ключа собеседника.

```typescript
const sharedSecret = await cryptoService.deriveSharedSecret(
  myPrivateKey,
  theirPublicKey
);
```

**Параметры**:
- `privateKey: CryptoKey` - приватный ключ текущего пользователя
- `publicKey: CryptoKey` - публичный ключ собеседника

**Возвращает**: `Promise<CryptoKey>` - общий секретный ключ AES-GCM

**Использование**: Вызывается при установке соединения с новым собеседником.

### encryptMessage(message, sharedSecret)

Шифрует текстовое сообщение с использованием AES-GCM-256.

```typescript
const encrypted = await cryptoService.encryptMessage(
  'Hello, world!',
  sharedSecret
);
// encrypted.ciphertext - зашифрованные данные
// encrypted.iv - вектор инициализации (нужен для расшифровки)
```

**Параметры**:
- `message: string` - текстовое сообщение для шифрования
- `sharedSecret: CryptoKey` - общий секретный ключ

**Возвращает**: `Promise<EncryptedData>`

**Использование**: Вызывается перед отправкой каждого текстового сообщения.

### decryptMessage(encrypted, sharedSecret)

Расшифровывает текстовое сообщение.

```typescript
const message = await cryptoService.decryptMessage(
  encrypted,
  sharedSecret
);
```

**Параметры**:
- `encrypted: EncryptedData` - зашифрованные данные с IV
- `sharedSecret: CryptoKey` - общий секретный ключ

**Возвращает**: `Promise<string>` - расшифрованное текстовое сообщение

**Использование**: Вызывается при получении зашифрованного сообщения.

### encryptFile(file, sharedSecret)

Шифрует медиа-файл (изображение, видео, аудио) с использованием AES-GCM-256.

```typescript
const encrypted = await cryptoService.encryptFile(
  fileBlob,
  sharedSecret
);
```

**Параметры**:
- `file: Blob` - файл для шифрования
- `sharedSecret: CryptoKey` - общий секретный ключ

**Возвращает**: `Promise<EncryptedData>`

**Использование**: Вызывается перед отправкой медиа-файлов.

### decryptFile(encrypted, sharedSecret)

Расшифровывает медиа-файл.

```typescript
const file = await cryptoService.decryptFile(
  encrypted,
  sharedSecret
);
```

**Параметры**:
- `encrypted: EncryptedData` - зашифрованные данные с IV
- `sharedSecret: CryptoKey` - общий секретный ключ

**Возвращает**: `Promise<Blob>` - расшифрованный файл

**Использование**: Вызывается при получении зашифрованного медиа-файла.

## Типы данных

### KeyPair

```typescript
interface KeyPair {
  publicKey: CryptoKey;   // Публичный ключ ECDH
  privateKey: CryptoKey;  // Приватный ключ ECDH
}
```

### EncryptedData

```typescript
interface EncryptedData {
  ciphertext: ArrayBuffer;  // Зашифрованные данные
  iv: Uint8Array;           // Вектор инициализации (12 байт)
  tag?: Uint8Array;         // Тег аутентификации (опционально)
}
```

## Пример использования

### Полный flow обмена сообщениями

```typescript
import { CryptoService } from './services';

const crypto = new CryptoService();

// 1. Алиса генерирует свою пару ключей
const aliceKeyPair = await crypto.generateKeyPair();

// 2. Боб генерирует свою пару ключей
const bobKeyPair = await crypto.generateKeyPair();

// 3. Алиса и Боб обмениваются публичными ключами через сигнальный сервер

// 4. Алиса выводит общий секрет
const aliceSharedSecret = await crypto.deriveSharedSecret(
  aliceKeyPair.privateKey,
  bobKeyPair.publicKey
);

// 5. Боб выводит общий секрет (будет идентичен секрету Алисы)
const bobSharedSecret = await crypto.deriveSharedSecret(
  bobKeyPair.privateKey,
  aliceKeyPair.publicKey
);

// 6. Алиса шифрует и отправляет сообщение
const message = 'Привет, Боб!';
const encrypted = await crypto.encryptMessage(message, aliceSharedSecret);
// Отправить encrypted через WebRTC или WebSocket

// 7. Боб получает и расшифровывает сообщение
const decrypted = await crypto.decryptMessage(encrypted, bobSharedSecret);
console.log(decrypted); // "Привет, Боб!"
```

## Требования

Этот модуль реализует следующие требования из спецификации:

- **Требование 7.1**: Обмен ключами с использованием протокола Diffie-Hellman
- **Требование 7.2**: Шифрование всех текстовых сообщений перед отправкой
- **Требование 7.3**: Шифрование всех медиа-файлов перед отправкой
- **Требование 1.4**: Генерация пары криптографических ключей при аутентификации
- **Требование 1.5**: Хранение приватных ключей только на стороне клиента

## Свойства корректности

Модуль валидирует следующие свойства:

- **Свойство 1**: Round-trip шифрования текстовых сообщений
- **Свойство 2**: Round-trip шифрования медиа-файлов
- **Свойство 23**: Обмен ключами при установке соединения

## Совместимость

- Все современные браузеры с поддержкой Web Crypto API
- Chrome 37+
- Firefox 34+
- Safari 11+
- Edge 79+

## Безопасность

### Что защищено

✅ Приватные ключи не могут быть экспортированы из браузера
✅ Каждое сообщение шифруется с уникальным IV
✅ AES-GCM обеспечивает аутентификацию данных
✅ Сигнальный сервер не имеет доступа к ключам или расшифрованному контенту

### Что НЕ защищено

⚠️ Метаданные (кто с кем общается, когда, размер сообщений)
⚠️ Защита от компрометации устройства пользователя
⚠️ Защита от атак на уровне браузера

## Тестирование

Модуль покрыт unit-тестами и property-based тестами:

```bash
npm test -- CryptoService.test.ts
```

Для ручного тестирования в браузере:

```typescript
import { runCryptoTests } from './services/__tests__/crypto-manual-test';
await runCryptoTests();
```

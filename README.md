# Secure P2P Messenger

Защищенный P2P веб-мессенджер с end-to-end шифрованием, поддержкой голосовых и видео звонков.

## 🚀 Быстрый Старт

### Локально (5 минут)

**С Docker:**
```bash
cp .env.example .env
docker-compose up -d
```
Откройте http://localhost

**С Ngrok (Публичный URL):**
```bash
./start-ngrok.sh
# Выберите режим (Docker или локальная разработка)
```
Откройте https://ebony-unacquainted-myra.ngrok-free.dev

**Без Docker:**
```bash
npm install
npm run dev --workspace=@secure-p2p-messenger/client
npm run dev --workspace=@secure-p2p-messenger/server
```

### На Сервере

**С Docker (~20 минут):**
```bash
cp .env.production .env
# Отредактировать .env
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**С PM2 (~40 минут):**
```bash
# Автоматический скрипт
./DEPLOYMENT_COMMANDS.sh

# Или вручную
# См. docs/PM2_DEPLOYMENT.md
```

📖 **Полные инструкции:** [ONE_PAGE_DEPLOY.md](ONE_PAGE_DEPLOY.md)

## 📚 Документация

**[📖 Полный Индекс Документации](docs/DEPLOYMENT_INDEX.md)** - Все руководства в одном месте

### Быстрый Старт
- **[Быстрый Старт](docs/QUICK_START.md)** - Запуск за 5 минут
- **[Развертывание на Одной Странице](ONE_PAGE_DEPLOY.md)** - Все команды

### Выбор Подхода
- **[Docker vs PM2](docs/DOCKER_VS_PM2.md)** - Какой способ выбрать?

### Развертывание
- **[С Docker](DEPLOYMENT.md)** - Полное руководство (~20 минут)
- **[С PM2](docs/PM2_DEPLOYMENT.md)** - Без Docker (~40 минут)
- **[Быстрые Команды](docs/QUICK_COMMANDS.md)** - Шпаргалка
- **[Автоскрипт](DEPLOYMENT_COMMANDS.sh)** - Автоматическая установка

### Дополнительно
- **[Настройка SSL](docs/SSL_SETUP.md)** - HTTPS и WSS сертификаты
- **[Бесплатные Домены](docs/FREE_DOMAINS.md)** - Где взять домен для тестов
- **[Настройка Ngrok](docs/NGROK_SETUP.md)** - Публичный URL через туннель
- **[Список Файлов](DEPLOYMENT_FILES.md)** - Все конфигурационные файлы

## Структура Проекта

```
secure-p2p-messenger/
├── packages/
│   ├── client/          # React веб-клиент
│   └── server/          # Node.js сигнальный сервер
├── package.json         # Root package.json для monorepo
└── README.md
```

## Требования

- Node.js >= 18
- PostgreSQL >= 14
- npm или yarn

## Установка

1. Установите зависимости:
```bash
npm install
```

Если возникают проблемы с npm install, попробуйте:
```bash
npm install --legacy-peer-deps
# или
npm cache clean --force && npm install
```

2. Настройте PostgreSQL:

Вариант A - Используя Docker (рекомендуется):
```bash
docker-compose up -d
```

Вариант B - Локальная установка PostgreSQL:
```bash
# Создайте базу данных
createdb secure_p2p_messenger

# Примените схему
psql -d secure_p2p_messenger -f packages/server/src/db/schema.sql
```

3. Настройте переменные окружения:
```bash
cp packages/server/.env.example packages/server/.env
# Отредактируйте packages/server/.env с вашими настройками
```

## Запуск

### Разработка

**С Docker:**
```bash
make dev
# или
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**Без Docker:**
```bash
# Терминал 1 - Клиент
cd packages/client
npm run dev

# Терминал 2 - Сервер
cd packages/server
npm run dev
```

### Production

**С Docker:**
```bash
make setup-prod  # Создать .env
# Отредактировать .env
make build
make start
```

**С PM2:**
```bash
# См. docs/PM2_DEPLOYMENT.md для полного руководства
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Тестирование

```bash
# Запустить все тесты
npm test

# Запустить тесты с покрытием
npm test -- --coverage
```

### Линтинг и Форматирование

```bash
# Проверить код
npm run lint

# Форматировать код
npm run format
```

## Технологии

### Клиент
- React 18
- TypeScript
- Vite
- Web Crypto API
- WebRTC
- IndexedDB

### Сервер
- Node.js
- TypeScript
- WebSocket (ws)
- PostgreSQL
- JWT Authentication
- bcrypt

### Тестирование
- Jest
- fast-check (property-based testing)
- React Testing Library

## 🛠️ Полезные Команды

### С Makefile
```bash
make help          # Показать все команды
make dev           # Запустить development
make start         # Запустить production
make logs          # Просмотр логов
make backup        # Создать backup БД
make ssl-renew     # Обновить SSL сертификаты
```

### С PM2
```bash
pm2 list           # Список процессов
pm2 logs           # Просмотр логов
pm2 monit          # Мониторинг
pm2 restart all    # Перезапуск
```

## 🔒 Безопасность

- **End-to-End шифрование**: AES-GCM-256
- **Обмен ключами**: ECDH (P-256)
- **Аутентификация**: JWT + bcrypt
- **Медиа-потоки**: Insertable Streams API
- **Приватные ключи**: Только на клиенте

## 📊 Архитектура

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client A  │◄───────►│   Signaling  │◄───────►│   Client B  │
│   (React)   │  WSS    │    Server    │  WSS    │   (React)   │
└─────────────┘         │  (Node.js)   │         └─────────────┘
       │                └──────────────┘                │
       │                                                │
       │                ┌──────────────┐                │
       └───────────────►│  TURN/STUN   │◄───────────────┘
         P2P Encrypted  │   (Coturn)   │  P2P Encrypted
                        └──────────────┘
```

## 🤝 Вклад в Проект

Мы приветствуем вклад в проект! См. [CONTRIBUTING.md](CONTRIBUTING.md) для деталей.

## 📝 Лицензия

MIT

## 📞 Поддержка

- **GitHub Issues**: https://github.com/your-org/secure-p2p-messenger/issues
- **Документация**: [docs/](docs/)
- **Email**: support@your-domain.com

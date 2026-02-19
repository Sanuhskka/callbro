# Документация
# Secure P2P Messenger

Добро пожаловать в документацию Secure P2P Messenger!

## Руководства

### Начало Работы
- [Быстрый Старт](QUICK_START.md) - Запустите приложение за 5 минут
- [Руководство по Развертыванию](../DEPLOYMENT.md) - Полное руководство по развертыванию

### Настройка
- [Настройка SSL/TLS](SSL_SETUP.md) - Настройка HTTPS и WSS
- [Переменные Окружения](../.env.example) - Все доступные настройки

### Архитектура
- [Требования](.kiro/specs/secure-p2p-messenger/requirements.md) - Функциональные требования
- [Проектирование](.kiro/specs/secure-p2p-messenger/design.md) - Архитектура системы
- [План Реализации](.kiro/specs/secure-p2p-messenger/tasks.md) - Задачи разработки

## Структура Проекта

```
secure-p2p-messenger/
├── packages/
│   ├── client/          # React веб-клиент
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   └── server/          # Node.js сигнальный сервер
│       ├── src/
│       └── Dockerfile
├── docs/                # Документация
├── .env.example         # Пример переменных окружения
├── docker-compose.yml   # Docker конфигурация
├── coturn.conf          # Конфигурация TURN/STUN
└── Makefile            # Команды для управления
```

## Компоненты Системы

### Клиент (React)
- **Технологии**: React, TypeScript, Material-UI
- **Функции**: 
  - Регистрация и аутентификация
  - Обмен текстовыми сообщениями
  - Отправка медиа-файлов
  - Голосовые сообщения
  - Голосовые и видео звонки
  - End-to-end шифрование

### Сервер (Node.js)
- **Технологии**: Node.js, TypeScript, WebSocket
- **Функции**:
  - WebRTC сигнализация
  - Управление пользователями
  - Маршрутизация сообщений
  - JWT аутентификация

### База Данных (PostgreSQL)
- **Хранение**:
  - Учетные записи пользователей
  - Список контактов
  - Публичные ключи

### TURN/STUN Сервер (Coturn)
- **Функции**:
  - NAT traversal
  - Ретрансляция медиа-трафика
  - Обход файрволов

## Безопасность

### End-to-End Шифрование
- **Алгоритм обмена ключами**: ECDH (P-256)
- **Алгоритм шифрования**: AES-GCM-256
- **Приватные ключи**: Хранятся только на клиенте
- **Медиа-потоки**: Шифруются через Insertable Streams API

### Аутентификация
- **JWT токены**: 7 дней действия
- **Пароли**: Хешируются с bcrypt
- **WebSocket**: Аутентификация при подключении

### Сетевая Безопасность
- **HTTPS/WSS**: Обязательно в production
- **CORS**: Настраиваемые origins
- **Rate Limiting**: Защита от спама
- **Firewall**: Рекомендуемые правила

## Развертывание

### Локальное (Development)
```bash
make setup-dev
make dev
```

### Production
```bash
make setup-prod
# Отредактировать .env
make build
make start
```

### Staging
```bash
cp .env.staging .env
# Отредактировать .env
make start-staging
```

## Мониторинг

### Просмотр Логов
```bash
make logs              # Все сервисы
make logs-server       # Только сервер
make logs-client       # Только клиент
```

### Статус Сервисов
```bash
make status            # Статус контейнеров
make stats             # Использование ресурсов
make health            # Проверка здоровья
```

## Обслуживание

### Резервное Копирование
```bash
make backup            # Создать backup БД
make restore           # Восстановить из backup
```

### Обновление
```bash
git pull origin main
make build
make restart
```

### Очистка
```bash
make clean             # Удалить контейнеры и volumes
make clean-images      # Удалить Docker образы
```

## Тестирование

### Запуск Тестов
```bash
make test              # Все тесты
make test-client       # Тесты клиента
make test-server       # Тесты сервера
```

### Типы Тестов
- **Unit тесты**: Тестирование отдельных компонентов
- **Property-based тесты**: Проверка универсальных свойств
- **Интеграционные тесты**: Тестирование взаимодействия компонентов

## Производительность

### Рекомендации
- **Минимум 2 CPU ядра** для production
- **4 GB RAM** минимум
- **SSD диск** для базы данных
- **CDN** для статических файлов
- **Load Balancer** для масштабирования

### Оптимизация
- Gzip сжатие включено
- Кеширование статических файлов
- Оптимизированные Docker образы
- PostgreSQL настройки для production

## Устранение Неполадок

### Частые Проблемы

**Контейнеры не запускаются**:
```bash
docker-compose logs
docker-compose down
docker-compose up -d --force-recreate
```

**WebSocket не подключается**:
- Проверьте порт 8081
- Проверьте CORS настройки
- Используйте wss:// в production

**P2P соединение не устанавливается**:
- Проверьте TURN/STUN сервер
- Проверьте открытые порты
- Проверьте EXTERNAL_IP

**Ошибки базы данных**:
```bash
make db-shell
make db-migrate
```

## Поддержка

### Ресурсы
- **GitHub**: https://github.com/your-org/secure-p2p-messenger
- **Issues**: https://github.com/your-org/secure-p2p-messenger/issues
- **Email**: support@your-domain.com

### Вклад в Проект
Мы приветствуем вклад в проект! См. [CONTRIBUTING.md](../CONTRIBUTING.md) для деталей.

## Лицензия

См. [LICENSE](../LICENSE) файл для деталей.

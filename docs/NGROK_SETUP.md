# 🚇 Настройка с Ngrok
# Secure P2P Messenger

Полное руководство по развертыванию с использованием Ngrok для тестирования.

---

## 🎯 Что Такое Ngrok?

Ngrok создает безопасный туннель от интернета к вашему локальному серверу:
- ✅ HTTPS из коробки (бесплатный SSL)
- ✅ Публичный URL для локального сервера
- ✅ Отлично для тестирования и демо
- ✅ Не нужно настраивать DNS и SSL

---

## 📋 Ваша Конфигурация

**Домен:** `ebony-unacquainted-myra.ngrok-free.dev`  
**Authtoken:** `37TZ9geaKvmc7yYmhYys7Z2bLu2_5vrNmMNJ7bDGCMnCe9YUC`

---

## 🚀 Быстрый Старт

### Вариант 1: Локальная Разработка с Ngrok (Рекомендуется)

```bash
# 1. Установить Ngrok
# Linux/Mac
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list && \
  sudo apt update && sudo apt install ngrok

# Mac (Homebrew)
brew install ngrok/ngrok/ngrok

# Windows (Chocolatey)
choco install ngrok

# 2. Настроить authtoken
ngrok config add-authtoken 37TZ9geaKvmc7yYmhYys7Z2bLu2_5vrNmMNJ7bDGCMnCe9YUC

# 3. Скопировать конфигурацию
cp .env.ngrok packages/server/.env
cp .env.ngrok packages/client/.env.local

# 4. Запустить базу данных
docker-compose up -d postgres

# 5. Запустить приложение локально
# Терминал 1 - Сервер
cd packages/server
npm run dev

# Терминал 2 - Клиент
cd packages/client
npm run dev

# 6. Запустить Ngrok туннели
# Терминал 3
ngrok start --all --config ngrok.yml
```

**Готово!** Откройте: https://ebony-unacquainted-myra.ngrok-free.dev

---

### Вариант 2: Production-like с Docker и Ngrok

```bash
# 1. Установить Ngrok (см. выше)

# 2. Настроить authtoken
ngrok config add-authtoken 37TZ9geaKvmc7yYmhYys7Z2bLu2_5vrNmMNJ7bDGCMnCe9YUC

# 3. Скопировать конфигурацию
cp .env.ngrok .env

# 4. Запустить Docker контейнеры
docker-compose up -d

# 5. Запустить Ngrok
ngrok start --all --config ngrok.yml
```

**Готово!** Откройте: https://ebony-unacquainted-myra.ngrok-free.dev

---

## 📝 Детальная Настройка

### Шаг 1: Установка Ngrok

#### Linux (Ubuntu/Debian)
```bash
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null

echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list

sudo apt update
sudo apt install ngrok
```

#### Mac
```bash
brew install ngrok/ngrok/ngrok
```

#### Windows
```powershell
# Скачать с https://ngrok.com/download
# Или через Chocolatey
choco install ngrok
```

#### Проверка установки
```bash
ngrok version
```

---

### Шаг 2: Настройка Authtoken

```bash
ngrok config add-authtoken 37TZ9geaKvmc7yYmhYys7Z2bLu2_5vrNmMNJ7bDGCMnCe9YUC
```

Это сохранит токен в `~/.ngrok2/ngrok.yml`

---

### Шаг 3: Конфигурация Приложения

#### Для Сервера

Создать `packages/server/.env`:
```env
NODE_ENV=development
WS_PORT=8081

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=secure_p2p_messenger
DB_USER=postgres
DB_PASSWORD=postgres

# JWT
JWT_SECRET=ngrok-test-secret
JWT_EXPIRES_IN=7d

# CORS - Ngrok Domain
CORS_ORIGIN=https://ebony-unacquainted-myra.ngrok-free.dev

# Logging
LOG_LEVEL=debug
```

#### Для Клиента

Создать `packages/client/.env.local`:
```env
# WebSocket URL через Ngrok
VITE_WS_URL=wss://ebony-unacquainted-myra.ngrok-free.dev/ws

# TURN/STUN (используем публичные серверы Google)
VITE_TURN_SERVER=turn:stun.l.google.com:19302
VITE_STUN_SERVER=stun:stun.l.google.com:19302

# App Config
VITE_APP_NAME=Secure P2P Messenger
VITE_MAX_FILE_SIZE=52428800
```

---

### Шаг 4: Настройка Nginx (для Docker)

Обновить `packages/client/nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/javascript application/javascript application/json;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # WebSocket proxy
    location /ws {
        proxy_pass http://server:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
    
    # Cache static
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

### Шаг 5: Запуск

#### Вариант A: Локальная Разработка

```bash
# Терминал 1 - База данных
docker-compose up -d postgres

# Терминал 2 - Сервер
cd packages/server
npm install
npm run dev

# Терминал 3 - Клиент  
cd packages/client
npm install
npm run dev

# Терминал 4 - Ngrok
ngrok http 5173 --domain=ebony-unacquainted-myra.ngrok-free.dev
```

#### Вариант B: Docker

```bash
# Терминал 1 - Docker
docker-compose up

# Терминал 2 - Ngrok
ngrok http 80 --domain=ebony-unacquainted-myra.ngrok-free.dev
```

---

## 🔧 Ngrok Конфигурация

Файл `ngrok.yml` уже создан в корне проекта:

```yaml
version: "2"
authtoken: 37TZ9geaKvmc7yYmhYys7Z2bLu2_5vrNmMNJ7bDGCMnCe9YUC

tunnels:
  web:
    proto: http
    addr: 80
    domain: ebony-unacquainted-myra.ngrok-free.dev
    inspect: true
```

Запуск:
```bash
ngrok start --all --config ngrok.yml
```

---

## 🌐 Доступ к Приложению

После запуска Ngrok:

**URL:** https://ebony-unacquainted-myra.ngrok-free.dev

**Ngrok Dashboard:** http://localhost:4040

В dashboard вы увидите:
- Все HTTP запросы
- WebSocket соединения
- Ошибки
- Статистику

---

## 🔍 Проверка Работы

```bash
# 1. Проверить HTTP
curl https://ebony-unacquainted-myra.ngrok-free.dev

# 2. Проверить WebSocket
wscat -c wss://ebony-unacquainted-myra.ngrok-free.dev/ws

# 3. Открыть в браузере
https://ebony-unacquainted-myra.ngrok-free.dev

# 4. Проверить Ngrok dashboard
http://localhost:4040
```

---

## 🎯 Особенности Ngrok

### Преимущества

✅ **HTTPS из коробки** - SSL сертификат предоставляется автоматически  
✅ **Публичный URL** - доступен из любой точки мира  
✅ **Инспектор запросов** - видите все запросы в реальном времени  
✅ **Не нужен DNS** - домен предоставляется Ngrok  
✅ **Быстрый старт** - работает за минуты  

### Ограничения

⚠️ **Бесплатный план:**
- 1 онлайн процесс
- 40 соединений/минуту
- Домен может измениться при перезапуске (если не зарезервирован)

⚠️ **Не для production:**
- Зависимость от Ngrok сервиса
- Ограничения производительности
- Может быть нестабильно

---

## 🔄 Автоматический Перезапуск

### Systemd Service (Linux)

Создать `/etc/systemd/system/ngrok.service`:

```ini
[Unit]
Description=Ngrok Tunnel
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/secure-p2p-messenger
ExecStart=/usr/local/bin/ngrok start --all --config /path/to/ngrok.yml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Активировать:
```bash
sudo systemctl enable ngrok
sudo systemctl start ngrok
sudo systemctl status ngrok
```

---

## 🐛 Устранение Проблем

### Ngrok не запускается

```bash
# Проверить authtoken
ngrok config check

# Проверить версию
ngrok version

# Переустановить authtoken
ngrok config add-authtoken 37TZ9geaKvmc7yYmhYys7Z2bLu2_5vrNmMNJ7bDGCMnCe9YUC
```

### WebSocket не работает

```bash
# Проверить что сервер слушает порт 8081
netstat -tulpn | grep 8081

# Проверить Nginx конфигурацию
nginx -t

# Проверить логи Ngrok
# Открыть http://localhost:4040
```

### Ошибка "tunnel not found"

```bash
# Убедиться что домен правильный
# Проверить в Ngrok dashboard: https://dashboard.ngrok.com

# Перезапустить Ngrok
pkill ngrok
ngrok start --all --config ngrok.yml
```

### CORS ошибки

Убедиться что в `packages/server/.env`:
```env
CORS_ORIGIN=https://ebony-unacquainted-myra.ngrok-free.dev
```

---

## 📊 Мониторинг

### Ngrok Dashboard

Откройте http://localhost:4040 для просмотра:
- HTTP запросов
- WebSocket соединений
- Ошибок
- Статистики

### Логи Приложения

```bash
# Docker
docker-compose logs -f

# PM2
pm2 logs

# Локальная разработка
# Смотрите в терминалах где запущены сервер и клиент
```

---

## 🔐 Безопасность

### Для Тестирования

Текущая конфигурация подходит для тестирования:
- ✅ HTTPS через Ngrok
- ✅ WSS для WebSocket
- ✅ CORS настроен

### Для Production

Не используйте Ngrok для production! Вместо этого:
1. Купите домен
2. Настройте DNS
3. Получите Let's Encrypt SSL
4. Используйте собственный сервер

---

## 📝 Полный Пример Запуска

### С Docker

```bash
# 1. Клонировать проект
git clone https://github.com/your-org/secure-p2p-messenger.git
cd secure-p2p-messenger

# 2. Установить Ngrok
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# 3. Настроить authtoken
ngrok config add-authtoken 37TZ9geaKvmc7yYmhYys7Z2bLu2_5vrNmMNJ7bDGCMnCe9YUC

# 4. Скопировать конфигурацию
cp .env.ngrok .env

# 5. Запустить Docker
docker-compose up -d

# 6. Запустить Ngrok
ngrok http 80 --domain=ebony-unacquainted-myra.ngrok-free.dev

# 7. Открыть в браузере
# https://ebony-unacquainted-myra.ngrok-free.dev
```

### Без Docker (Локально)

```bash
# 1-3. То же самое

# 4. Установить зависимости
npm install

# 5. Настроить переменные
cp .env.ngrok packages/server/.env
cp .env.ngrok packages/client/.env.local

# 6. Запустить БД
docker-compose up -d postgres

# 7. Инициализировать БД
psql -h localhost -U postgres -d secure_p2p_messenger -f packages/server/src/db/schema.sql

# 8. Запустить сервер (терминал 1)
cd packages/server
npm run dev

# 9. Запустить клиент (терминал 2)
cd packages/client
npm run dev

# 10. Запустить Ngrok (терминал 3)
ngrok http 5173 --domain=ebony-unacquainted-myra.ngrok-free.dev

# 11. Открыть в браузере
# https://ebony-unacquainted-myra.ngrok-free.dev
```

---

## 🎓 Дополнительные Ресурсы

- **Ngrok Docs**: https://ngrok.com/docs
- **Ngrok Dashboard**: https://dashboard.ngrok.com
- **Ngrok Pricing**: https://ngrok.com/pricing

---

## 💡 Советы

1. **Сохраните authtoken** - он нужен для всех запусков
2. **Используйте Ngrok dashboard** - http://localhost:4040 для отладки
3. **Зарезервируйте домен** - чтобы он не менялся (платная опция)
4. **Не для production** - только для тестирования и демо

---

**Готово! Ваш мессенджер доступен через Ngrok! 🚀**

URL: https://ebony-unacquainted-myra.ngrok-free.dev

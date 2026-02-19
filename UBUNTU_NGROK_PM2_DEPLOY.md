# 🚀 Развертывание на Ubuntu 24 с PM2 и Ngrok
# Secure P2P Messenger

Полное пошаговое руководство для развертывания на сервере Ubuntu 24.04 с использованием PM2 и Ngrok.

**Ваш домен:** `ebony-unacquainted-myra.ngrok-free.dev`  
**Время:** ~30 минут

---

## 📋 Что Будет Установлено

- ✅ Node.js 18.x
- ✅ PM2 (менеджер процессов)
- ✅ PostgreSQL 16
- ✅ Nginx
- ✅ Ngrok
- ✅ Приложение в `/root/secure-p2p-messenger`

---

## 🎯 Полная Последовательность Команд

### Шаг 1: Подключение к Серверу

```bash
# Подключиться к серверу
ssh root@YOUR_SERVER_IP

# Или если используете пользователя с sudo
ssh username@YOUR_SERVER_IP
```

---

### Шаг 2: Обновление Системы (2 минуты)

```bash
# Обновить систему
apt update && apt upgrade -y

# Установить базовые утилиты
apt install -y curl wget git build-essential
```

---

### Шаг 3: Установка Node.js 18.x (3 минуты)

```bash
# Добавить репозиторий Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -

# Установить Node.js
apt install -y nodejs

# Проверить версию
node --version  # должно быть v18.x.x
npm --version   # должно быть 9.x.x или выше
```

---

### Шаг 4: Установка PM2 (1 минута)

```bash
# Установить PM2 глобально
npm install -g pm2

# Проверить установку
pm2 --version
```

---

### Шаг 5: Установка PostgreSQL 16 (3 минуты)

```bash
# Установить PostgreSQL
apt install -y postgresql postgresql-contrib

# Запустить и включить автозапуск
systemctl start postgresql
systemctl enable postgresql

# Проверить статус
systemctl status postgresql
```

---

### Шаг 6: Настройка PostgreSQL (2 минуты)

```bash
# Переключиться на пользователя postgres и создать БД
sudo -u postgres psql << EOF
CREATE DATABASE secure_p2p_messenger;
CREATE USER messenger_user WITH ENCRYPTED PASSWORD 'messenger_password_123';
GRANT ALL PRIVILEGES ON DATABASE secure_p2p_messenger TO messenger_user;
\c secure_p2p_messenger
GRANT ALL ON SCHEMA public TO messenger_user;
GRANT CREATE ON SCHEMA public TO messenger_user;
\q
EOF

# Проверить подключение
PGPASSWORD='messenger_password_123' psql -h localhost -U messenger_user -d secure_p2p_messenger -c "SELECT 1"
```

---

### Шаг 7: Установка Nginx (2 минуты)

```bash
# Установить Nginx
apt install -y nginx

# Запустить и включить автозапуск
systemctl start nginx
systemctl enable nginx

# Проверить статус
systemctl status nginx
```

---

### Шаг 8: Установка Ngrok (2 минуты)

```bash
# Добавить репозиторий Ngrok
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null

echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  tee /etc/apt/sources.list.d/ngrok.list

# Обновить и установить
apt update
apt install -y ngrok

# Проверить установку
ngrok version

# Настроить authtoken
ngrok config add-authtoken 37TZ9geaKvmc7yYmhYys7Z2bLu2_5vrNmMNJ7bDGCMnCe9YUC
```

---

### Шаг 9: Перенос Файлов на Сервер (5 минут)

#### Вариант A: Через Git (Рекомендуется)

```bash
# Перейти в корневую директорию
cd /root

# Клонировать репозиторий
git clone https://github.com/Sanuhskka/callbro.git secure-p2p-messenger
cd secure-p2p-messenger
```

#### Вариант B: Через SCP (Если файлы локально)

На вашем локальном компьютере:
```bash
# Упаковать проект (исключая node_modules)
tar --exclude='node_modules' --exclude='.git' -czf messenger.tar.gz .

# Скопировать на сервер
scp messenger.tar.gz root@YOUR_SERVER_IP:/root/

# На сервере распаковать
ssh root@YOUR_SERVER_IP
cd /root
tar -xzf messenger.tar.gz
mv * secure-p2p-messenger/ 2>/dev/null || true
cd secure-p2p-messenger
```

#### Вариант C: Через SFTP

```bash
# Использовать FileZilla, WinSCP или другой SFTP клиент
# Загрузить все файлы в /root/secure-p2p-messenger/
```

---

### Шаг 10: Установка Зависимостей (5 минут)

```bash
# Убедиться что находимся в директории проекта
cd /root/secure-p2p-messenger

# Установить зависимости
npm install

# Установить зависимости для workspace
npm install --workspace=@secure-p2p-messenger/server
npm install --workspace=@secure-p2p-messenger/client

# Установить TypeScript глобально (для сборки)
npm install -g typescript

# Дать права на выполнение для бинарников
chmod -R +x node_modules/.bin/ 2>/dev/null || true
chmod -R +x packages/server/node_modules/.bin/ 2>/dev/null || true
chmod -R +x packages/client/node_modules/.bin/ 2>/dev/null || true
```

---

### Шаг 11: Настройка Переменных Окружения (2 минуты)

```bash
# Создать .env для сервера
cat > /root/secure-p2p-messenger/packages/server/.env << 'EOF'
NODE_ENV=production
WS_PORT=8081

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=secure_p2p_messenger
DB_USER=messenger_user
DB_PASSWORD=messenger_password_123

# JWT
JWT_SECRET=ngrok-production-secret-change-this
JWT_EXPIRES_IN=7d

# CORS - Ngrok Domain
CORS_ORIGIN=https://ebony-unacquainted-myra.ngrok-free.dev

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
EOF

# Создать .env для клиента (для сборки)
cat > /root/secure-p2p-messenger/packages/client/.env << 'EOF'
VITE_WS_URL=wss://ebony-unacquainted-myra.ngrok-free.dev/ws
VITE_TURN_SERVER=turn:stun.l.google.com:19302
VITE_STUN_SERVER=stun:stun.l.google.com:19302
VITE_APP_NAME=Secure P2P Messenger
VITE_MAX_FILE_SIZE=52428800
EOF
```

---

### Шаг 12: Инициализация Базы Данных (1 минута)

```bash
# Применить SQL схему
PGPASSWORD='messenger_password_123' psql -h localhost -U messenger_user -d secure_p2p_messenger -f /root/secure-p2p-messenger/packages/server/src/db/schema.sql

# Проверить что таблицы созданы
PGPASSWORD='messenger_password_123' psql -h localhost -U messenger_user -d secure_p2p_messenger -c "\dt"
```

---

### Шаг 13: Сборка Приложения (3 минуты)

```bash
cd /root/secure-p2p-messenger

# Собрать сервер
npm run build --workspace=@secure-p2p-messenger/server

# Собрать клиент
npm run build --workspace=@secure-p2p-messenger/client

# Проверить что сборка прошла успешно
ls -la packages/server/dist/
ls -la packages/client/dist/
```

---

### Шаг 14: Создание Директории для Логов (1 минута)

```bash
# Создать директорию для PM2 логов
mkdir -p /root/secure-p2p-messenger/logs
```

---

### Шаг 15: Настройка Nginx (2 минуты)

```bash
# Создать конфигурацию Nginx
cat > /etc/nginx/sites-available/secure-p2p-messenger << 'EOF'
server {
    listen 80;
    server_name localhost;
    
    # Root directory для клиента
    root /root/secure-p2p-messenger/packages/client/dist;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # WebSocket proxy для сигнального сервера
    location /ws {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Don't cache index.html
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # Access logs
    access_log /var/log/nginx/secure-p2p-messenger-access.log;
    error_log /var/log/nginx/secure-p2p-messenger-error.log;
}
EOF

# Активировать конфигурацию
ln -sf /etc/nginx/sites-available/secure-p2p-messenger /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Проверить конфигурацию
nginx -t

# Перезапустить Nginx
systemctl restart nginx
```

---

### Шаг 16: Запуск Сервера через PM2 (2 минуты)

```bash
cd /root/secure-p2p-messenger

# Запустить сервер через PM2
pm2 start ecosystem.config.js --env production

# Проверить статус
pm2 status

# Просмотреть логи
pm2 logs secure-p2p-server --lines 20
```

---

### Шаг 17: Настройка Автозапуска PM2 (1 минута)

```bash
# Сохранить текущий список процессов
pm2 save

# Настроить автозапуск при загрузке системы
pm2 startup

# PM2 выведет команду, скопируйте и выполните её
# Например:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

# Проверить что автозапуск настроен
systemctl status pm2-root
```

---

### Шаг 18: Запуск Ngrok (2 минуты)

#### Вариант A: Вручную (для тестирования)

```bash
# Запустить Ngrok в отдельном терминале или screen/tmux
ngrok http 80 --domain=ebony-unacquainted-myra.ngrok-free.dev
```

#### Вариант B: Через PM2 (Рекомендуется)

```bash
# Создать PM2 конфигурацию для Ngrok
cat > /root/secure-p2p-messenger/ecosystem-ngrok.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'ngrok-tunnel',
      script: 'ngrok',
      args: 'http 80 --domain=ebony-unacquainted-myra.ngrok-free.dev --log=stdout',
      cwd: '/root/secure-p2p-messenger',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      error_file: './logs/ngrok-error.log',
      out_file: './logs/ngrok-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
EOF

# Запустить Ngrok через PM2
pm2 start ecosystem-ngrok.config.js

# Сохранить
pm2 save

# Проверить статус
pm2 status
```

#### Вариант C: Через Systemd Service

```bash
# Создать systemd service
cat > /etc/systemd/system/ngrok.service << 'EOF'
[Unit]
Description=Ngrok Tunnel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/secure-p2p-messenger
ExecStart=/usr/bin/ngrok http 80 --domain=ebony-unacquainted-myra.ngrok-free.dev --log=stdout
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Перезагрузить systemd
systemctl daemon-reload

# Запустить и включить автозапуск
systemctl start ngrok
systemctl enable ngrok

# Проверить статус
systemctl status ngrok
```

---

### Шаг 19: Проверка Работы (2 минуты)

```bash
# 1. Проверить PM2 процессы
pm2 status

# 2. Проверить Nginx
systemctl status nginx

# 3. Проверить PostgreSQL
systemctl status postgresql

# 4. Проверить Ngrok
# Если через PM2:
pm2 logs ngrok-tunnel --lines 10

# Если через systemd:
systemctl status ngrok
journalctl -u ngrok -n 20

# 5. Проверить локальный доступ
curl http://localhost

# 6. Проверить WebSocket
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8081

# 7. Открыть Ngrok dashboard (если доступен)
# http://YOUR_SERVER_IP:4040

# 8. Открыть приложение в браузере
# https://ebony-unacquainted-myra.ngrok-free.dev
```

---

## ✅ Готово!

Ваше приложение развернуто и доступно по адресу:

**https://ebony-unacquainted-myra.ngrok-free.dev**

---

## 🔧 Управление Приложением

### PM2 Команды

```bash
# Просмотр статуса
pm2 status

# Просмотр логов
pm2 logs
pm2 logs secure-p2p-server
pm2 logs ngrok-tunnel

# Перезапуск
pm2 restart secure-p2p-server
pm2 restart ngrok-tunnel
pm2 restart all

# Остановка
pm2 stop secure-p2p-server
pm2 stop ngrok-tunnel
pm2 stop all

# Мониторинг
pm2 monit

# Удаление из PM2
pm2 delete secure-p2p-server
pm2 delete ngrok-tunnel
```

### Nginx Команды

```bash
# Проверка конфигурации
nginx -t

# Перезапуск
systemctl restart nginx

# Просмотр логов
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/secure-p2p-messenger-access.log
```

### PostgreSQL Команды

```bash
# Подключение к БД
PGPASSWORD='messenger_password_123' psql -h localhost -U messenger_user -d secure_p2p_messenger

# Просмотр таблиц
PGPASSWORD='messenger_password_123' psql -h localhost -U messenger_user -d secure_p2p_messenger -c "\dt"

# Backup
PGPASSWORD='messenger_password_123' pg_dump -h localhost -U messenger_user secure_p2p_messenger > backup_$(date +%Y%m%d).sql
```

---

## 🔄 Обновление Приложения

```bash
# 1. Перейти в директорию
cd /root/secure-p2p-messenger

# 2. Остановить PM2 процессы
pm2 stop secure-p2p-server

# 3. Получить последние изменения
git pull origin main
# Или загрузить новые файлы через SCP/SFTP

# 4. Установить зависимости (если изменились)
npm install

# 5. Пересобрать приложение
npm run build --workspace=@secure-p2p-messenger/server
npm run build --workspace=@secure-p2p-messenger/client

# 6. Запустить PM2 процессы
pm2 restart secure-p2p-server

# 7. Проверить логи
pm2 logs secure-p2p-server --lines 50
```

---

## 🐛 Устранение Проблем

### PM2 процесс не запускается

```bash
# Проверить логи
pm2 logs secure-p2p-server --err

# Проверить что сборка прошла успешно
ls -la /root/secure-p2p-messenger/packages/server/dist/

# Попробовать запустить напрямую
cd /root/secure-p2p-messenger/packages/server
node dist/index.js
```

### Ngrok не работает

```bash
# Проверить authtoken
ngrok config check

# Проверить логи
# Если через PM2:
pm2 logs ngrok-tunnel

# Если через systemd:
journalctl -u ngrok -n 50

# Перезапустить
pm2 restart ngrok-tunnel
# или
systemctl restart ngrok
```

### WebSocket не подключается

```bash
# Проверить что сервер слушает порт
netstat -tulpn | grep 8081

# Проверить Nginx конфигурацию
nginx -t

# Проверить логи Nginx
tail -f /var/log/nginx/error.log

# Проверить CORS в .env
cat /root/secure-p2p-messenger/packages/server/.env | grep CORS
```

### База данных не подключается

```bash
# Проверить что PostgreSQL запущен
systemctl status postgresql

# Проверить подключение
PGPASSWORD='messenger_password_123' psql -h localhost -U messenger_user -d secure_p2p_messenger -c "SELECT 1"

# Проверить логи PostgreSQL
tail -f /var/log/postgresql/postgresql-16-main.log
```

### Приложение не открывается через Ngrok

```bash
# 1. Проверить что Nginx работает
systemctl status nginx
curl http://localhost

# 2. Проверить что Ngrok запущен
pm2 status ngrok-tunnel
# или
systemctl status ngrok

# 3. Проверить Ngrok dashboard
# http://YOUR_SERVER_IP:4040

# 4. Проверить логи
pm2 logs ngrok-tunnel
# или
journalctl -u ngrok -n 50
```

---

## 📊 Мониторинг

### Просмотр Логов

```bash
# PM2 логи
pm2 logs

# Nginx логи
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/secure-p2p-messenger-access.log

# Системные логи
journalctl -f
```

### Использование Ресурсов

```bash
# PM2 мониторинг
pm2 monit

# Системные ресурсы
htop

# Использование диска
df -h

# Использование памяти
free -h

# Сетевые соединения
netstat -tulpn | grep LISTEN
```

---

## 🔒 Безопасность

### Рекомендации

1. **Измените пароли:**
```bash
# Изменить пароль БД в .env
nano /root/secure-p2p-messenger/packages/server/.env

# Изменить JWT_SECRET
nano /root/secure-p2p-messenger/packages/server/.env
```

2. **Настройте firewall (опционально):**
```bash
# Установить UFW
apt install -y ufw

# Разрешить SSH
ufw allow 22/tcp

# Разрешить HTTP/HTTPS (для Nginx)
ufw allow 80/tcp
ufw allow 443/tcp

# Включить firewall
ufw enable

# Проверить статус
ufw status
```

3. **Регулярные обновления:**
```bash
# Обновлять систему
apt update && apt upgrade -y

# Обновлять зависимости Node.js
cd /root/secure-p2p-messenger
npm update
```

---

## 📝 Резервное Копирование

### Автоматический Backup

```bash
# Создать скрипт backup
cat > /root/backup-messenger.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Создать директорию
mkdir -p $BACKUP_DIR

# Backup базы данных
PGPASSWORD='messenger_password_123' pg_dump -h localhost -U messenger_user secure_p2p_messenger | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Удалить старые backups (старше 7 дней)
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_backup_$DATE.sql.gz"
EOF

# Сделать исполняемым
chmod +x /root/backup-messenger.sh

# Добавить в crontab (ежедневно в 2:00)
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup-messenger.sh >> /var/log/backup.log 2>&1") | crontab -

# Проверить crontab
crontab -l
```

---

## 🎯 Чеклист Развертывания

- [x] Node.js 18.x установлен
- [x] PM2 установлен
- [x] PostgreSQL установлен и настроен
- [x] Nginx установлен и настроен
- [x] Ngrok установлен и настроен
- [x] Файлы перенесены в /root/secure-p2p-messenger
- [x] Зависимости установлены
- [x] .env файлы настроены
- [x] База данных инициализирована
- [x] Приложение собрано
- [x] PM2 процессы запущены
- [x] Ngrok туннель запущен
- [x] Автозапуск настроен
- [x] Приложение доступно через Ngrok

---

## 🌐 Ваши URL

- **Приложение:** https://ebony-unacquainted-myra.ngrok-free.dev
- **Ngrok Dashboard:** http://YOUR_SERVER_IP:4040 (если доступен)

---

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи: `pm2 logs`, `tail -f /var/log/nginx/error.log`
2. Проверьте статус: `pm2 status`, `systemctl status nginx`
3. См. раздел "Устранение Проблем" выше

---

**Готово! Ваш мессенджер развернут на Ubuntu 24 с PM2 и Ngrok! 🎉**

**URL:** https://ebony-unacquainted-myra.ngrok-free.dev

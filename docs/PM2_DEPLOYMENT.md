# Развертывание с PM2 (без Docker)
# Secure P2P Messenger

Это руководство описывает полный процесс развертывания приложения на сервере с использованием PM2 вместо Docker.

## Содержание

1. [Подготовка Сервера](#подготовка-сервера)
2. [Установка Зависимостей](#установка-зависимостей)
3. [Настройка PostgreSQL](#настройка-postgresql)
4. [Настройка Coturn](#настройка-coturn)
5. [Настройка Приложения](#настройка-приложения)
6. [Настройка Nginx](#настройка-nginx)
7. [Запуск с PM2](#запуск-с-pm2)
8. [SSL Сертификаты](#ssl-сертификаты)
9. [Автозапуск](#автозапуск)
10. [Мониторинг](#мониторинг)

---

## Подготовка Сервера

### Минимальные Требования

- **ОС**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **CPU**: 2 ядра
- **RAM**: 4 GB
- **Диск**: 20 GB
- **Доступ**: root или sudo

### Шаг 1: Обновление Системы

```bash
# Подключиться к серверу
ssh user@your-server-ip

# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить базовые утилиты
sudo apt install -y curl wget git build-essential
```

### Шаг 2: Настройка Firewall

```bash
# Установить UFW (если не установлен)
sudo apt install -y ufw

# Разрешить SSH
sudo ufw allow 22/tcp

# Разрешить HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Разрешить WebSocket
sudo ufw allow 8081/tcp

# Разрешить TURN/STUN
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:49252/udp

# Включить firewall
sudo ufw enable

# Проверить статус
sudo ufw status
```

---

## Установка Зависимостей

### Шаг 3: Установка Node.js

```bash
# Установить Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Проверить версию
node --version  # должно быть v18.x.x
npm --version   # должно быть 9.x.x или выше
```

### Шаг 4: Установка PM2

```bash
# Установить PM2 глобально
sudo npm install -g pm2

# Проверить установку
pm2 --version
```

### Шаг 5: Установка PostgreSQL

```bash
# Установить PostgreSQL 14
sudo apt install -y postgresql postgresql-contrib

# Запустить PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Проверить статус
sudo systemctl status postgresql
```

### Шаг 6: Установка Nginx

```bash
# Установить Nginx
sudo apt install -y nginx

# Запустить Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Проверить статус
sudo systemctl status nginx
```

### Шаг 7: Установка Coturn

```bash
# Установить Coturn
sudo apt install -y coturn

# Включить Coturn
sudo systemctl enable coturn
```

---

## Настройка PostgreSQL

### Шаг 8: Создание Базы Данных

```bash
# Переключиться на пользователя postgres
sudo -u postgres psql

# В psql выполнить:
CREATE DATABASE secure_p2p_messenger;
CREATE USER messenger_user WITH ENCRYPTED PASSWORD 'your_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE secure_p2p_messenger TO messenger_user;
\q
```

### Шаг 9: Настройка Удаленного Доступа (опционально)

Если база данных на другом сервере:

```bash
# Редактировать postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf

# Найти и изменить:
listen_addresses = 'localhost'  # или '*' для всех интерфейсов

# Редактировать pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Добавить строку:
host    secure_p2p_messenger    messenger_user    0.0.0.0/0    md5

# Перезапустить PostgreSQL
sudo systemctl restart postgresql
```

---

## Настройка Coturn

### Шаг 10: Конфигурация Coturn

```bash
# Создать конфигурационный файл
sudo nano /etc/turnserver.conf
```

Содержимое файла:

```conf
# Listening IP
listening-ip=0.0.0.0

# External IP (замените на ваш публичный IP)
external-ip=YOUR_PUBLIC_IP

# Listening ports
listening-port=3478
tls-listening-port=5349

# Relay ports
min-port=49152
max-port=49252

# Verbose logging
verbose

# Fingerprints
fingerprint

# Long-term credentials
lt-cred-mech

# Realm
realm=secure-p2p-messenger

# User credentials (измените!)
user=turnuser:turnpassword

# SSL certificates (после получения Let's Encrypt)
# cert=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
# pkey=/etc/letsencrypt/live/yourdomain.com/privkey.pem

# Disable multicast
no-multicast-peers

# Disable loopback
no-loopback-peers

# Server name
server-name=coturn

# Log file
log-file=/var/log/turnserver.log

# Disable CLI
no-cli
```

### Шаг 11: Включить Coturn

```bash
# Редактировать /etc/default/coturn
sudo nano /etc/default/coturn

# Раскомментировать строку:
TURNSERVER_ENABLED=1

# Запустить Coturn
sudo systemctl start coturn
sudo systemctl enable coturn

# Проверить статус
sudo systemctl status coturn

# Проверить логи
sudo tail -f /var/log/turnserver.log
```

---

## Настройка Приложения

### Шаг 12: Клонирование Проекта

```bash
# Создать директорию для приложения
sudo mkdir -p /var/www
cd /var/www

# Клонировать репозиторий
sudo git clone https://github.com/your-org/secure-p2p-messenger.git
cd secure-p2p-messenger

# Установить владельца (замените username на вашего пользователя)
sudo chown -R $USER:$USER /var/www/secure-p2p-messenger
```

### Шаг 13: Установка Зависимостей

```bash
# Установить зависимости
npm install

# Установить зависимости для клиента и сервера
npm install --workspace=@secure-p2p-messenger/client
npm install --workspace=@secure-p2p-messenger/server
```

### Шаг 14: Настройка Переменных Окружения

```bash
# Создать .env файл для сервера
nano packages/server/.env
```

Содержимое файла:

```env
# Environment
NODE_ENV=production

# Server
PORT=8080
WS_PORT=8081

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=secure_p2p_messenger
DB_USER=messenger_user
DB_PASSWORD=your_strong_password_here

# JWT (сгенерируйте сильный ключ!)
JWT_SECRET=your_jwt_secret_here_use_openssl_rand_base64_64
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://yourdomain.com

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

Генерация JWT секрета:
```bash
openssl rand -base64 64
```

### Шаг 15: Инициализация Базы Данных

```bash
# Выполнить SQL схему
psql -h localhost -U messenger_user -d secure_p2p_messenger -f packages/server/src/db/schema.sql
# Введите пароль когда попросит
```

### Шаг 16: Сборка Приложения

```bash
# Собрать сервер
cd /var/www/secure-p2p-messenger
npm run build --workspace=@secure-p2p-messenger/server

# Собрать клиент
npm run build --workspace=@secure-p2p-messenger/client

# Проверить что сборка прошла успешно
ls -la packages/server/dist/
ls -la packages/client/dist/
```

### Шаг 17: Создать Директорию для Логов

```bash
# Создать директорию для PM2 логов
mkdir -p /var/www/secure-p2p-messenger/logs
```

---

## Настройка Nginx

### Шаг 18: Конфигурация Nginx

```bash
# Создать конфигурацию для сайта
sudo nano /etc/nginx/sites-available/secure-p2p-messenger
```

Содержимое файла (HTTP версия, позже добавим HTTPS):

```nginx
# HTTP Server (временно, позже перенаправим на HTTPS)
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Root directory для клиента
    root /var/www/secure-p2p-messenger/packages/client/dist;
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
```

### Шаг 19: Активировать Конфигурацию

```bash
# Создать символическую ссылку
sudo ln -s /etc/nginx/sites-available/secure-p2p-messenger /etc/nginx/sites-enabled/

# Удалить дефолтную конфигурацию (опционально)
sudo rm /etc/nginx/sites-enabled/default

# Проверить конфигурацию
sudo nginx -t

# Перезапустить Nginx
sudo systemctl restart nginx
```

---

## Запуск с PM2

### Шаг 20: Запуск Сервера через PM2

```bash
# Перейти в директорию проекта
cd /var/www/secure-p2p-messenger

# Запустить сервер через PM2
pm2 start ecosystem.config.js --env production

# Проверить статус
pm2 status

# Просмотреть логи
pm2 logs secure-p2p-server

# Остановить логи (Ctrl+C)
```

### Шаг 21: Полезные PM2 Команды

```bash
# Просмотр статуса всех процессов
pm2 list

# Просмотр детальной информации
pm2 show secure-p2p-server

# Просмотр логов
pm2 logs secure-p2p-server
pm2 logs secure-p2p-server --lines 100

# Мониторинг в реальном времени
pm2 monit

# Перезапуск
pm2 restart secure-p2p-server

# Остановка
pm2 stop secure-p2p-server

# Удаление из PM2
pm2 delete secure-p2p-server

# Очистка логов
pm2 flush
```

---

## SSL Сертификаты

### Шаг 22: Установка Certbot

```bash
# Установить Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получить SSL сертификат
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Следовать инструкциям:
# - Ввести email
# - Согласиться с условиями
# - Выбрать редирект HTTP -> HTTPS (рекомендуется)
```

Certbot автоматически обновит конфигурацию Nginx для HTTPS.

### Шаг 23: Обновить Конфигурацию для WSS

После получения SSL сертификата, обновите Nginx конфигурацию:

```bash
sudo nano /etc/nginx/sites-available/secure-p2p-messenger
```

Убедитесь что WebSocket проксируется через HTTPS:

```nginx
# В блоке server для порта 443
location /ws {
    proxy_pass http://localhost:8081;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_read_timeout 86400;
}
```

Перезапустить Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Шаг 24: Обновить Coturn для TLS

```bash
# Редактировать конфигурацию Coturn
sudo nano /etc/turnserver.conf

# Раскомментировать и обновить пути к сертификатам:
cert=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/yourdomain.com/privkey.pem

# Дать Coturn доступ к сертификатам
sudo chmod 755 /etc/letsencrypt/live/
sudo chmod 755 /etc/letsencrypt/archive/

# Перезапустить Coturn
sudo systemctl restart coturn
```

### Шаг 25: Автообновление Сертификатов

Certbot автоматически настраивает cron для обновления. Проверить:

```bash
# Тест обновления (dry run)
sudo certbot renew --dry-run

# Просмотр cron задач
sudo systemctl list-timers | grep certbot
```

Для перезапуска Coturn после обновления сертификатов:

```bash
# Создать hook скрипт
sudo nano /etc/letsencrypt/renewal-hooks/deploy/restart-coturn.sh
```

Содержимое:
```bash
#!/bin/bash
systemctl restart coturn
```

Сделать исполняемым:
```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/restart-coturn.sh
```

---

## Автозапуск

### Шаг 26: Настройка PM2 Автозапуска

```bash
# Сохранить текущий список процессов PM2
pm2 save

# Настроить автозапуск при загрузке системы
pm2 startup

# PM2 выведет команду, которую нужно выполнить с sudo
# Скопируйте и выполните эту команду, например:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u username --hp /home/username

# Проверить что автозапуск настроен
sudo systemctl status pm2-username
```

### Шаг 27: Проверка Автозапуска

```bash
# Перезагрузить сервер
sudo reboot

# После перезагрузки, подключиться снова и проверить
pm2 list

# Все процессы должны быть запущены
```

---

## Мониторинг

### Шаг 28: Мониторинг PM2

```bash
# Веб-интерфейс мониторинга (опционально)
pm2 install pm2-logrotate

# Настроить ротацию логов
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

# Мониторинг в терминале
pm2 monit

# Статистика
pm2 describe secure-p2p-server
```

### Шаг 29: Системный Мониторинг

```bash
# Установить htop для мониторинга ресурсов
sudo apt install -y htop

# Запустить
htop

# Проверить использование диска
df -h

# Проверить использование памяти
free -h

# Проверить сетевые соединения
sudo netstat -tulpn | grep LISTEN
```

---

## Обновление Приложения

### Процесс Обновления

```bash
# 1. Перейти в директорию проекта
cd /var/www/secure-p2p-messenger

# 2. Остановить PM2 процессы
pm2 stop secure-p2p-server

# 3. Получить последние изменения
git pull origin main

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

## Резервное Копирование

### Шаг 30: Настройка Автоматического Бэкапа

```bash
# Создать директорию для бэкапов
sudo mkdir -p /var/backups/secure-p2p-messenger
sudo chown $USER:$USER /var/backups/secure-p2p-messenger

# Создать скрипт бэкапа
nano /var/www/secure-p2p-messenger/backup.sh
```

Содержимое скрипта:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/secure-p2p-messenger"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="secure_p2p_messenger"
DB_USER="messenger_user"

# Создать бэкап базы данных
PGPASSWORD="your_db_password" pg_dump -h localhost -U $DB_USER $DB_NAME > "$BACKUP_DIR/db_backup_$DATE.sql"

# Сжать бэкап
gzip "$BACKUP_DIR/db_backup_$DATE.sql"

# Удалить старые бэкапы (старше 7 дней)
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_backup_$DATE.sql.gz"
```

Сделать исполняемым:
```bash
chmod +x /var/www/secure-p2p-messenger/backup.sh
```

Добавить в crontab:
```bash
crontab -e

# Добавить строку (бэкап каждый день в 2:00)
0 2 * * * /var/www/secure-p2p-messenger/backup.sh >> /var/log/backup.log 2>&1
```

---

## Полный Чеклист Развертывания

### ✅ Чеклист

- [ ] Сервер обновлен и настроен firewall
- [ ] Node.js 18.x установлен
- [ ] PM2 установлен глобально
- [ ] PostgreSQL установлен и настроен
- [ ] База данных создана и схема применена
- [ ] Nginx установлен и настроен
- [ ] Coturn установлен и настроен
- [ ] Проект склонирован в /var/www/
- [ ] Зависимости установлены
- [ ] .env файл настроен с правильными значениями
- [ ] JWT_SECRET сгенерирован (openssl rand -base64 64)
- [ ] Приложение собрано (npm run build)
- [ ] PM2 запущен и работает
- [ ] Nginx проксирует запросы
- [ ] SSL сертификаты получены (Let's Encrypt)
- [ ] WSS работает через Nginx
- [ ] Coturn использует SSL сертификаты
- [ ] PM2 автозапуск настроен
- [ ] Автоматический бэкап настроен
- [ ] Мониторинг настроен
- [ ] Приложение доступно по домену

---

## Быстрая Справка Команд

```bash
# PM2
pm2 list                          # Список процессов
pm2 logs                          # Просмотр логов
pm2 monit                         # Мониторинг
pm2 restart secure-p2p-server     # Перезапуск
pm2 stop secure-p2p-server        # Остановка

# Nginx
sudo nginx -t                     # Проверка конфигурации
sudo systemctl restart nginx      # Перезапуск
sudo tail -f /var/log/nginx/error.log  # Логи ошибок

# PostgreSQL
sudo systemctl status postgresql  # Статус
psql -U messenger_user -d secure_p2p_messenger  # Подключение

# Coturn
sudo systemctl status coturn      # Статус
sudo tail -f /var/log/turnserver.log  # Логи

# Системные
htop                              # Мониторинг ресурсов
df -h                             # Использование диска
free -h                           # Использование памяти
sudo ufw status                   # Статус firewall
```

---

## Устранение Неполадок

### PM2 процесс не запускается

```bash
# Проверить логи
pm2 logs secure-p2p-server --err

# Проверить что сборка прошла успешно
ls -la packages/server/dist/

# Попробовать запустить напрямую
cd packages/server
node dist/index.js
```

### WebSocket не подключается

```bash
# Проверить что сервер слушает порт
sudo netstat -tulpn | grep 8081

# Проверить Nginx конфигурацию
sudo nginx -t

# Проверить логи Nginx
sudo tail -f /var/log/nginx/error.log

# Проверить firewall
sudo ufw status
```

### База данных не подключается

```bash
# Проверить что PostgreSQL запущен
sudo systemctl status postgresql

# Проверить подключение
psql -h localhost -U messenger_user -d secure_p2p_messenger

# Проверить логи PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### TURN сервер не работает

```bash
# Проверить статус
sudo systemctl status coturn

# Проверить логи
sudo tail -f /var/log/turnserver.log

# Тест TURN
turnutils_uclient -v -u turnuser -w turnpassword YOUR_SERVER_IP
```

---

## Поддержка

Если возникли проблемы:
1. Проверьте логи: `pm2 logs`, `sudo tail -f /var/log/nginx/error.log`
2. Проверьте статус сервисов: `pm2 list`, `sudo systemctl status nginx`
3. Откройте issue на GitHub
4. Свяжитесь с поддержкой

---

Готово! Ваше приложение развернуто и работает с PM2.

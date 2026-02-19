# Быстрая Шпаргалка Команд
# Развертывание без Docker с PM2

## Полная Последовательность Команд

### 1. Подготовка Сервера (5 минут)

```bash
# Подключиться к серверу
ssh user@your-server-ip

# Обновить систему
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential ufw

# Настроить firewall
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw allow 8081/tcp && sudo ufw allow 3478/tcp && sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp && sudo ufw allow 5349/udp && sudo ufw allow 49152:49252/udp
sudo ufw --force enable
```

### 2. Установка Зависимостей (10 минут)

```bash
# Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# PM2
sudo npm install -g pm2

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql && sudo systemctl enable postgresql

# Nginx
sudo apt install -y nginx
sudo systemctl start nginx && sudo systemctl enable nginx

# Coturn
sudo apt install -y coturn
```

### 3. Настройка PostgreSQL (2 минуты)

```bash
# Создать базу данных
sudo -u postgres psql << EOF
CREATE DATABASE secure_p2p_messenger;
CREATE USER messenger_user WITH ENCRYPTED PASSWORD 'ВАШ_ПАРОЛЬ';
GRANT ALL PRIVILEGES ON DATABASE secure_p2p_messenger TO messenger_user;
\q
EOF
```

### 4. Клонирование и Установка Проекта (5 минут)

```bash
# Клонировать
sudo mkdir -p /var/www && cd /var/www
sudo git clone https://github.com/your-org/secure-p2p-messenger.git
cd secure-p2p-messenger
sudo chown -R $USER:$USER /var/www/secure-p2p-messenger

# Установить зависимости
npm install

# Создать .env
nano packages/server/.env
```

**Содержимое .env:**
```env
NODE_ENV=production
WS_PORT=8081
DB_HOST=localhost
DB_NAME=secure_p2p_messenger
DB_USER=messenger_user
DB_PASSWORD=ВАШ_ПАРОЛЬ
JWT_SECRET=$(openssl rand -base64 64)
CORS_ORIGIN=https://yourdomain.com
```

### 5. Инициализация БД и Сборка (3 минуты)

```bash
# Инициализировать БД
PGPASSWORD='ВАШ_ПАРОЛЬ' psql -h localhost -U messenger_user -d secure_p2p_messenger -f packages/server/src/db/schema.sql

# Собрать приложение
npm run build --workspace=@secure-p2p-messenger/server
npm run build --workspace=@secure-p2p-messenger/client

# Создать директорию логов
mkdir -p logs
```

### 6. Настройка Coturn (3 минуты)

```bash
# Создать конфигурацию
sudo tee /etc/turnserver.conf > /dev/null << EOF
listening-ip=0.0.0.0
external-ip=ВАШ_ПУБЛИЧНЫЙ_IP
listening-port=3478
tls-listening-port=5349
min-port=49152
max-port=49252
verbose
fingerprint
lt-cred-mech
realm=secure-p2p-messenger
user=turnuser:СИЛЬНЫЙ_ПАРОЛЬ
no-multicast-peers
no-loopback-peers
server-name=coturn
log-file=/var/log/turnserver.log
no-cli
EOF

# Включить Coturn
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
sudo systemctl start coturn && sudo systemctl enable coturn
```

### 7. Настройка Nginx (3 минуты)

```bash
# Создать конфигурацию
sudo tee /etc/nginx/sites-available/secure-p2p-messenger > /dev/null << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    root /var/www/secure-p2p-messenger/packages/client/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /ws {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
EOF

# Активировать
sudo ln -s /etc/nginx/sites-available/secure-p2p-messenger /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

### 8. Запуск с PM2 (2 минуты)

```bash
cd /var/www/secure-p2p-messenger

# Запустить
pm2 start ecosystem.config.js --env production

# Сохранить и настроить автозапуск
pm2 save
pm2 startup
# Выполните команду которую выведет PM2

# Проверить
pm2 list
pm2 logs
```

### 9. SSL Сертификаты (5 минут)

```bash
# Установить Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получить сертификат
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Обновить Coturn для SSL
sudo tee -a /etc/turnserver.conf > /dev/null << EOF
cert=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/yourdomain.com/privkey.pem
EOF

sudo chmod 755 /etc/letsencrypt/live/ /etc/letsencrypt/archive/
sudo systemctl restart coturn
```

### 10. Автобэкап (2 минуты)

```bash
# Создать скрипт
sudo mkdir -p /var/backups/secure-p2p-messenger
cat > /var/www/secure-p2p-messenger/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/secure-p2p-messenger"
DATE=$(date +%Y%m%d_%H%M%S)
PGPASSWORD="ВАШ_ПАРОЛЬ" pg_dump -h localhost -U messenger_user secure_p2p_messenger | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
EOF

chmod +x /var/www/secure-p2p-messenger/backup.sh

# Добавить в crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/secure-p2p-messenger/backup.sh") | crontab -
```

---

## Проверка Установки

```bash
# Статус всех сервисов
pm2 list
sudo systemctl status nginx postgresql coturn --no-pager

# Проверка портов
sudo netstat -tulpn | grep -E '80|443|8081|3478|5349'

# Логи
pm2 logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/turnserver.log
```

---

## Ежедневные Команды

```bash
# Просмотр логов
pm2 logs

# Мониторинг
pm2 monit

# Перезапуск
pm2 restart secure-p2p-server

# Обновление приложения
cd /var/www/secure-p2p-messenger
git pull
npm install
npm run build --workspace=@secure-p2p-messenger/server
npm run build --workspace=@secure-p2p-messenger/client
pm2 restart secure-p2p-server

# Бэкап вручную
/var/www/secure-p2p-messenger/backup.sh

# Проверка SSL
sudo certbot renew --dry-run
```

---

## Устранение Проблем

```bash
# PM2 не запускается
pm2 logs --err
pm2 delete all
pm2 start ecosystem.config.js --env production

# Nginx ошибки
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
sudo systemctl restart nginx

# База данных
sudo systemctl status postgresql
PGPASSWORD='пароль' psql -h localhost -U messenger_user -d secure_p2p_messenger

# Coturn
sudo systemctl status coturn
sudo tail -f /var/log/turnserver.log
turnutils_uclient -v -u turnuser -w пароль ВАШ_IP
```

---

## Полезные Алиасы

Добавьте в `~/.bashrc`:

```bash
alias pm2-logs='pm2 logs secure-p2p-server'
alias pm2-restart='pm2 restart secure-p2p-server'
alias pm2-status='pm2 list'
alias nginx-reload='sudo nginx -t && sudo systemctl reload nginx'
alias app-update='cd /var/www/secure-p2p-messenger && git pull && npm install && npm run build --workspace=@secure-p2p-messenger/server && npm run build --workspace=@secure-p2p-messenger/client && pm2 restart secure-p2p-server'
```

Применить: `source ~/.bashrc`

---

## Время Развертывания

- **Подготовка сервера**: 5 минут
- **Установка зависимостей**: 10 минут
- **Настройка БД**: 2 минуты
- **Клонирование и установка**: 5 минут
- **Сборка**: 3 минуты
- **Настройка Coturn**: 3 минуты
- **Настройка Nginx**: 3 минуты
- **Запуск PM2**: 2 минуты
- **SSL**: 5 минут
- **Автобэкап**: 2 минуты

**Общее время: ~40 минут**

---

## Контакты

- Полная документация: [PM2_DEPLOYMENT.md](PM2_DEPLOYMENT.md)
- Docker версия: [DEPLOYMENT.md](../DEPLOYMENT.md)
- GitHub: https://github.com/your-org/secure-p2p-messenger

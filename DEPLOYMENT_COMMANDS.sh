#!/bin/bash
# Полный список команд для развертывания Secure P2P Messenger на сервере
# Выполняйте команды последовательно

echo "=== РАЗВЕРТЫВАНИЕ SECURE P2P MESSENGER ==="
echo ""

# ============================================
# 1. ПОДГОТОВКА СЕРВЕРА
# ============================================
echo "1. Обновление системы..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential

# ============================================
# 2. НАСТРОЙКА FIREWALL
# ============================================
echo "2. Настройка firewall..."
sudo apt install -y ufw
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8081/tcp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:49252/udp
sudo ufw --force enable

# ============================================
# 3. УСТАНОВКА NODE.JS
# ============================================
echo "3. Установка Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version

# ============================================
# 4. УСТАНОВКА PM2
# ============================================
echo "4. Установка PM2..."
sudo npm install -g pm2
pm2 --version

# ============================================
# 5. УСТАНОВКА POSTGRESQL
# ============================================
echo "5. Установка PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# ============================================
# 6. УСТАНОВКА NGINX
# ============================================
echo "6. Установка Nginx..."
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# ============================================
# 7. УСТАНОВКА COTURN
# ============================================
echo "7. Установка Coturn..."
sudo apt install -y coturn
sudo systemctl enable coturn

# ============================================
# 8. НАСТРОЙКА POSTGRESQL
# ============================================
echo "8. Настройка PostgreSQL..."
echo "Выполните следующие команды в psql:"
echo "sudo -u postgres psql"
echo "CREATE DATABASE secure_p2p_messenger;"
echo "CREATE USER messenger_user WITH ENCRYPTED PASSWORD 'your_password';"
echo "GRANT ALL PRIVILEGES ON DATABASE secure_p2p_messenger TO messenger_user;"
echo "\\q"
read -p "Нажмите Enter после выполнения команд в psql..."

# ============================================
# 9. КЛОНИРОВАНИЕ ПРОЕКТА
# ============================================
echo "9. Клонирование проекта..."
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/your-org/secure-p2p-messenger.git
cd secure-p2p-messenger
sudo chown -R $USER:$USER /var/www/secure-p2p-messenger

# ============================================
# 10. УСТАНОВКА ЗАВИСИМОСТЕЙ
# ============================================
echo "10. Установка зависимостей..."
npm install

# ============================================
# 11. НАСТРОЙКА .ENV
# ============================================
echo "11. Создание .env файла..."
cat > packages/server/.env << 'EOF'
NODE_ENV=production
PORT=8080
WS_PORT=8081
DB_HOST=localhost
DB_PORT=5432
DB_NAME=secure_p2p_messenger
DB_USER=messenger_user
DB_PASSWORD=CHANGE_THIS
JWT_SECRET=CHANGE_THIS_USE_OPENSSL_RAND
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
EOF

echo "ВАЖНО: Отредактируйте packages/server/.env и замените:"
echo "  - DB_PASSWORD"
echo "  - JWT_SECRET (используйте: openssl rand -base64 64)"
echo "  - CORS_ORIGIN (ваш домен)"
read -p "Нажмите Enter после редактирования .env..."

# ============================================
# 12. ИНИЦИАЛИЗАЦИЯ БД
# ============================================
echo "12. Инициализация базы данных..."
psql -h localhost -U messenger_user -d secure_p2p_messenger -f packages/server/src/db/schema.sql

# ============================================
# 13. СБОРКА ПРИЛОЖЕНИЯ
# ============================================
echo "13. Сборка приложения..."
npm run build --workspace=@secure-p2p-messenger/server
npm run build --workspace=@secure-p2p-messenger/client

# ============================================
# 14. СОЗДАНИЕ ДИРЕКТОРИИ ЛОГОВ
# ============================================
echo "14. Создание директории для логов..."
mkdir -p /var/www/secure-p2p-messenger/logs

# ============================================
# 15. НАСТРОЙКА COTURN
# ============================================
echo "15. Настройка Coturn..."
sudo tee /etc/turnserver.conf > /dev/null << 'EOF'
listening-ip=0.0.0.0
external-ip=YOUR_PUBLIC_IP
listening-port=3478
tls-listening-port=5349
min-port=49152
max-port=49252
verbose
fingerprint
lt-cred-mech
realm=secure-p2p-messenger
user=turnuser:turnpassword
no-multicast-peers
no-loopback-peers
server-name=coturn
log-file=/var/log/turnserver.log
no-cli
EOF

echo "ВАЖНО: Отредактируйте /etc/turnserver.conf:"
echo "  - Замените YOUR_PUBLIC_IP на ваш публичный IP"
echo "  - Измените user=turnuser:turnpassword"
read -p "Нажмите Enter после редактирования..."

sudo nano /etc/default/coturn
echo "Раскомментируйте: TURNSERVER_ENABLED=1"
read -p "Нажмите Enter после редактирования..."

sudo systemctl start coturn

# ============================================
# 16. НАСТРОЙКА NGINX
# ============================================
echo "16. Настройка Nginx..."
sudo tee /etc/nginx/sites-available/secure-p2p-messenger > /dev/null << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    root /var/www/secure-p2p-messenger/packages/client/dist;
    index index.html;
    
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
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
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    access_log /var/log/nginx/secure-p2p-messenger-access.log;
    error_log /var/log/nginx/secure-p2p-messenger-error.log;
}
EOF

echo "ВАЖНО: Замените yourdomain.com на ваш домен"
read -p "Нажмите Enter для продолжения..."

sudo ln -s /etc/nginx/sites-available/secure-p2p-messenger /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# ============================================
# 17. ЗАПУСК PM2
# ============================================
echo "17. Запуск сервера через PM2..."
cd /var/www/secure-p2p-messenger
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

echo "Выполните команду которую вывел PM2 (с sudo)"
read -p "Нажмите Enter после выполнения команды..."

# ============================================
# 18. УСТАНОВКА SSL
# ============================================
echo "18. Установка SSL сертификатов..."
sudo apt install -y certbot python3-certbot-nginx
echo "Выполните: sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com"
read -p "Нажмите Enter после получения сертификатов..."

# Обновить Coturn для использования SSL
echo "Добавьте в /etc/turnserver.conf:"
echo "cert=/etc/letsencrypt/live/yourdomain.com/fullchain.pem"
echo "pkey=/etc/letsencrypt/live/yourdomain.com/privkey.pem"
read -p "Нажмите Enter после редактирования..."

sudo chmod 755 /etc/letsencrypt/live/
sudo chmod 755 /etc/letsencrypt/archive/
sudo systemctl restart coturn

# ============================================
# 19. НАСТРОЙКА АВТОБЭКАПА
# ============================================
echo "19. Настройка автоматического бэкапа..."
sudo mkdir -p /var/backups/secure-p2p-messenger
sudo chown $USER:$USER /var/backups/secure-p2p-messenger

cat > /var/www/secure-p2p-messenger/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/secure-p2p-messenger"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="secure_p2p_messenger"
DB_USER="messenger_user"
PGPASSWORD="your_db_password" pg_dump -h localhost -U $DB_USER $DB_NAME > "$BACKUP_DIR/db_backup_$DATE.sql"
gzip "$BACKUP_DIR/db_backup_$DATE.sql"
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +7 -delete
echo "Backup completed: db_backup_$DATE.sql.gz"
EOF

chmod +x /var/www/secure-p2p-messenger/backup.sh

echo "Добавьте в crontab (crontab -e):"
echo "0 2 * * * /var/www/secure-p2p-messenger/backup.sh >> /var/log/backup.log 2>&1"

# ============================================
# 20. ПРОВЕРКА
# ============================================
echo ""
echo "=== ПРОВЕРКА УСТАНОВКИ ==="
echo ""
echo "PM2 процессы:"
pm2 list
echo ""
echo "Nginx статус:"
sudo systemctl status nginx --no-pager
echo ""
echo "PostgreSQL статус:"
sudo systemctl status postgresql --no-pager
echo ""
echo "Coturn статус:"
sudo systemctl status coturn --no-pager
echo ""
echo "Firewall статус:"
sudo ufw status
echo ""
echo "=== РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО ==="
echo ""
echo "Откройте в браузере: https://yourdomain.com"
echo ""
echo "Полезные команды:"
echo "  pm2 logs              - Просмотр логов"
echo "  pm2 monit             - Мониторинг"
echo "  pm2 restart all       - Перезапуск"
echo "  sudo nginx -t         - Проверка Nginx"
echo "  sudo systemctl status - Статус сервисов"

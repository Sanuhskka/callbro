#!/bin/bash
# Полный скрипт развертывания на Ubuntu 24 с PM2 и Ngrok
# Secure P2P Messenger
# Выполняйте команды последовательно или запустите весь скрипт

set -e  # Остановить при ошибке

echo "🚀 Развертывание Secure P2P Messenger на Ubuntu 24"
echo "Домен: ebony-unacquainted-myra.ngrok-free.dev"
echo ""

# ============================================
# 1. ОБНОВЛЕНИЕ СИСТЕМЫ
# ============================================
echo "📦 Шаг 1/18: Обновление системы..."
apt update && apt upgrade -y
apt install -y curl wget git build-essential

# ============================================
# 2. УСТАНОВКА NODE.JS 18.x
# ============================================
echo "📦 Шаг 2/18: Установка Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
node --version
npm --version

# ============================================
# 3. УСТАНОВКА PM2
# ============================================
echo "📦 Шаг 3/18: Установка PM2..."
npm install -g pm2
pm2 --version

# ============================================
# 4. УСТАНОВКА POSTGRESQL
# ============================================
echo "📦 Шаг 4/18: Установка PostgreSQL..."
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# ============================================
# 5. НАСТРОЙКА POSTGRESQL
# ============================================
echo "📦 Шаг 5/18: Настройка PostgreSQL..."
sudo -u postgres psql << EOF
CREATE DATABASE secure_p2p_messenger;
CREATE USER messenger_user WITH ENCRYPTED PASSWORD 'messenger_password_123';
GRANT ALL PRIVILEGES ON DATABASE secure_p2p_messenger TO messenger_user;
\c secure_p2p_messenger
GRANT ALL ON SCHEMA public TO messenger_user;
GRANT CREATE ON SCHEMA public TO messenger_user;
\q
EOF

# ============================================
# 6. УСТАНОВКА NGINX
# ============================================
echo "📦 Шаг 6/18: Установка Nginx..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx

# ============================================
# 7. УСТАНОВКА NGROK
# ============================================
echo "📦 Шаг 7/18: Установка Ngrok..."
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  tee /etc/apt/sources.list.d/ngrok.list
apt update
apt install -y ngrok
ngrok version
ngrok config add-authtoken 37TZ9geaKvmc7yYmhYys7Z2bLu2_5vrNmMNJ7bDGCMnCe9YUC

# ============================================
# 8. КЛОНИРОВАНИЕ ПРОЕКТА
# ============================================
echo "📦 Шаг 8/18: Клонирование проекта..."
cd /root
if [ -d "secure-p2p-messenger" ]; then
    echo "Директория уже существует, пропускаем клонирование"
    cd secure-p2p-messenger
else
    git clone https://github.com/Sanuhskka/callbro.git secure-p2p-messenger
    cd secure-p2p-messenger
fi

# ============================================
# 9. УСТАНОВКА ЗАВИСИМОСТЕЙ
# ============================================
echo "📦 Шаг 9/18: Установка зависимостей..."
npm install

# Установить TypeScript глобально (для сборки)
npm install -g typescript

# Дать права на выполнение для локальных бинарников
chmod -R +x node_modules/.bin/ 2>/dev/null || true
chmod -R +x packages/server/node_modules/.bin/ 2>/dev/null || true
chmod -R +x packages/client/node_modules/.bin/ 2>/dev/null || true

# ============================================
# 10. НАСТРОЙКА .ENV
# ============================================
echo "📦 Шаг 10/18: Настройка переменных окружения..."
cat > /root/secure-p2p-messenger/packages/server/.env << 'EOF'
NODE_ENV=production
WS_PORT=8081
DB_HOST=localhost
DB_PORT=5432
DB_NAME=secure_p2p_messenger
DB_USER=messenger_user
DB_PASSWORD=messenger_password_123
JWT_SECRET=ngrok-production-secret-change-this
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://ebony-unacquainted-myra.ngrok-free.dev
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
EOF

cat > /root/secure-p2p-messenger/packages/client/.env << 'EOF'
VITE_WS_URL=wss://ebony-unacquainted-myra.ngrok-free.dev/ws
VITE_TURN_SERVER=turn:stun.l.google.com:19302
VITE_STUN_SERVER=stun:stun.l.google.com:19302
VITE_APP_NAME=Secure P2P Messenger
VITE_MAX_FILE_SIZE=52428800
EOF

# ============================================
# 11. ИНИЦИАЛИЗАЦИЯ БД
# ============================================
echo "📦 Шаг 11/18: Инициализация базы данных..."
PGPASSWORD='messenger_password_123' psql -h localhost -U messenger_user -d secure_p2p_messenger -f /root/secure-p2p-messenger/packages/server/src/db/schema.sql

# ============================================
# 12. СБОРКА ПРИЛОЖЕНИЯ
# ============================================
echo "📦 Шаг 12/18: Сборка приложения..."
npm run build --workspace=@secure-p2p-messenger/server
npm run build --workspace=@secure-p2p-messenger/client

# ============================================
# 13. СОЗДАНИЕ ДИРЕКТОРИИ ЛОГОВ
# ============================================
echo "📦 Шаг 13/18: Создание директории логов..."
mkdir -p /root/secure-p2p-messenger/logs

# ============================================
# 14. НАСТРОЙКА NGINX
# ============================================
echo "📦 Шаг 14/18: Настройка Nginx..."
cat > /etc/nginx/sites-available/secure-p2p-messenger << 'EOF'
server {
    listen 80;
    server_name localhost;
    root /root/secure-p2p-messenger/packages/client/dist;
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

ln -sf /etc/nginx/sites-available/secure-p2p-messenger /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# ============================================
# 15. ЗАПУСК PM2
# ============================================
echo "📦 Шаг 15/18: Запуск сервера через PM2..."
cd /root/secure-p2p-messenger
pm2 start ecosystem.config.js --env production
pm2 save

# ============================================
# 16. НАСТРОЙКА АВТОЗАПУСКА PM2
# ============================================
echo "📦 Шаг 16/18: Настройка автозапуска PM2..."
pm2 startup
echo "⚠️  Выполните команду которую вывел PM2 выше!"
echo "Нажмите Enter для продолжения..."
read

# ============================================
# 17. ЗАПУСК NGROK
# ============================================
echo "📦 Шаг 17/18: Настройка Ngrok..."
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

pm2 start ecosystem-ngrok.config.js
pm2 save

# ============================================
# 18. ПРОВЕРКА
# ============================================
echo "📦 Шаг 18/18: Проверка установки..."
echo ""
echo "=== PM2 Процессы ==="
pm2 status
echo ""
echo "=== Nginx Статус ==="
systemctl status nginx --no-pager
echo ""
echo "=== PostgreSQL Статус ==="
systemctl status postgresql --no-pager
echo ""
echo "=== Проверка локального доступа ==="
curl -s http://localhost | head -n 5
echo ""
echo "✅ РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО!"
echo ""
echo "🌐 Ваше приложение доступно по адресу:"
echo "   https://ebony-unacquainted-myra.ngrok-free.dev"
echo ""
echo "📊 Полезные команды:"
echo "   pm2 status          - Статус процессов"
echo "   pm2 logs            - Просмотр логов"
echo "   pm2 monit           - Мониторинг"
echo "   pm2 restart all     - Перезапуск"
echo ""
echo "📚 Полная документация:"
echo "   /root/secure-p2p-messenger/UBUNTU_NGROK_PM2_DEPLOY.md"
echo ""

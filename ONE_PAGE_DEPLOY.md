# 📄 Развертывание на Одной Странице
# Secure P2P Messenger

**Выберите свой путь и следуйте командам ниже ⬇️**

---

## 🐳 Путь 1: Docker (Рекомендуется) - 20 минут

```bash
# 1. Подключиться к серверу
ssh user@your-server

# 2. Установить Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Выйти и войти снова

# 3. Установить Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. Клонировать проект
git clone https://github.com/your-org/secure-p2p-messenger.git
cd secure-p2p-messenger

# 5. Настроить .env
cp .env.production .env
nano .env
# Изменить: JWT_SECRET, DB_PASSWORD, EXTERNAL_IP, домены

# 6. Запустить
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 7. SSL (замените yourdomain.com)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com

# ✅ Готово! Откройте https://yourdomain.com
```

**Команды управления:**
```bash
docker-compose logs -f              # Логи
docker-compose ps                   # Статус
docker-compose restart              # Перезапуск
docker-compose down                 # Остановка
```

---

## ⚡ Путь 2: PM2 (Без Docker) - 40 минут

```bash
# 1. Подключиться к серверу
ssh user@your-server

# 2. Установить все зависимости
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt update && sudo apt install -y nodejs postgresql nginx coturn build-essential
sudo npm install -g pm2

# 3. Настроить firewall
sudo ufw allow 22,80,443,8081,3478,5349/tcp
sudo ufw allow 3478,5349,49152:49252/udp
sudo ufw --force enable

# 4. Создать базу данных
sudo -u postgres psql << 'EOF'
CREATE DATABASE secure_p2p_messenger;
CREATE USER messenger_user WITH PASSWORD 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE secure_p2p_messenger TO messenger_user;
\q
EOF

# 5. Клонировать и собрать
cd /var/www
sudo git clone https://github.com/your-org/secure-p2p-messenger.git
cd secure-p2p-messenger
sudo chown -R $USER:$USER .
npm install
npm run build --workspace=@secure-p2p-messenger/server
npm run build --workspace=@secure-p2p-messenger/client
mkdir logs

# 6. Настроить .env
cat > packages/server/.env << 'EOF'
NODE_ENV=production
WS_PORT=8081
DB_HOST=localhost
DB_NAME=secure_p2p_messenger
DB_USER=messenger_user
DB_PASSWORD=STRONG_PASSWORD
JWT_SECRET=$(openssl rand -base64 64)
CORS_ORIGIN=https://yourdomain.com
EOF

# 7. Инициализировать БД
PGPASSWORD='STRONG_PASSWORD' psql -h localhost -U messenger_user -d secure_p2p_messenger -f packages/server/src/db/schema.sql

# 8. Настроить Coturn
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
user=turnuser:STRONG_PASSWORD
no-multicast-peers
no-loopback-peers
log-file=/var/log/turnserver.log
no-cli
EOF
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
sudo systemctl start coturn

# 9. Настроить Nginx
sudo tee /etc/nginx/sites-available/secure-p2p-messenger > /dev/null << 'EOF'
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/secure-p2p-messenger/packages/client/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
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
sudo ln -s /etc/nginx/sites-available/secure-p2p-messenger /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 10. Запустить PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
# Выполните команду которую выведет PM2

# 11. SSL
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
sudo tee -a /etc/turnserver.conf > /dev/null << 'EOF'
cert=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/yourdomain.com/privkey.pem
EOF
sudo chmod 755 /etc/letsencrypt/{live,archive}
sudo systemctl restart coturn

# ✅ Готово! Откройте https://yourdomain.com
```

**Команды управления:**
```bash
pm2 logs                            # Логи
pm2 list                            # Статус
pm2 restart all                     # Перезапуск
pm2 stop all                        # Остановка
```

---

## 🔧 Обновление Приложения

### Docker
```bash
cd /path/to/secure-p2p-messenger
git pull
docker-compose build
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### PM2
```bash
cd /var/www/secure-p2p-messenger
git pull
npm install
npm run build --workspace=@secure-p2p-messenger/server
npm run build --workspace=@secure-p2p-messenger/client
pm2 restart all
```

---

## 🔍 Проверка Работы

```bash
# Проверить статус сервисов
# Docker:
docker-compose ps

# PM2:
pm2 list
sudo systemctl status nginx postgresql coturn

# Проверить порты
sudo netstat -tulpn | grep -E '80|443|8081|3478'

# Проверить логи
# Docker:
docker-compose logs -f server

# PM2:
pm2 logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🆘 Быстрое Устранение Проблем

### Сервер не запускается
```bash
# Docker:
docker-compose logs server

# PM2:
pm2 logs --err
pm2 restart all
```

### WebSocket не подключается
```bash
# Проверить порт
sudo netstat -tulpn | grep 8081

# Проверить Nginx
sudo nginx -t
sudo systemctl restart nginx

# Проверить firewall
sudo ufw status
```

### База данных не работает
```bash
# Docker:
docker-compose logs postgres

# PM2:
sudo systemctl status postgresql
PGPASSWORD='password' psql -h localhost -U messenger_user -d secure_p2p_messenger
```

### TURN не работает
```bash
sudo systemctl status coturn
sudo tail -f /var/log/turnserver.log

# Тест TURN
turnutils_uclient -v -u turnuser -w password YOUR_IP
```

---

## 📚 Полная Документация

- **Docker**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **PM2**: [docs/PM2_DEPLOYMENT.md](docs/PM2_DEPLOYMENT.md)
- **Сравнение**: [docs/DOCKER_VS_PM2.md](docs/DOCKER_VS_PM2.md)
- **SSL**: [docs/SSL_SETUP.md](docs/SSL_SETUP.md)
- **Команды**: [docs/QUICK_COMMANDS.md](docs/QUICK_COMMANDS.md)

---

## ⚠️ Важные Замены

Перед запуском замените:

- `your-server` → IP адрес вашего сервера
- `yourdomain.com` → ваш домен
- `YOUR_PUBLIC_IP` → публичный IP сервера
- `STRONG_PASSWORD` → сильные пароли
- `your-org` → ваша организация на GitHub
- `JWT_SECRET` → результат `openssl rand -base64 64`

---

## 🎯 Что Дальше?

После развертывания:

1. ✅ Проверить работу: https://yourdomain.com
2. ✅ Настроить автобэкап (см. документацию)
3. ✅ Настроить мониторинг
4. ✅ Проверить SSL рейтинг: https://www.ssllabs.com/ssltest/
5. ✅ Протестировать P2P соединение

---

**Готово! Ваш мессенджер работает! 🎉**

Нужна помощь? → [GitHub Issues](https://github.com/your-org/secure-p2p-messenger/issues)

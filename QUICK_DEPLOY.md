# 🚀 Быстрое Развертывание на Сервере
# Secure P2P Messenger (без Docker, с PM2)

**Время: ~40 минут** | **Сложность: Средняя**

## Предварительные Требования

- ✅ Сервер Ubuntu 20.04+ / Debian 11+
- ✅ Root или sudo доступ
- ✅ Доменное имя (для SSL)
- ✅ Публичный IP адрес

---

## Вариант 1: Автоматический Скрипт

```bash
# Скачать и запустить скрипт
wget https://raw.githubusercontent.com/your-org/secure-p2p-messenger/main/DEPLOYMENT_COMMANDS.sh
chmod +x DEPLOYMENT_COMMANDS.sh
./DEPLOYMENT_COMMANDS.sh
```

**Следуйте инструкциям скрипта!**

---

## Вариант 2: Ручная Установка (Копируй-Вставляй)

### Шаг 1: Подготовка (5 мин)

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential ufw

# Firewall
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw allow 8081/tcp && sudo ufw allow 3478/tcp && sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp && sudo ufw allow 5349/udp && sudo ufw allow 49152:49252/udp
sudo ufw --force enable
```

### Шаг 2: Установка (10 мин)

```bash
# Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# PM2, PostgreSQL, Nginx, Coturn
sudo npm install -g pm2
sudo apt install -y postgresql postgresql-contrib nginx coturn
sudo systemctl start postgresql nginx && sudo systemctl enable postgresql nginx
```

### Шаг 3: База Данных (2 мин)

```bash
sudo -u postgres psql << 'EOF'
CREATE DATABASE secure_p2p_messenger;
CREATE USER messenger_user WITH ENCRYPTED PASSWORD 'ИЗМЕНИТЕ_ПАРОЛЬ';
GRANT ALL PRIVILEGES ON DATABASE secure_p2p_messenger TO messenger_user;
\q
EOF
```

### Шаг 4: Проект (8 мин)

```bash
# Клонировать
cd /var/www
sudo git clone https://github.com/your-org/secure-p2p-messenger.git
cd secure-p2p-messenger
sudo chown -R $USER:$USER .

# Установить и собрать
npm install
npm run build --workspace=@secure-p2p-messenger/server
npm run build --workspace=@secure-p2p-messenger/client
mkdir -p logs
```

### Шаг 5: Конфигурация (5 мин)

**Создать packages/server/.env:**
```bash
cat > packages/server/.env << 'EOF'
NODE_ENV=production
WS_PORT=8081
DB_HOST=localhost
DB_NAME=secure_p2p_messenger
DB_USER=messenger_user
DB_PASSWORD=ИЗМЕНИТЕ_ПАРОЛЬ
JWT_SECRET=ИЗМЕНИТЕ_ИСПОЛЬЗУЙТЕ_openssl_rand_base64_64
CORS_ORIGIN=https://yourdomain.com
EOF
```

**Инициализировать БД:**
```bash
PGPASSWORD='ВАШ_ПАРОЛЬ' psql -h localhost -U messenger_user -d secure_p2p_messenger -f packages/server/src/db/schema.sql
```

### Шаг 6: Coturn (3 мин)

```bash
sudo tee /etc/turnserver.conf > /dev/null << 'EOF'
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
user=turnuser:ИЗМЕНИТЕ_ПАРОЛЬ
no-multicast-peers
no-loopback-peers
server-name=coturn
log-file=/var/log/turnserver.log
no-cli
EOF

sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
sudo systemctl start coturn && sudo systemctl enable coturn
```

### Шаг 7: Nginx (3 мин)

```bash
sudo tee /etc/nginx/sites-available/secure-p2p-messenger > /dev/null << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
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
```

### Шаг 8: PM2 (2 мин)

```bash
cd /var/www/secure-p2p-messenger
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
# Выполните команду которую выведет PM2
```

### Шаг 9: SSL (5 мин)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Обновить Coturn
sudo tee -a /etc/turnserver.conf > /dev/null << 'EOF'
cert=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/yourdomain.com/privkey.pem
EOF

sudo chmod 755 /etc/letsencrypt/live/ /etc/letsencrypt/archive/
sudo systemctl restart coturn
```

### Шаг 10: Автобэкап (2 мин)

```bash
sudo mkdir -p /var/backups/secure-p2p-messenger
cat > /var/www/secure-p2p-messenger/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/secure-p2p-messenger"
DATE=$(date +%Y%m%d_%H%M%S)
PGPASSWORD="ВАШ_ПАРОЛЬ" pg_dump -h localhost -U messenger_user secure_p2p_messenger | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
EOF

chmod +x /var/www/secure-p2p-messenger/backup.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/secure-p2p-messenger/backup.sh") | crontab -
```

---

## ✅ Проверка

```bash
# Статус
pm2 list
sudo systemctl status nginx postgresql coturn --no-pager

# Логи
pm2 logs
sudo tail -f /var/log/nginx/error.log

# Открыть в браузере
https://yourdomain.com
```

---

## 🔧 Ежедневные Команды

```bash
pm2 logs                    # Логи
pm2 monit                   # Мониторинг
pm2 restart all             # Перезапуск

# Обновление
cd /var/www/secure-p2p-messenger
git pull
npm install
npm run build --workspace=@secure-p2p-messenger/server
npm run build --workspace=@secure-p2p-messenger/client
pm2 restart all
```

---

## 📚 Полная Документация

- **Детальное руководство**: [docs/PM2_DEPLOYMENT.md](docs/PM2_DEPLOYMENT.md)
- **Все команды**: [docs/QUICK_COMMANDS.md](docs/QUICK_COMMANDS.md)
- **SSL настройка**: [docs/SSL_SETUP.md](docs/SSL_SETUP.md)
- **Docker версия**: [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🆘 Помощь

**Проблемы?**
1. Проверьте логи: `pm2 logs`
2. Проверьте статус: `pm2 list`
3. См. [docs/PM2_DEPLOYMENT.md](docs/PM2_DEPLOYMENT.md) раздел "Устранение Неполадок"
4. GitHub Issues: https://github.com/your-org/secure-p2p-messenger/issues

---

## 🎯 Что Дальше?

После развертывания:
- [ ] Настроить мониторинг (PM2 Plus, Grafana)
- [ ] Настроить алерты
- [ ] Проверить бэкапы
- [ ] Настроить CDN для статики
- [ ] Провести нагрузочное тестирование

---

**Готово! Ваш мессенджер работает! 🎉**

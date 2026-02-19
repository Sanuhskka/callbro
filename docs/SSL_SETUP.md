# Настройка SSL/TLS Сертификатов
# Secure P2P Messenger

Это руководство описывает процесс настройки SSL/TLS сертификатов для безопасного HTTPS/WSS соединения.

## Содержание

1. [Почему SSL Важен](#почему-ssl-важен)
2. [Let's Encrypt (Рекомендуется)](#lets-encrypt-рекомендуется)
3. [Самоподписанные Сертификаты](#самоподписанные-сертификаты)
4. [Коммерческие Сертификаты](#коммерческие-сертификаты)
5. [Настройка Nginx](#настройка-nginx)
6. [Настройка Coturn](#настройка-coturn)
7. [Автоматическое Обновление](#автоматическое-обновление)

---

## Почему SSL Важен

Для Secure P2P Messenger SSL/TLS критически важен:

1. **WebSocket Secure (WSS)**: Браузеры требуют WSS для WebRTC на HTTPS сайтах
2. **Шифрование трафика**: Защита сигнальных сообщений
3. **Доверие пользователей**: Зеленый замок в браузере
4. **TURN over TLS**: Безопасная ретрансляция медиа

---

## Let's Encrypt (Рекомендуется)

Let's Encrypt предоставляет бесплатные SSL сертификаты с автоматическим обновлением.

### Требования

- Доменное имя, указывающее на ваш сервер
- Порты 80 и 443 открыты
- Root доступ к серверу

### Установка Certbot

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install certbot
```

**CentOS/RHEL**:
```bash
sudo yum install certbot
```

### Получение Сертификата

#### Метод 1: Standalone (Рекомендуется для первой установки)

```bash
# Остановить nginx если запущен
docker-compose stop client

# Получить сертификат
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email

# Запустить nginx
docker-compose start client
```

#### Метод 2: Webroot (Для работающего сервера)

```bash
# Создать директорию для challenge
mkdir -p /var/www/certbot

# Получить сертификат
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email your-email@example.com \
  --agree-tos
```

### Расположение Сертификатов

Сертификаты будут сохранены в:
```
/etc/letsencrypt/live/yourdomain.com/fullchain.pem  # Сертификат
/etc/letsencrypt/live/yourdomain.com/privkey.pem    # Приватный ключ
/etc/letsencrypt/live/yourdomain.com/chain.pem      # Цепочка
/etc/letsencrypt/live/yourdomain.com/cert.pem       # Только сертификат
```

### Настройка Docker Compose

Обновить `docker-compose.yml`:

```yaml
services:
  client:
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - ./packages/client/nginx-ssl.conf:/etc/nginx/conf.d/default.conf
    ports:
      - "80:80"
      - "443:443"
```

### Создать Nginx SSL Конфигурацию

Создать `packages/client/nginx-ssl.conf`:

```nginx
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/yourdomain.com/chain.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
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
}
```

### Перезапустить Сервисы

```bash
docker-compose down
docker-compose up -d
```

### Проверка SSL

```bash
# Тест SSL соединения
openssl s_client -connect yourdomain.com:443

# Онлайн тест
# https://www.ssllabs.com/ssltest/
```

---

## Самоподписанные Сертификаты

**ТОЛЬКО ДЛЯ РАЗРАБОТКИ И ТЕСТИРОВАНИЯ!**

### Генерация Сертификата

```bash
# Создать директорию
mkdir -p certs

# Генерировать приватный ключ
openssl genrsa -out certs/key.pem 2048

# Генерировать сертификат (действителен 365 дней)
openssl req -new -x509 -key certs/key.pem -out certs/cert.pem -days 365 \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

### Настройка Docker Compose

```yaml
services:
  client:
    volumes:
      - ./certs:/etc/nginx/certs:ro
      - ./packages/client/nginx-ssl-self.conf:/etc/nginx/conf.d/default.conf
```

### Nginx Конфигурация

```nginx
server {
    listen 443 ssl;
    server_name localhost;
    
    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;
    
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Принятие Сертификата в Браузере

1. Откройте `https://localhost`
2. Браузер покажет предупреждение о безопасности
3. Нажмите "Advanced" → "Proceed to localhost"

**ВНИМАНИЕ**: Не используйте самоподписанные сертификаты в production!

---

## Коммерческие Сертификаты

Если вы приобрели сертификат у коммерческого CA (DigiCert, Comodo, etc.):

### Установка

1. **Получите файлы от CA**:
   - `yourdomain.com.crt` - ваш сертификат
   - `yourdomain.com.key` - приватный ключ
   - `ca-bundle.crt` - цепочка сертификатов

2. **Скопируйте на сервер**:
```bash
sudo mkdir -p /etc/ssl/certs/yourdomain
sudo cp yourdomain.com.crt /etc/ssl/certs/yourdomain/
sudo cp yourdomain.com.key /etc/ssl/private/
sudo cp ca-bundle.crt /etc/ssl/certs/yourdomain/
```

3. **Установите права**:
```bash
sudo chmod 644 /etc/ssl/certs/yourdomain/*
sudo chmod 600 /etc/ssl/private/yourdomain.com.key
```

4. **Обновите nginx конфигурацию**:
```nginx
ssl_certificate /etc/ssl/certs/yourdomain/yourdomain.com.crt;
ssl_certificate_key /etc/ssl/private/yourdomain.com.key;
ssl_trusted_certificate /etc/ssl/certs/yourdomain/ca-bundle.crt;
```

---

## Настройка Coturn

Для TURN over TLS (порт 5349):

### Обновить coturn.conf

```conf
# TLS certificates
cert=/etc/coturn/certs/fullchain.pem
pkey=/etc/coturn/certs/privkey.pem

# Enable TLS
tls-listening-port=5349
```

### Обновить docker-compose.yml

```yaml
services:
  coturn:
    volumes:
      - /etc/letsencrypt/live/yourdomain.com:/etc/coturn/certs:ro
```

### Обновить .env

```env
VITE_TURN_SERVER=turns:yourdomain.com:5349
```

---

## Автоматическое Обновление

Let's Encrypt сертификаты действительны 90 дней. Настройте автоматическое обновление:

### Создать Скрипт Обновления

Создать `/opt/renew-certs.sh`:

```bash
#!/bin/bash

# Обновить сертификаты
certbot renew --quiet

# Перезапустить nginx если сертификаты обновлены
if [ $? -eq 0 ]; then
    cd /opt/secure-p2p-messenger
    docker-compose restart client coturn
    echo "Certificates renewed and services restarted"
fi
```

Сделать исполняемым:
```bash
sudo chmod +x /opt/renew-certs.sh
```

### Добавить в Crontab

```bash
sudo crontab -e
```

Добавить строку (проверка каждый день в 2:00):
```
0 2 * * * /opt/renew-certs.sh >> /var/log/cert-renew.log 2>&1
```

### Тест Обновления

```bash
# Dry run (не обновляет реально)
sudo certbot renew --dry-run
```

---

## Проверка Конфигурации

### Тест SSL/TLS

```bash
# Проверить сертификат
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Проверить дату истечения
echo | openssl s_client -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# Проверить цепочку сертификатов
openssl s_client -connect yourdomain.com:443 -showcerts
```

### Онлайн Инструменты

- **SSL Labs**: https://www.ssllabs.com/ssltest/
- **SSL Checker**: https://www.sslshopper.com/ssl-checker.html
- **Security Headers**: https://securityheaders.com/

### Целевой Рейтинг

Стремитесь к рейтингу **A+** на SSL Labs:
- TLS 1.2 и 1.3 только
- Сильные шифры
- HSTS включен
- OCSP stapling
- Безопасные заголовки

---

## Устранение Неполадок

### Ошибка: Certificate verification failed

```bash
# Проверить цепочку сертификатов
openssl verify -CAfile /etc/letsencrypt/live/yourdomain.com/chain.pem \
  /etc/letsencrypt/live/yourdomain.com/cert.pem
```

### Ошибка: Permission denied

```bash
# Проверить права доступа
ls -la /etc/letsencrypt/live/yourdomain.com/

# Исправить права
sudo chmod 755 /etc/letsencrypt/live/
sudo chmod 755 /etc/letsencrypt/archive/
```

### Ошибка: Port 80 already in use

```bash
# Найти процесс
sudo lsof -i :80

# Остановить nginx
docker-compose stop client

# Получить сертификат
sudo certbot certonly --standalone -d yourdomain.com

# Запустить nginx
docker-compose start client
```

### WebSocket не работает через WSS

Проверьте:
1. Nginx проксирует WebSocket соединения
2. Upgrade заголовки настроены
3. Клиент использует `wss://` URL

---

## Дополнительные Ресурсы

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://certbot.eff.org/docs/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [SSL Best Practices](https://github.com/ssllabs/research/wiki/SSL-and-TLS-Deployment-Best-Practices)

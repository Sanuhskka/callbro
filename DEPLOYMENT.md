# Руководство по Развертыванию
# Secure P2P Messenger

Это руководство содержит инструкции по развертыванию Secure P2P Messenger в различных окружениях.

## Содержание

1. [Требования](#требования)
2. [Локальное Развертывание](#локальное-развертывание)
3. [Развертывание на Сервере](#развертывание-на-сервере)
4. [Настройка TURN/STUN Серверов](#настройка-turnstun-серверов)
5. [Настройка SSL Сертификатов](#настройка-ssl-сертификатов)
6. [Мониторинг и Логирование](#мониторинг-и-логирование)
7. [Резервное Копирование](#резервное-копирование)
8. [Устранение Неполадок](#устранение-неполадок)

---

## Требования

### Минимальные Системные Требования

- **CPU**: 2 ядра
- **RAM**: 4 GB
- **Диск**: 20 GB свободного места
- **ОС**: Linux (Ubuntu 20.04+, Debian 11+, CentOS 8+)

### Программное Обеспечение

- Docker 20.10+
- Docker Compose 2.0+
- Git
- OpenSSL (для генерации сертификатов)

### Сетевые Требования

**Открытые Порты**:
- `80/tcp` - HTTP (клиент)
- `443/tcp` - HTTPS (клиент, опционально)
- `8081/tcp` - WebSocket сервер
- `3478/tcp,udp` - STUN/TURN
- `5349/tcp,udp` - TURN TLS
- `49152-49252/udp` - TURN relay ports

---

## Локальное Развертывание

### Быстрый Старт

1. **Клонировать репозиторий**:
```bash
git clone https://github.com/your-org/secure-p2p-messenger.git
cd secure-p2p-messenger
```

2. **Создать файл окружения**:
```bash
cp .env.example .env
```

3. **Запустить все сервисы**:
```bash
docker-compose up -d
```

4. **Проверить статус**:
```bash
docker-compose ps
```

5. **Открыть приложение**:
```
http://localhost
```

### Режим Разработки

Для разработки с hot-reload:

```bash
# Использовать конфигурацию для разработки
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Или запустить локально без Docker
npm install
npm run dev --workspace=@secure-p2p-messenger/client
npm run dev --workspace=@secure-p2p-messenger/server
```

### Остановка Сервисов

```bash
# Остановить все сервисы
docker-compose down

# Остановить и удалить volumes (ВНИМАНИЕ: удалит данные БД)
docker-compose down -v
```

---

## Развертывание на Сервере

### Подготовка Сервера

1. **Обновить систему**:
```bash
sudo apt update && sudo apt upgrade -y
```

2. **Установить Docker**:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

3. **Установить Docker Compose**:
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

4. **Настроить firewall**:
```bash
# UFW (Ubuntu)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8081/tcp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:49252/udp
sudo ufw enable
```

### Production Развертывание

1. **Клонировать репозиторий**:
```bash
cd /opt
sudo git clone https://github.com/your-org/secure-p2p-messenger.git
cd secure-p2p-messenger
```

2. **Настроить переменные окружения**:
```bash
# Скопировать production шаблон
sudo cp .env.production .env

# Отредактировать файл
sudo nano .env
```

**КРИТИЧЕСКИ ВАЖНО**: Обновите следующие значения:
- `JWT_SECRET` - сгенерируйте сильный случайный ключ
- `DB_PASSWORD` - установите надежный пароль
- `EXTERNAL_IP` - укажите публичный IP вашего сервера
- `TURN_PASSWORD` - установите надежный пароль
- `VITE_WS_URL` - укажите ваш домен (wss://yourdomain.com)

3. **Генерация JWT Secret**:
```bash
openssl rand -base64 64
```

4. **Запустить production сервисы**:
```bash
sudo docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

5. **Проверить логи**:
```bash
docker-compose logs -f
```

### Автоматический Запуск при Загрузке

Создать systemd service:

```bash
sudo nano /etc/systemd/system/secure-p2p-messenger.service
```

Содержимое файла:
```ini
[Unit]
Description=Secure P2P Messenger
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/secure-p2p-messenger
ExecStart=/usr/local/bin/docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Активировать service:
```bash
sudo systemctl enable secure-p2p-messenger
sudo systemctl start secure-p2p-messenger
```

---

## Настройка TURN/STUN Серверов

### Базовая Настройка Coturn

Coturn уже включен в docker-compose.yml. Для настройки:

1. **Отредактировать coturn.conf**:
```bash
nano coturn.conf
```

2. **Установить внешний IP**:
```conf
external-ip=YOUR_PUBLIC_IP
```

3. **Настроить учетные данные**:
```conf
user=username:password
realm=secure-p2p-messenger
```

4. **Для production добавить SSL**:
```conf
cert=/etc/coturn/certs/cert.pem
pkey=/etc/coturn/certs/key.pem
```

### Использование Внешних TURN/STUN Серверов

Если вы хотите использовать внешние серверы (например, Twilio, xirsys):

1. **Обновить .env**:
```env
VITE_STUN_SERVER=stun:stun.l.google.com:19302
VITE_TURN_SERVER=turn:your-turn-server.com:3478
TURN_USERNAME=your-username
TURN_PASSWORD=your-password
```

2. **Отключить локальный coturn**:
```bash
# В docker-compose.yml закомментировать сервис coturn
```

### Тестирование TURN/STUN

Проверить работу TURN сервера:

```bash
# Установить утилиты
sudo apt install coturn

# Тест STUN
turnutils_stunclient YOUR_SERVER_IP

# Тест TURN
turnutils_uclient -v -u username -w password YOUR_SERVER_IP
```

Онлайн тест: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

---

## Настройка SSL Сертификатов

### Использование Let's Encrypt (Рекомендуется)

1. **Установить Certbot**:
```bash
sudo apt install certbot
```

2. **Получить сертификат**:
```bash
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

3. **Сертификаты будут сохранены в**:
```
/etc/letsencrypt/live/yourdomain.com/fullchain.pem
/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

4. **Настроить Nginx для HTTPS**:

Создать `packages/client/nginx-ssl.conf`:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

5. **Обновить docker-compose.yml**:
```yaml
client:
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro
    - ./packages/client/nginx-ssl.conf:/etc/nginx/conf.d/default.conf
  ports:
    - "80:80"
    - "443:443"
```

6. **Автоматическое обновление сертификатов**:
```bash
# Добавить в crontab
sudo crontab -e

# Добавить строку
0 0 * * * certbot renew --quiet && docker-compose restart client
```

### Самоподписанные Сертификаты (Только для Тестирования)

```bash
# Создать директорию
mkdir -p certs

# Генерировать сертификат
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

**ВНИМАНИЕ**: Самоподписанные сертификаты не подходят для production!

---

## Мониторинг и Логирование

### Просмотр Логов

```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f server
docker-compose logs -f client
docker-compose logs -f postgres
docker-compose logs -f coturn

# Последние N строк
docker-compose logs --tail=100 server
```

### Мониторинг Ресурсов

```bash
# Использование ресурсов контейнерами
docker stats

# Статус сервисов
docker-compose ps
```

### Настройка Логирования в Production

Добавить в docker-compose.prod.yml:

```yaml
services:
  server:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Интеграция с Внешними Системами

**Prometheus + Grafana**:
```yaml
# Добавить в docker-compose.yml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana
  ports:
    - "3000:3000"
```

---

## Резервное Копирование

### Резервное Копирование Базы Данных

**Ручное резервное копирование**:
```bash
# Создать backup
docker-compose exec postgres pg_dump -U postgres secure_p2p_messenger > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановить из backup
docker-compose exec -T postgres psql -U postgres secure_p2p_messenger < backup_20240101_120000.sql
```

**Автоматическое резервное копирование**:

Создать скрипт `backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql"

# Создать backup
docker-compose exec -T postgres pg_dump -U postgres secure_p2p_messenger > "$BACKUP_FILE"

# Сжать
gzip "$BACKUP_FILE"

# Удалить старые backups (старше 7 дней)
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

Добавить в crontab:
```bash
# Ежедневный backup в 2:00
0 2 * * * /opt/secure-p2p-messenger/backup.sh
```

---

## Устранение Неполадок

### Проблема: Контейнеры не запускаются

**Решение**:
```bash
# Проверить логи
docker-compose logs

# Проверить статус
docker-compose ps

# Пересоздать контейнеры
docker-compose down
docker-compose up -d --force-recreate
```

### Проблема: Не удается подключиться к WebSocket

**Проверки**:
1. Проверить, что порт 8081 открыт
2. Проверить CORS настройки в .env
3. Проверить URL в клиенте (ws:// для dev, wss:// для prod)

```bash
# Тест подключения
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8081
```

### Проблема: P2P соединение не устанавливается

**Проверки**:
1. Проверить работу TURN/STUN сервера
2. Проверить открытые порты (3478, 49152-49252)
3. Проверить EXTERNAL_IP в .env

```bash
# Тест TURN
turnutils_uclient -v -u test -w test YOUR_SERVER_IP
```

### Проблема: Ошибки базы данных

**Решение**:
```bash
# Проверить подключение к БД
docker-compose exec postgres psql -U postgres -c "SELECT version();"

# Пересоздать схему
docker-compose exec postgres psql -U postgres secure_p2p_messenger < packages/server/src/db/schema.sql
```

### Проблема: Высокое использование ресурсов

**Решение**:
```bash
# Проверить использование
docker stats

# Ограничить ресурсы в docker-compose.yml
services:
  server:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

### Получение Помощи

- **GitHub Issues**: https://github.com/your-org/secure-p2p-messenger/issues
- **Документация**: https://docs.your-domain.com
- **Email**: support@your-domain.com

---

## Обновление Приложения

```bash
# Остановить сервисы
docker-compose down

# Получить последние изменения
git pull origin main

# Пересобрать образы
docker-compose build

# Запустить с новыми образами
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Проверить логи
docker-compose logs -f
```

---

## Безопасность

### Рекомендации по Безопасности

1. **Всегда используйте HTTPS/WSS в production**
2. **Генерируйте сильные случайные пароли**
3. **Регулярно обновляйте зависимости**
4. **Настройте firewall**
5. **Используйте rate limiting**
6. **Регулярно делайте резервные копии**
7. **Мониторьте логи на подозрительную активность**
8. **Ограничьте доступ к серверу (SSH keys only)**

### Проверка Безопасности

```bash
# Проверить открытые порты
sudo netstat -tulpn

# Проверить SSL конфигурацию
openssl s_client -connect yourdomain.com:443

# Сканирование уязвимостей Docker образов
docker scan secure-p2p-messenger-server
```

---

## Производительность

### Оптимизация для Production

1. **Включить gzip сжатие** (уже настроено в nginx.conf)
2. **Настроить кеширование статических файлов**
3. **Использовать CDN для статики**
4. **Оптимизировать PostgreSQL**:

```sql
-- В postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
```

5. **Масштабирование**:
   - Горизонтальное: несколько инстансов сервера за load balancer
   - Вертикальное: увеличение ресурсов сервера

---

Для дополнительной информации см. [README.md](README.md) и [документацию API](docs/API.md).

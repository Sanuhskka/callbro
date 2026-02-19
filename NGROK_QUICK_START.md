# 🚇 Быстрый Старт с Ngrok
# Ваш Домен: ebony-unacquainted-myra.ngrok-free.dev

---

## ⚡ Самый Быстрый Способ (5 минут)

### Вариант 1: С Docker (Рекомендуется)

```bash
# 1. Установить Ngrok (если еще не установлен)
# Linux
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# Mac
brew install ngrok/ngrok/ngrok

# Windows - скачать с https://ngrok.com/download

# 2. Настроить authtoken
ngrok config add-authtoken 37TZ9geaKvmc7yYmhYys7Z2bLu2_5vrNmMNJ7bDGCMnCe9YUC

# 3. Запустить скрипт
chmod +x start-ngrok.sh
./start-ngrok.sh
# Выбрать "1" для Docker

# 4. Открыть в браузере
# https://ebony-unacquainted-myra.ngrok-free.dev
```

**Готово!** 🎉

---

### Вариант 2: Локальная Разработка

```bash
# 1-2. То же самое (установить Ngrok и authtoken)

# 3. Установить зависимости
npm install

# 4. Скопировать конфигурацию
cp .env.ngrok packages/server/.env
cp .env.ngrok packages/client/.env.local

# 5. Запустить БД
docker-compose up -d postgres

# 6. Инициализировать БД
PGPASSWORD=postgres psql -h localhost -U postgres -d secure_p2p_messenger -f packages/server/src/db/schema.sql

# 7. Запустить все сервисы автоматически
chmod +x start-ngrok-dev.sh
./start-ngrok-dev.sh

# Или вручную в 3 терминалах:
# Терминал 1: cd packages/server && npm run dev
# Терминал 2: cd packages/client && npm run dev
# Терминал 3: ngrok http 5173 --domain=ebony-unacquainted-myra.ngrok-free.dev
```

**Готово!** 🎉

---

## 🌐 Ваши URL

После запуска:

- **Приложение:** https://ebony-unacquainted-myra.ngrok-free.dev
- **Ngrok Dashboard:** http://localhost:4040

---

## 📝 Конфигурация

Все уже настроено в файлах:

### `.env.ngrok`
```env
NGROK_DOMAIN=ebony-unacquainted-myra.ngrok-free.dev
CORS_ORIGIN=https://ebony-unacquainted-myra.ngrok-free.dev
VITE_WS_URL=wss://ebony-unacquainted-myra.ngrok-free.dev/ws
```

### `ngrok.yml`
```yaml
authtoken: 37TZ9geaKvmc7yYmhYys7Z2bLu2_5vrNmMNJ7bDGCMnCe9YUC
tunnels:
  web:
    domain: ebony-unacquainted-myra.ngrok-free.dev
```

---

## 🔍 Проверка Работы

```bash
# 1. Проверить что Ngrok запущен
curl https://ebony-unacquainted-myra.ngrok-free.dev

# 2. Открыть Ngrok dashboard
# http://localhost:4040

# 3. Открыть приложение
# https://ebony-unacquainted-myra.ngrok-free.dev

# 4. Проверить логи
# Docker: docker-compose logs -f
# Локально: tail -f logs/server.log logs/client.log
```

---

## 🛑 Остановка

```bash
# Остановить все (Ctrl+C в терминале где запущен скрипт)

# Или вручную:
# Docker
docker-compose down

# Ngrok
pkill ngrok

# Локальные процессы
pkill -f "npm run dev"
```

---

## 🐛 Проблемы?

### Ngrok не запускается

```bash
# Проверить authtoken
ngrok config check

# Переустановить authtoken
ngrok config add-authtoken 37TZ9geaKvmc7yYmhYys7Z2bLu2_5vrNmMNJ7bDGCMnCe9YUC

# Проверить версию
ngrok version
```

### Приложение не открывается

```bash
# Проверить что сервисы запущены
docker-compose ps  # для Docker
ps aux | grep node  # для локальной разработки

# Проверить Ngrok dashboard
# http://localhost:4040

# Проверить логи
docker-compose logs -f  # Docker
tail -f logs/*.log  # Локально
```

### WebSocket не работает

```bash
# Проверить CORS в packages/server/.env
CORS_ORIGIN=https://ebony-unacquainted-myra.ngrok-free.dev

# Проверить WebSocket URL в packages/client/.env.local
VITE_WS_URL=wss://ebony-unacquainted-myra.ngrok-free.dev/ws

# Перезапустить сервисы
```

---

## 📚 Полная Документация

Детальное руководство: **[docs/NGROK_SETUP.md](docs/NGROK_SETUP.md)**

---

## 💡 Советы

1. **Ngrok Dashboard** (http://localhost:4040) - ваш лучший друг для отладки
2. **Логи** - всегда проверяйте логи при проблемах
3. **Перезапуск** - при изменении конфигурации перезапустите сервисы
4. **Не для production** - Ngrok только для тестирования!

---

## 🎯 Что Дальше?

После успешного запуска:

1. ✅ Зарегистрируйтесь в приложении
2. ✅ Протестируйте отправку сообщений
3. ✅ Попробуйте голосовой/видео звонок
4. ✅ Проверьте работу на мобильном устройстве

---

**Готово! Ваш мессенджер работает через Ngrok! 🚀**

**URL:** https://ebony-unacquainted-myra.ngrok-free.dev

Нужна помощь? См. [docs/NGROK_SETUP.md](docs/NGROK_SETUP.md)

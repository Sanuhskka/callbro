#!/bin/bash
# Автоматический запуск всех сервисов для разработки с Ngrok
# Secure P2P Messenger

echo "🚀 Запуск всех сервисов..."
echo ""

# Цвета
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Функция для остановки всех процессов
cleanup() {
    echo ""
    echo "🛑 Остановка сервисов..."
    kill $SERVER_PID $CLIENT_PID $NGROK_PID 2>/dev/null
    docker-compose stop postgres
    exit 0
}

trap cleanup SIGINT SIGTERM

# Копировать конфигурацию
echo -e "${BLUE}📝 Копирование конфигурации...${NC}"
cp .env.ngrok packages/server/.env
cp .env.ngrok packages/client/.env.local

# Запустить БД
echo -e "${BLUE}🗄️  Запуск PostgreSQL...${NC}"
docker-compose up -d postgres
sleep 3

# Инициализировать БД
PGPASSWORD=postgres psql -h localhost -U postgres -d secure_p2p_messenger -c "SELECT 1" &>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${BLUE}📊 Инициализация базы данных...${NC}"
    PGPASSWORD=postgres psql -h localhost -U postgres -d secure_p2p_messenger -f packages/server/src/db/schema.sql
fi

# Запустить сервер
echo -e "${BLUE}🖥️  Запуск сервера...${NC}"
cd packages/server
npm run dev > ../../logs/server.log 2>&1 &
SERVER_PID=$!
cd ../..
sleep 3

# Запустить клиент
echo -e "${BLUE}🌐 Запуск клиента...${NC}"
cd packages/client
npm run dev > ../../logs/client.log 2>&1 &
CLIENT_PID=$!
cd ../..
sleep 5

# Запустить Ngrok
echo -e "${BLUE}🚇 Запуск Ngrok...${NC}"
ngrok http 5173 --domain=ebony-unacquainted-myra.ngrok-free.dev --log=stdout > logs/ngrok.log 2>&1 &
NGROK_PID=$!

echo ""
echo -e "${GREEN}✅ Все сервисы запущены!${NC}"
echo ""
echo "📊 Логи:"
echo "  Сервер: tail -f logs/server.log"
echo "  Клиент: tail -f logs/client.log"
echo "  Ngrok: tail -f logs/ngrok.log"
echo ""
echo "🌐 URLs:"
echo "  Приложение: https://ebony-unacquainted-myra.ngrok-free.dev"
echo "  Ngrok Dashboard: http://localhost:4040"
echo ""
echo "Нажмите Ctrl+C для остановки всех сервисов"
echo ""

# Ждать
wait

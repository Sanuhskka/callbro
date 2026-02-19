#!/bin/bash
# Быстрый старт с Ngrok
# Secure P2P Messenger

echo "🚇 Запуск Secure P2P Messenger с Ngrok"
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка установки Ngrok
if ! command -v ngrok &> /dev/null; then
    echo -e "${YELLOW}⚠️  Ngrok не установлен${NC}"
    echo ""
    echo "Установите Ngrok:"
    echo "  Linux: sudo apt install ngrok"
    echo "  Mac: brew install ngrok/ngrok/ngrok"
    echo "  Windows: choco install ngrok"
    echo ""
    echo "Или скачайте с https://ngrok.com/download"
    exit 1
fi

# Проверка authtoken
if ! grep -q "37TZ9geaKvmc7yYmhYys7Z2bLu2_5vrNmMNJ7bDGCMnCe9YUC" ~/.ngrok2/ngrok.yml 2>/dev/null; then
    echo -e "${BLUE}🔑 Настройка authtoken...${NC}"
    ngrok config add-authtoken 37TZ9geaKvmc7yYmhYys7Z2bLu2_5vrNmMNJ7bDGCMnCe9YUC
    echo -e "${GREEN}✅ Authtoken настроен${NC}"
    echo ""
fi

# Выбор режима запуска
echo "Выберите режим запуска:"
echo "  1) Docker (рекомендуется)"
echo "  2) Локальная разработка"
echo ""
read -p "Ваш выбор (1 или 2): " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo -e "${BLUE}🐳 Запуск с Docker...${NC}"
    echo ""
    
    # Проверка Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}⚠️  Docker не установлен${NC}"
        exit 1
    fi
    
    # Копировать конфигурацию
    echo -e "${BLUE}📝 Копирование конфигурации...${NC}"
    cp .env.ngrok .env
    
    # Запустить Docker
    echo -e "${BLUE}🚀 Запуск Docker контейнеров...${NC}"
    docker-compose up -d
    
    # Подождать запуска
    echo -e "${BLUE}⏳ Ожидание запуска сервисов...${NC}"
    sleep 5
    
    # Запустить Ngrok
    echo ""
    echo -e "${GREEN}🚇 Запуск Ngrok туннеля...${NC}"
    echo ""
    echo -e "${YELLOW}Ngrok Dashboard: http://localhost:4040${NC}"
    echo -e "${YELLOW}Приложение: https://ebony-unacquainted-myra.ngrok-free.dev${NC}"
    echo ""
    echo "Нажмите Ctrl+C для остановки"
    echo ""
    
    ngrok http 80 --domain=ebony-unacquainted-myra.ngrok-free.dev

elif [ "$choice" = "2" ]; then
    echo ""
    echo -e "${BLUE}💻 Запуск локальной разработки...${NC}"
    echo ""
    
    # Проверка Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}⚠️  Node.js не установлен${NC}"
        exit 1
    fi
    
    # Копировать конфигурацию
    echo -e "${BLUE}📝 Копирование конфигурации...${NC}"
    cp .env.ngrok packages/server/.env
    cp .env.ngrok packages/client/.env.local
    
    # Проверка зависимостей
    if [ ! -d "node_modules" ]; then
        echo -e "${BLUE}📦 Установка зависимостей...${NC}"
        npm install
    fi
    
    # Запустить БД
    echo -e "${BLUE}🗄️  Запуск PostgreSQL...${NC}"
    docker-compose up -d postgres
    sleep 3
    
    # Инициализировать БД (если нужно)
    echo -e "${BLUE}🔧 Проверка базы данных...${NC}"
    PGPASSWORD=postgres psql -h localhost -U postgres -d secure_p2p_messenger -c "SELECT 1" &>/dev/null
    if [ $? -ne 0 ]; then
        echo -e "${BLUE}📊 Инициализация базы данных...${NC}"
        PGPASSWORD=postgres psql -h localhost -U postgres -d secure_p2p_messenger -f packages/server/src/db/schema.sql
    fi
    
    echo ""
    echo -e "${GREEN}✅ Готово к запуску!${NC}"
    echo ""
    echo "Откройте 3 терминала и выполните:"
    echo ""
    echo -e "${BLUE}Терминал 1 - Сервер:${NC}"
    echo "  cd packages/server && npm run dev"
    echo ""
    echo -e "${BLUE}Терминал 2 - Клиент:${NC}"
    echo "  cd packages/client && npm run dev"
    echo ""
    echo -e "${BLUE}Терминал 3 - Ngrok:${NC}"
    echo "  ngrok http 5173 --domain=ebony-unacquainted-myra.ngrok-free.dev"
    echo ""
    echo -e "${YELLOW}Или запустите все автоматически:${NC}"
    echo "  ./start-ngrok-dev.sh"
    echo ""
    
else
    echo "Неверный выбор"
    exit 1
fi

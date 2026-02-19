# Makefile for Secure P2P Messenger
# Simplifies common deployment and development tasks

.PHONY: help install dev build start stop restart logs clean test lint format backup restore

# Default target
help:
	@echo "Secure P2P Messenger - Available Commands:"
	@echo ""
	@echo "Development:"
	@echo "  make install       - Install dependencies"
	@echo "  make dev           - Start development environment"
	@echo "  make test          - Run all tests"
	@echo "  make lint          - Run linters"
	@echo "  make format        - Format code"
	@echo ""
	@echo "Production:"
	@echo "  make build         - Build Docker images"
	@echo "  make start         - Start production services"
	@echo "  make stop          - Stop all services"
	@echo "  make restart       - Restart all services"
	@echo "  make logs          - View logs"
	@echo ""
	@echo "Maintenance:"
	@echo "  make backup        - Backup database"
	@echo "  make restore       - Restore database from backup"
	@echo "  make clean         - Clean up containers and volumes"
	@echo "  make ssl-renew     - Renew SSL certificates"
	@echo ""
	@echo "Monitoring:"
	@echo "  make status        - Show service status"
	@echo "  make stats         - Show resource usage"
	@echo "  make health        - Check service health"

# Development
install:
	@echo "Installing dependencies..."
	npm install

dev:
	@echo "Starting development environment..."
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

dev-detached:
	@echo "Starting development environment (detached)..."
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

test:
	@echo "Running tests..."
	npm test

test-client:
	@echo "Running client tests..."
	npm test --workspace=@secure-p2p-messenger/client

test-server:
	@echo "Running server tests..."
	npm test --workspace=@secure-p2p-messenger/server

lint:
	@echo "Running linters..."
	npm run lint

format:
	@echo "Formatting code..."
	npm run format

# Production
build:
	@echo "Building Docker images..."
	docker-compose build

start:
	@echo "Starting production services..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

start-staging:
	@echo "Starting staging services..."
	docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d

stop:
	@echo "Stopping all services..."
	docker-compose down

restart:
	@echo "Restarting all services..."
	docker-compose restart

logs:
	@echo "Viewing logs (Ctrl+C to exit)..."
	docker-compose logs -f

logs-server:
	@echo "Viewing server logs..."
	docker-compose logs -f server

logs-client:
	@echo "Viewing client logs..."
	docker-compose logs -f client

logs-db:
	@echo "Viewing database logs..."
	docker-compose logs -f postgres

logs-coturn:
	@echo "Viewing coturn logs..."
	docker-compose logs -f coturn

# Monitoring
status:
	@echo "Service status:"
	docker-compose ps

stats:
	@echo "Resource usage:"
	docker stats --no-stream

health:
	@echo "Checking service health..."
	@docker-compose ps | grep -q "Up (healthy)" && echo "✓ All services healthy" || echo "✗ Some services unhealthy"

# Maintenance
backup:
	@echo "Creating database backup..."
	@mkdir -p backups
	@docker-compose exec -T postgres pg_dump -U postgres secure_p2p_messenger > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "Backup created in backups/"

restore:
	@echo "Restoring database from backup..."
	@read -p "Enter backup file name: " backup_file; \
	docker-compose exec -T postgres psql -U postgres secure_p2p_messenger < backups/$$backup_file

clean:
	@echo "Cleaning up containers and volumes..."
	@read -p "This will remove all data. Continue? [y/N] " confirm; \
	if [ "$$confirm" = "y" ]; then \
		docker-compose down -v; \
		echo "Cleanup complete"; \
	else \
		echo "Cleanup cancelled"; \
	fi

clean-images:
	@echo "Removing Docker images..."
	docker-compose down --rmi all

ssl-renew:
	@echo "Renewing SSL certificates..."
	certbot renew --quiet
	docker-compose restart client coturn

# Database
db-shell:
	@echo "Opening database shell..."
	docker-compose exec postgres psql -U postgres secure_p2p_messenger

db-migrate:
	@echo "Running database migrations..."
	docker-compose exec postgres psql -U postgres secure_p2p_messenger < packages/server/src/db/schema.sql

# Docker
docker-prune:
	@echo "Pruning Docker system..."
	docker system prune -af --volumes

# Environment setup
setup-dev:
	@echo "Setting up development environment..."
	@if [ ! -f .env ]; then \
		cp .env.development .env; \
		echo "Created .env from .env.development"; \
	else \
		echo ".env already exists"; \
	fi

setup-prod:
	@echo "Setting up production environment..."
	@if [ ! -f .env ]; then \
		cp .env.production .env; \
		echo "Created .env from .env.production"; \
		echo "⚠️  IMPORTANT: Edit .env and update all CHANGE_THIS values!"; \
	else \
		echo ".env already exists"; \
	fi

# Quick commands
up: start
down: stop
ps: status

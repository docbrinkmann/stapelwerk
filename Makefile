# Build-My-Stack Development Makefile
# Common commands for Docker-based development

.PHONY: help setup up down restart logs shell db-migrate db-seed db-reset clean build test lint

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Build-My-Stack Development Commands$(NC)"
	@echo "===================================="
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

setup: ## Initial setup - build and start all services
	@echo "$(BLUE)🚀 Setting up Docker environment...$(NC)"
	@./docker/setup.sh

setup-clean: ## Clean setup - remove all data and rebuild
	@echo "$(BLUE)🧹 Clean setup - removing all data...$(NC)"
	@./docker/setup.sh --clean

up: ## Start all services
	@echo "$(BLUE)▶️  Starting services...$(NC)"
	@docker-compose up -d
	@echo "$(GREEN)✓ Services started$(NC)"

down: ## Stop all services
	@echo "$(BLUE)⏹️  Stopping services...$(NC)"
	@docker-compose down
	@echo "$(GREEN)✓ Services stopped$(NC)"

restart: ## Restart all services
	@echo "$(BLUE)🔄 Restarting services...$(NC)"
	@docker-compose restart
	@echo "$(GREEN)✓ Services restarted$(NC)"

restart-app: ## Restart only the app service
	@echo "$(BLUE)🔄 Restarting app...$(NC)"
	@docker-compose restart app
	@echo "$(GREEN)✓ App restarted$(NC)"

logs: ## View logs from all services
	@docker-compose logs -f

logs-app: ## View logs from app service only
	@docker-compose logs -f app

logs-db: ## View logs from database service
	@docker-compose logs -f postgres

shell: ## Open shell in app container
	@echo "$(BLUE)🐚 Opening shell in app container...$(NC)"
	@docker-compose exec app sh

shell-db: ## Open psql shell in database
	@echo "$(BLUE)🐚 Opening database shell...$(NC)"
	@docker-compose exec postgres psql -U postgres -d build_my_stack_dev

db-migrate: ## Run database migrations
	@echo "$(BLUE)🔄 Running migrations...$(NC)"
	@docker-compose exec app npm run prisma:migrate:dev
	@echo "$(GREEN)✓ Migrations completed$(NC)"

db-seed: ## Seed the database with test data
	@echo "$(BLUE)🌱 Seeding database...$(NC)"
	@docker-compose exec app npm run prisma:seed
	@echo "$(GREEN)✓ Database seeded$(NC)"

db-reset: ## Reset database (migrate + seed)
	@echo "$(BLUE)🔄 Resetting database...$(NC)"
	@docker-compose exec app npm run prisma:migrate:reset
	@echo "$(GREEN)✓ Database reset$(NC)"

db-studio: ## Open Prisma Studio
	@echo "$(BLUE)📊 Opening Prisma Studio...$(NC)"
	@docker-compose exec app npm run prisma:studio

clean: ## Remove all containers, volumes, and build artifacts
	@echo "$(RED)🧹 Cleaning up...$(NC)"
	@docker-compose down -v
	@rm -rf .next node_modules/.cache
	@echo "$(GREEN)✓ Cleanup completed$(NC)"

build: ## Build the application
	@echo "$(BLUE)🔨 Building application...$(NC)"
	@docker-compose exec app npm run build
	@echo "$(GREEN)✓ Build completed$(NC)"

build-docker: ## Rebuild Docker images
	@echo "$(BLUE)🔨 Building Docker images...$(NC)"
	@docker-compose build --no-cache
	@echo "$(GREEN)✓ Docker build completed$(NC)"

test: ## Run tests
	@echo "$(BLUE)🧪 Running tests...$(NC)"
	@docker-compose exec app npm run test

test-watch: ## Run tests in watch mode
	@echo "$(BLUE)🧪 Running tests in watch mode...$(NC)"
	@docker-compose exec app npm run test:watch

test-coverage: ## Run tests with coverage
	@echo "$(BLUE)📊 Running tests with coverage...$(NC)"
	@docker-compose exec app npm run test:coverage

lint: ## Run linting
	@echo "$(BLUE)🔍 Running linter...$(NC)"
	@docker-compose exec app npm run lint

lint-fix: ## Fix linting issues
	@echo "$(BLUE)🔧 Fixing linting issues...$(NC)"
	@docker-compose exec app npm run lint:fix

type-check: ## Run TypeScript type checking
	@echo "$(BLUE)🔍 Running type check...$(NC)"
	@docker-compose exec app npm run type-check

format: ## Format code with Prettier
	@echo "$(BLUE)💅 Formatting code...$(NC)"
	@docker-compose exec app npm run format

install: ## Install npm dependencies
	@echo "$(BLUE)📦 Installing dependencies...$(NC)"
	@docker-compose exec app npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

status: ## Show status of all services
	@echo "$(BLUE)📊 Service Status:$(NC)"
	@echo ""
	@docker-compose ps

health: ## Check health of services
	@echo "$(BLUE)🏥 Health Check:$(NC)"
	@echo ""
	@echo "App Health:"
	@curl -s http://localhost:3000/api/health | jq '.' || echo "$(RED)App not responding$(NC)"
	@echo ""
	@echo "Database:"
	@docker-compose exec -T postgres pg_isready -U postgres -d build_my_stack_dev || echo "$(RED)Database not ready$(NC)"
	@echo ""
	@echo "Redis:"
	@docker-compose exec -T redis redis-cli ping || echo "$(RED)Redis not ready$(NC)"

stats: ## Show Docker stats
	@docker stats --no-stream build-my-stack-app build-my-stack-postgres build-my-stack-redis

prune: ## Remove unused Docker resources
	@echo "$(YELLOW)⚠️  Removing unused Docker resources...$(NC)"
	@docker system prune -f
	@echo "$(GREEN)✓ Prune completed$(NC)"

backup-db: ## Backup database
	@echo "$(BLUE)💾 Backing up database...$(NC)"
	@mkdir -p backups
	@docker-compose exec -T postgres pg_dump -U postgres build_my_stack_dev > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Database backup created$(NC)"

restore-db: ## Restore database from latest backup (use BACKUP_FILE=path/to/file.sql)
	@echo "$(BLUE)📥 Restoring database...$(NC)"
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "$(RED)Error: Please specify BACKUP_FILE=path/to/file.sql$(NC)"; \
		exit 1; \
	fi
	@docker-compose exec -T postgres psql -U postgres -d build_my_stack_dev < $(BACKUP_FILE)
	@echo "$(GREEN)✓ Database restored$(NC)"

dev: up ## Alias for 'up' - start development environment

prod-build: ## Build for production
	@echo "$(BLUE)🏗️  Building for production...$(NC)"
	@npm run build
	@echo "$(GREEN)✓ Production build completed$(NC)"

prod-start: ## Start production server
	@echo "$(BLUE)🚀 Starting production server...$(NC)"
	@npm run start

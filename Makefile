.PHONY: help install dev start build test lint clean docker-up docker-down

help:
	@echo "EcoTwin Development Commands"
	@echo "=============================="
	@echo "make install    - Установить зависимости"
	@echo "make dev        - Запустить backend в режиме разработки"
	@echo "make start      - Запустить backend в production режиме"
	@echo "make lint       - Проверить код ESLint"
	@echo "make format     - Форматировать код Prettier"
	@echo "make clean      - Очистить node_modules и логи"
	@echo "make docker-up  - Запустить Docker Compose"
	@echo "make docker-down- Остановить Docker Compose"

install:
	cd backend && npm install

dev:
	cd backend && npm run dev

start:
	cd backend && npm start

lint:
	cd backend && npx eslint . 2>/dev/null || echo "ESLint не установлен"

format:
	npx prettier --write "**/*.{js,json,md}" 2>/dev/null || echo "Prettier не установлен"

test:
	@echo "Тесты не настроены"

clean:
	rm -rf backend/node_modules
	rm -rf logs/
	rm -f backend/.env.local
	find . -name "*.log" -delete

docker-up:
	docker-compose up --build

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

.DEFAULT_GOAL := help

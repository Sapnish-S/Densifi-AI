# Densify local stack (Docker Compose)
#   make up    — start postgres, S3, api, web
#   make kill  — stop and remove containers

COMPOSE ?= docker compose
ENV_FILE ?= .env

.PHONY: up kill down logs ps

up:
	@test -f $(ENV_FILE) || cp .env.example $(ENV_FILE)
	$(COMPOSE) up --build -d
	@echo ""
	@echo "Web: http://localhost:3000"
	@echo "API: http://localhost:8000/docs"
	@echo "S3:  http://localhost:9000"

kill down:
	$(COMPOSE) down --remove-orphans

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

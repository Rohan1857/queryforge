.PHONY: dev migrate seed test lint docker-up docker-down

dev:
	uvicorn backend.main:asgi_app --reload --host 0.0.0.0 --port 8000

migrate:
	alembic upgrade head

seed:
	python scripts/seed_demo.py

test:
	pytest tests/ -v

lint:
	ruff check backend/ --fix
	ruff format backend/

docker-up:
	docker compose up -d

docker-down:
	docker compose down

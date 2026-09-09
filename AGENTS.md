# Repository Guidelines

## Project Structure & Module Organization
`backend/` contains the FastAPI application: `api/` for routes, `services/` for business logic, `models/` for SQLAlchemy models, `schemas/` for Pydantic contracts, and `migrations/` for Alembic revisions. `frontend/src/` holds the React app, organized into `routes/`, `components/`, `stores/`, `hooks/`, `lib/`, and `types/`. Shared scripts live in `scripts/`, backend and stack entrypoints live at the repo root, and tests are under `tests/` with API-style end-to-end coverage in `tests/e2e/`.

## Build, Test, and Development Commands
Use the root `Makefile` for backend workflows:

- `make dev`: run the FastAPI app with reload on port `8000`.
- `make migrate`: apply Alembic migrations.
- `make seed`: load demo data from `scripts/seed_demo.py`.
- `make test`: run the Python test suite with `pytest`.
- `make lint`: run Ruff linting and formatting for `backend/`.

For full-stack local development, use `docker compose -f docker-compose.dev.yml up -d`. For frontend-only work, run `npm install` once in `frontend/`, then `npm run dev`, `npm run build`, or `npm run lint`.

## Coding Style & Naming Conventions
Python targets 3.11, uses 4-space indentation, type hints, Ruff, and strict MyPy settings. Keep backend modules in `snake_case`; prefer explicit service names such as `auth_service.py` or `dashboard_service.py`. Frontend TypeScript uses 2-space indentation, PascalCase for React components (`PromptBar.tsx`), camelCase for hooks and stores (`useWebSocket.ts`, `authStore.ts`), and lowercase route files with dynamic segments like `routes/dashboard/[id].tsx`.

## Testing Guidelines
Backend tests use `pytest` with `pytest-asyncio`; async API tests rely on `httpx` and the in-memory SQLite fixtures in `tests/conftest.py`. End-to-end coverage lives in `tests/e2e/` and targets a live server via Playwright request APIs. Name tests `test_*.py` and keep each test focused on one endpoint or workflow. Run targeted suites with `pytest tests/test_dev_auth.py -v` or `TEST_BASE_URL=http://localhost:8000 pytest tests/e2e -v`. No coverage gate is enforced, so add tests for any changed auth, query, dashboard, or connector behavior.

## Commit & Pull Request Guidelines
Recent history uses inconsistent messages such as `fixes` and `Mutiple charts`; prefer concise imperative commits instead, for example `Add dev auth bypass test`. Keep one logical change per commit. Pull requests should describe the user-visible impact, note config or migration changes, link the related issue, and include screenshots for frontend updates. Highlight any required `.env` changes, especially auth, database, or Anthropic settings.

## Security & Configuration Tips
Start from `.env.example` and keep secrets out of version control. Treat `DEV_AUTH_BYPASS=true` as local-only. When changing upload, auth, or connector code, verify the defaults in `backend/config.py` and update `README.md` if setup steps change.

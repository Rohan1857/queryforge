# QueryForge

> Governed natural-language BI & SQL analytics platform that transforms business questions into validated, schema-aware queries, interactive visualizations, and real-time dashboards.

QueryForge is an end-to-end platform for governed data exploration without writing manual SQL. A user can ask natural-language questions such as _“Show monthly revenue by region as a bar chart”_; the platform constructs schema-aware context, generates and validates safe read-only SQL queries, executes them through isolated connectors, and renders interactive widgets on a customizable dashboard canvas.

## Why it exists

Business teams want self-service answers, while data teams need control over schema access, query safety, and auditability. QueryForge is designed around that boundary: natural language improves access to data, but the generated query must still pass through explicit validation and a data-connector layer.

## Core capabilities

- Natural-language intent classification and prompt optimization.
- Schema-aware query generation and chart recommendations.
- SQL validation before execution.
- Connectors for PostgreSQL, MySQL, SQLite, CSV, Excel, JSON, DuckDB, and Google Drive/Sheets workflows.
- Dashboard and widget management with a React grid-based canvas.
- Authentication, database migrations, caching, rate limiting, export, and query logging foundations.

## Architecture

```text
React + TypeScript dashboard
          │ HTTP / WebSocket
          ▼
FastAPI application ── auth, dashboards, widgets, queries
          │
          ├── Prompt engine: intent → schema context → SQL/chart suggestion
          ├── SQL validation and audit logging
          └── Connector layer: databases, files, and cloud sources
```

## Repository layout

```text
backend/
  api/                 # HTTP routes
  services/
    prompt_engine/     # intent, query, chart, widget pipeline
    connectors/        # database and file-source adapters
  models/ schemas/     # SQLAlchemy models and Pydantic contracts
  migrations/          # Alembic migrations
frontend/
  src/components/      # charts, widgets, dashboard canvas
  src/routes/          # application views
  src/stores/          # client state
tests/                 # backend and integration tests
docker-compose.yml     # local multi-service environment
```

## Technology

- **Frontend:** React, TypeScript, Vite, Zustand, Recharts, react-grid-layout
- **Backend:** Python, FastAPI, SQLAlchemy 2, Alembic
- **Data:** PostgreSQL, MySQL, SQLite, DuckDB, CSV, Excel, JSON, Google Sheets
- **Operations:** Docker Compose, Redis, environment-based configuration
- **AI:** a model-backed prompt engine with explicit schema context and query validation

## Run locally

### Prerequisites

- Docker and Docker Compose (recommended)
- Node.js 20+
- Python 3.11+

Create a local environment file:

```bash
cp .env.example .env
```

Configure the database, Redis, application secrets, and the model-provider key required by the prompt engine. Do not commit `.env` files or real credentials.

Start the full stack:

```bash
docker compose up -d
docker compose exec backend alembic upgrade head
```

For active development, start PostgreSQL and Redis with `docker-compose.dev.yml`, run the FastAPI backend with `make dev`, and run the frontend with `npm run dev` from `frontend/`.

## Testing & CI/CD

The platform includes a comprehensive test suite covering backend database adapters and frontend widget rendering:

*   **Backend Tests:** Run with `pytest` for unit testing the schemas, db migrations, and prompt engine:
    ```bash
    pytest
    ```
*   **Integration/E2E Tests:** End-to-end user-flow tests are located in `tests/e2e/`.
*   **Continuous Integration:** GitHub Actions runs automated pipelines (`.github/workflows/ci.yml`) to validate linting and test execution on every push or pull request.

## Quality and safety direction

This project intentionally treats text-to-SQL as a systems problem rather than a prompt-only problem. The next milestones are a public redacted demo, adversarial SQL-safety tests, a compact prompt-evaluation suite, connector contract tests, and a documented model/latency/cost evaluation.

## Status

Active portfolio project. Contributions and feedback are welcome through issues after the public contribution guide is added.

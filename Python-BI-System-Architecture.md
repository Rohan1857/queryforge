# Prompt-Based BI System — Python Architecture & Claude Code Prompts

---

## 1. System Vision

A **natural-language BI platform** (100% Python backend) where users type prompts like *"Show me monthly revenue by region as a bar chart"* and the system:

1. Connects to databases, Google Drive, and local files
2. Uses Claude API to convert the prompt into SQL/Pandas queries
3. Renders charts, tables, KPI cards, and text blocks
4. Lets users drag-and-drop widgets onto a freeform canvas dashboard
5. Saves, shares, and exports dashboards

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + TypeScript)                    │
│                                                                     │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────┐ │
│  │ Prompt Bar    │  │ Widget Gallery   │  │ Dashboard Canvas      │ │
│  │ (NL Input)    │  │ (Charts/Tables)  │  │ (Drag-Drop Grid)     │ │
│  └──────┬───────┘  └────────┬─────────┘  └───────────┬───────────┘ │
│         └────────────────────┼─────────────────────────┘             │
│                              │ HTTP + WebSocket                     │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                     BACKEND (Python / FastAPI)                       │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │ Prompt Engine   │  │ Query Engine   │  │ Dashboard Service      │ │
│  │ (Claude API)    │  │ (SQLAlchemy)   │  │ (CRUD + Layout)       │ │
│  └───────┬────────┘  └───────┬────────┘  └────────────────────────┘ │
│          │                   │                                       │
│  ┌───────┴───────────────────┴───────────────────────────────────┐  │
│  │                  Data Connector Layer (Python)                  │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐   │  │
│  │  │ Database  │  │ Google Drive │  │ Local Files            │   │  │
│  │  │(SQLAlchemy│  │ (gspread +   │  │ (Pandas: CSV/Excel/    │   │  │
│  │  │ + asyncpg)│  │  google-api) │  │  JSON/Parquet)         │   │  │
│  │  └──────────┘  └──────────────┘  └────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              App Database (PostgreSQL + SQLAlchemy)             │  │
│  │   users │ connections │ dashboards │ widgets │ query_logs      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              Cache Layer (Redis via redis-py)                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Complete Project Structure

```
queryforge/
├── pyproject.toml                  # Python project config (Poetry / uv)
├── docker-compose.yml              # Full stack orchestration
├── docker-compose.dev.yml          # Dev overrides
├── .env.example                    # All env vars documented
├── Makefile                        # dev, migrate, seed, test, docker-up
├── alembic.ini                     # Alembic config
│
├── backend/                        # Python backend (FastAPI)
│   ├── __init__.py
│   ├── main.py                     # FastAPI app entry, lifespan, CORS
│   ├── config.py                   # Pydantic Settings (env vars)
│   ├── dependencies.py             # Dependency injection (db session, current_user)
│   │
│   ├── db/
│   │   ├── __init__.py
│   │   ├── engine.py               # async SQLAlchemy engine + sessionmaker
│   │   ├── base.py                 # DeclarativeBase
│   │   └── session.py              # get_async_session dependency
│   │
│   ├── models/                     # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── user.py                 # User model
│   │   ├── connection.py           # DataConnection model
│   │   ├── dashboard.py            # Dashboard model
│   │   ├── widget.py               # Widget model
│   │   └── query_log.py            # QueryLog model
│   │
│   ├── schemas/                    # Pydantic schemas (request/response)
│   │   ├── __init__.py
│   │   ├── user.py                 # UserCreate, UserRead, UserLogin
│   │   ├── connection.py           # ConnectionCreate, ConnectionRead, SchemaMetadata
│   │   ├── dashboard.py            # DashboardCreate, DashboardRead, LayoutUpdate
│   │   ├── widget.py               # WidgetCreate, WidgetRead, WidgetConfig
│   │   ├── prompt.py               # PromptRequest, PromptResponse, WidgetResult
│   │   └── query.py                # QueryRequest, QueryResult
│   │
│   ├── api/                        # API route handlers
│   │   ├── __init__.py
│   │   ├── router.py               # Main APIRouter combining all sub-routers
│   │   ├── auth.py                 # POST /register, /login, /refresh, GET /me
│   │   ├── connections.py          # CRUD connections + test + sync + upload
│   │   ├── dashboards.py           # CRUD dashboards + layout + export + share
│   │   ├── widgets.py              # CRUD widgets + refresh + modify
│   │   ├── prompts.py              # POST /prompt, /prompt/explain, /prompt/suggest
│   │   ├── queries.py              # POST /query/execute, GET /query/history
│   │   └── uploads.py              # POST /upload (CSV, Excel, JSON)
│   │
│   ├── services/                   # Business logic layer
│   │   ├── __init__.py
│   │   ├── prompt_engine/
│   │   │   ├── __init__.py
│   │   │   ├── engine.py           # Main orchestrator: prompt → widget
│   │   │   ├── intent_classifier.py    # Classify prompt intent
│   │   │   ├── schema_context.py       # Build schema context for LLM
│   │   │   ├── query_generator.py      # Claude API → SQL generation
│   │   │   ├── chart_recommender.py    # Pick best chart type from data
│   │   │   └── widget_builder.py       # Assemble final widget config
│   │   │
│   │   ├── connectors/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # Abstract DataConnector protocol
│   │   │   ├── factory.py          # ConnectorFactory
│   │   │   ├── postgres.py         # PostgresConnector (asyncpg)
│   │   │   ├── mysql.py            # MySQLConnector (aiomysql)
│   │   │   ├── sqlite.py           # SQLiteConnector (aiosqlite)
│   │   │   ├── csv_connector.py    # CSVConnector (pandas + DuckDB)
│   │   │   ├── excel_connector.py  # ExcelConnector (openpyxl + DuckDB)
│   │   │   ├── json_connector.py   # JSONConnector (pandas + DuckDB)
│   │   │   └── gdrive.py           # GoogleDriveConnector (gspread)
│   │   │
│   │   ├── dashboard_service.py    # Dashboard CRUD + layout logic
│   │   ├── widget_service.py       # Widget CRUD + data refresh
│   │   ├── export_service.py       # PDF/PNG export (Playwright)
│   │   ├── auth_service.py         # JWT + password hashing
│   │   └── cache_service.py        # Redis caching layer
│   │
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── auth.py                 # JWT verification middleware
│   │   ├── rate_limiter.py         # Rate limiting (slowapi)
│   │   └── error_handler.py        # Global exception handlers
│   │
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── encryption.py           # AES-256 encrypt/decrypt for connection configs
│   │   ├── sql_validator.py        # Validate generated SQL is safe (SELECT only)
│   │   └── helpers.py              # Misc utilities
│   │
│   └── migrations/                 # Alembic migrations
│       ├── env.py
│       └── versions/
│           ├── 001_create_users.py
│           ├── 002_create_connections.py
│           ├── 003_create_dashboards.py
│           ├── 004_create_widgets.py
│           └── 005_create_query_logs.py
│
├── frontend/                       # React frontend
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes/
│       │   ├── index.tsx               # Dashboard list (home)
│       │   ├── dashboard/[id].tsx      # Canvas view
│       │   ├── connections.tsx          # Manage data sources
│       │   ├── explore.tsx             # Prompt-first exploration
│       │   └── auth.tsx                # Login / Register
│       ├── components/
│       │   ├── prompt/
│       │   │   ├── PromptBar.tsx
│       │   │   ├── PromptSuggestions.tsx
│       │   │   └── PromptHistory.tsx
│       │   ├── canvas/
│       │   │   ├── DashboardCanvas.tsx     # react-grid-layout wrapper
│       │   │   ├── WidgetWrapper.tsx        # Drag/resize container
│       │   │   └── CanvasToolbar.tsx        # Dashboard controls
│       │   ├── widgets/
│       │   │   ├── WidgetRenderer.tsx       # Route to correct widget
│       │   │   ├── ChartWidget.tsx          # Chart container
│       │   │   ├── TableWidget.tsx          # Data table
│       │   │   ├── KPIWidget.tsx            # Single metric card
│       │   │   ├── TextWidget.tsx           # Rich text block
│       │   │   └── FilterWidget.tsx         # Global filter control
│       │   ├── charts/
│       │   │   ├── BarChart.tsx
│       │   │   ├── LineChart.tsx
│       │   │   ├── PieChart.tsx
│       │   │   ├── AreaChart.tsx
│       │   │   ├── ScatterPlot.tsx
│       │   │   └── Heatmap.tsx
│       │   ├── connections/
│       │   │   ├── ConnectionForm.tsx
│       │   │   ├── DatabaseConnector.tsx
│       │   │   ├── GoogleDriveConnector.tsx
│       │   │   ├── FileUploader.tsx
│       │   │   └── SchemaExplorer.tsx
│       │   └── shared/
│       │       ├── Sidebar.tsx
│       │       ├── Header.tsx
│       │       ├── Modal.tsx
│       │       └── Toast.tsx
│       ├── stores/
│       │   ├── dashboardStore.ts
│       │   ├── connectionStore.ts
│       │   ├── promptStore.ts
│       │   └── authStore.ts
│       ├── hooks/
│       │   ├── usePromptEngine.ts
│       │   ├── useDragDrop.ts
│       │   ├── useDataQuery.ts
│       │   └── useWebSocket.ts
│       ├── lib/
│       │   ├── api.ts                  # Axios client
│       │   ├── chartConfig.ts
│       │   └── canvasLayout.ts
│       └── types/
│           ├── widget.ts
│           ├── connection.ts
│           ├── dashboard.ts
│           └── query.ts
│
├── scripts/
│   ├── seed_demo.py                # Load demo data
│   └── generate_schema.py          # Auto-generate Pydantic from DB
│
├── tests/
│   ├── conftest.py                 # Fixtures (async client, test DB)
│   ├── test_prompt_engine.py
│   ├── test_connectors.py
│   ├── test_api_auth.py
│   ├── test_api_dashboards.py
│   └── test_api_prompts.py
│
└── docs/
    ├── ARCHITECTURE.md
    ├── API.md
    └── PROMPTING-GUIDE.md
```

---

## 4. Python Dependencies

```toml
# pyproject.toml
[project]
name = "queryforge"
version = "1.0.0"
requires-python = ">=3.11"

dependencies = [
    # Web framework
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.27.0",
    "python-multipart>=0.0.9",

    # Database
    "sqlalchemy[asyncio]>=2.0.25",
    "asyncpg>=0.29.0",           # PostgreSQL async driver
    "alembic>=1.13.0",           # Migrations
    "aiosqlite>=0.19.0",         # SQLite async (for file connectors)
    "aiomysql>=0.2.0",           # MySQL async

    # Data processing
    "pandas>=2.2.0",
    "duckdb>=0.10.0",            # In-process SQL on CSV/Excel/JSON
    "openpyxl>=3.1.0",           # Excel reading
    "pyarrow>=15.0.0",           # Parquet support

    # AI / LLM
    "anthropic>=0.18.0",         # Claude API

    # Google Drive
    "google-api-python-client>=2.116.0",
    "google-auth-oauthlib>=1.2.0",
    "gspread>=6.0.0",

    # Auth & Security
    "python-jose[cryptography]>=3.3.0",  # JWT
    "passlib[bcrypt]>=1.7.4",            # Password hashing
    "cryptography>=42.0.0",              # AES encryption

    # Caching & Realtime
    "redis[hiredis]>=5.0.0",
    "python-socketio>=5.11.0",

    # Export
    "playwright>=1.41.0",        # PDF/PNG export

    # Utilities
    "pydantic>=2.6.0",
    "pydantic-settings>=2.1.0",
    "slowapi>=0.1.9",            # Rate limiting
    "loguru>=0.7.0",             # Logging
    "sqlparse>=0.4.4",           # SQL parsing/validation
    "httpx>=0.27.0",             # Async HTTP client
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.27.0",             # TestClient
    "ruff>=0.2.0",               # Linting
    "mypy>=1.8.0",
]
```

---

## 5. Database Schema (SQLAlchemy Models)

```python
# backend/models/user.py
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from backend.db.base import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    connections = relationship("DataConnection", back_populates="user", cascade="all, delete")
    dashboards = relationship("Dashboard", back_populates="user", cascade="all, delete")


# backend/models/connection.py
class DataConnection(Base):
    __tablename__ = "connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(50))  # postgres, mysql, sqlite, gdrive, csv, excel, json
    config: Mapped[dict] = mapped_column(JSONB)     # encrypted connection params
    schema_cache: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    last_synced: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="connections")
    widgets = relationship("Widget", back_populates="connection")


# backend/models/dashboard.py
class Dashboard(Base):
    __tablename__ = "dashboards"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    layout: Mapped[dict] = mapped_column(JSONB, default=dict)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_public: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="dashboards")
    widgets = relationship("Widget", back_populates="dashboard", cascade="all, delete")


# backend/models/widget.py
class Widget(Base):
    __tablename__ = "widgets"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    dashboard_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("dashboards.id", ondelete="CASCADE"))
    connection_id: Mapped[uuid.UUID | None] = mapped_column(UUID, ForeignKey("connections.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(50))  # bar, line, pie, table, kpi, text, filter
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prompt_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    query_config: Mapped[dict] = mapped_column(JSONB)
    chart_config: Mapped[dict] = mapped_column(JSONB)
    layout_position: Mapped[dict] = mapped_column(JSONB)  # {x, y, w, h}
    cached_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    refresh_interval: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    dashboard = relationship("Dashboard", back_populates="widgets")
    connection = relationship("DataConnection", back_populates="widgets")


# backend/models/query_log.py
class QueryLog(Base):
    __tablename__ = "query_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("users.id"))
    connection_id: Mapped[uuid.UUID | None] = mapped_column(UUID, ForeignKey("connections.id"), nullable=True)
    prompt: Mapped[str] = mapped_column(Text)
    generated_query: Mapped[str | None] = mapped_column(Text, nullable=True)
    intent: Mapped[str | None] = mapped_column(String(50), nullable=True)
    execution_ms: Mapped[int | None] = mapped_column(nullable=True)
    row_count: Mapped[int | None] = mapped_column(nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
```

---

## 6. The Prompt Engine Pipeline

```
User types: "Top 10 products by revenue as a bar chart"
  │
  ▼
┌─────────────────────────┐
│ 1. intent_classifier.py │ → "create_chart"
│    (keyword + Claude)   │
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│ 2. schema_context.py    │ → Builds compact schema string for Claude
│    (SQLAlchemy inspect)  │    "products(id, name, price), orders(id,
│                          │     product_id FK→products.id, quantity, date)"
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│ 3. query_generator.py   │ → Calls Claude API with schema + prompt
│    (anthropic SDK)       │    Returns: {sql, chart_type, chart_config, title}
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│ 4. sql_validator.py     │ → Validates: SELECT only, no dangerous funcs,
│    (sqlparse)            │    parameterized, timeout limit
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│ 5. Execute Query         │ → Run via SQLAlchemy/DuckDB against data source
│    (connector.execute)   │    Returns: rows + column metadata
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│ 6. chart_recommender.py │ → If chart type ambiguous, analyze data shape:
│                          │    1 row → KPI, time series → line, etc.
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│ 7. widget_builder.py    │ → Assemble complete Widget:
│                          │    {type, title, data, chartConfig, layout}
└──────────┬──────────────┘
           ▼
  Return widget to frontend → User drags onto canvas
```

---

## 7. Key Pydantic Schemas

```python
# backend/schemas/prompt.py
from pydantic import BaseModel
from typing import Optional, Any

class PromptRequest(BaseModel):
    prompt: str
    connection_id: Optional[str] = None
    dashboard_id: Optional[str] = None

class ChartConfig(BaseModel):
    x_field: str
    y_fields: list[str]
    group_field: Optional[str] = None
    aggregation: str = "sum"
    colors: list[str] = []
    stacked: bool = False
    show_values: bool = True
    orientation: str = "vertical"  # vertical | horizontal

class QueryInfo(BaseModel):
    sql: str
    params: list[Any] = []
    execution_ms: int
    row_count: int

class LayoutPosition(BaseModel):
    x: int
    y: int
    w: int
    h: int
    min_w: int = 2
    min_h: int = 2

class WidgetResult(BaseModel):
    id: Optional[str] = None
    type: str          # bar, line, pie, area, scatter, table, kpi, text, filter
    title: str
    prompt_used: str
    query_config: dict
    chart_config: ChartConfig
    layout_position: LayoutPosition
    data: list[dict[str, Any]]
    explanation: str

class PromptResponse(BaseModel):
    widget: WidgetResult
    query_info: QueryInfo
    explanation: str


# backend/schemas/connection.py
class ColumnMetadata(BaseModel):
    name: str
    type: str             # string, number, date, boolean
    is_primary_key: bool = False
    is_foreign_key: bool = False
    sample_values: list[str] = []

class TableMetadata(BaseModel):
    name: str
    columns: list[ColumnMetadata]
    row_count: int
    relationships: list[dict] = []

class SchemaMetadata(BaseModel):
    tables: list[TableMetadata]

class ConnectionCreate(BaseModel):
    name: str
    type: str  # postgres, mysql, sqlite, gdrive, csv, excel, json
    config: dict

class ConnectionRead(BaseModel):
    id: str
    name: str
    type: str
    status: str
    schema_cache: Optional[SchemaMetadata] = None
    last_synced: Optional[str] = None
```

---

## 8. ALL Claude Code Prompts (Sequential Build Order)

Feed these prompts **in order** to Claude Code. Each builds on the previous.

---

### PROMPT 1 — Project Scaffolding

```
Create a Python project called "queryforge" with this structure:

Root files:
- pyproject.toml using Python 3.11+ with these dependencies:
  fastapi, uvicorn[standard], sqlalchemy[asyncio], asyncpg, alembic,
  aiosqlite, pandas, duckdb, openpyxl, anthropic, google-api-python-client,
  google-auth-oauthlib, gspread, python-jose[cryptography],
  passlib[bcrypt], cryptography, redis[hiredis], python-socketio,
  playwright, pydantic, pydantic-settings, slowapi, loguru, sqlparse,
  httpx, python-multipart
  Dev deps: pytest, pytest-asyncio, httpx, ruff, mypy
- docker-compose.yml with: postgres:15 (port 5432, volume), redis:7 (port 6379)
- .env.example with: DATABASE_URL=postgresql+asyncpg://bi_user:bi_pass@localhost:5432/queryforge,
  REDIS_URL=redis://localhost:6379, ANTHROPIC_API_KEY=sk-ant-xxx,
  JWT_SECRET=change-me-in-production, UPLOAD_DIR=./uploads,
  GOOGLE_CLIENT_ID=, GOOGLE_CLIENT_SECRET=
- Makefile with targets: dev (uvicorn reload), migrate (alembic upgrade head),
  seed, test, lint, docker-up, docker-down
- alembic.ini configured to read DATABASE_URL from env

Backend package structure:
- backend/__init__.py
- backend/main.py: FastAPI app with CORS, lifespan (create tables, redis connect),
  include all routers under /api prefix
- backend/config.py: Pydantic Settings class reading all env vars with defaults
- backend/db/engine.py: create async_engine + async_sessionmaker from DATABASE_URL
- backend/db/base.py: SQLAlchemy DeclarativeBase
- backend/db/session.py: async generator get_db_session for dependency injection
- backend/dependencies.py: get_current_user dependency using JWT

Frontend:
- frontend/ directory with React 18 + TypeScript + Vite + Tailwind CSS
- Dependencies: react-router-dom, zustand, @tanstack/react-query,
  recharts, react-grid-layout, @dnd-kit/core, lucide-react,
  clsx, tailwind-merge, axios, socket.io-client
- Vite proxy: /api → http://localhost:8000

Create the empty folder structure for: backend/models/, backend/schemas/,
backend/api/, backend/services/, backend/services/prompt_engine/,
backend/services/connectors/, backend/middleware/, backend/utils/,
backend/migrations/versions/

Everything should be runnable with:
  docker compose up -d  (postgres + redis)
  make dev              (starts FastAPI on port 8000)
  cd frontend && npm run dev  (starts Vite on port 5173)
```

---

### PROMPT 2 — SQLAlchemy Models & Alembic Migrations

```
In the queryforge project, create all SQLAlchemy ORM models using
SQLAlchemy 2.0 Mapped style with async support:

backend/models/user.py:
- User: id (UUID pk), email (unique index), name, password_hash, created_at
- Relationships: connections, dashboards

backend/models/connection.py:
- DataConnection: id (UUID pk), user_id (FK users CASCADE), name,
  type (string 50: postgres/mysql/sqlite/gdrive/csv/excel/json),
  config (JSONB), schema_cache (JSONB nullable), status (default "active"),
  last_synced (nullable), created_at
- Relationships: user, widgets

backend/models/dashboard.py:
- Dashboard: id (UUID pk), user_id (FK users CASCADE), title, description (Text nullable),
  layout (JSONB default {}), settings (JSONB default {}), is_public (bool default False),
  created_at, updated_at (auto-update)
- Relationships: user, widgets (cascade delete)

backend/models/widget.py:
- Widget: id (UUID pk), dashboard_id (FK dashboards CASCADE),
  connection_id (FK connections nullable), type (string 50),
  title (nullable), prompt_used (Text nullable), query_config (JSONB),
  chart_config (JSONB), layout_position (JSONB), cached_data (JSONB nullable),
  refresh_interval (int default 0), created_at, updated_at
- Relationships: dashboard, connection

backend/models/query_log.py:
- QueryLog: id (UUID pk), user_id (FK), connection_id (FK nullable),
  prompt (Text), generated_query (Text nullable), intent (string 50 nullable),
  execution_ms (int nullable), row_count (int nullable), error (Text nullable),
  created_at

backend/models/__init__.py: import all models

Create Alembic migration that creates all 5 tables with proper constraints,
indexes (email, user_id, dashboard_id), and foreign keys.

Create backend/migrations/env.py that imports all models and uses
async engine from config.
```

---

### PROMPT 3 — Pydantic Schemas (Request/Response Validation)

```
Create all Pydantic v2 schemas for request and response validation:

backend/schemas/user.py:
- UserCreate: email, name, password (min 8 chars)
- UserLogin: email, password
- UserRead: id, email, name, created_at (from_attributes=True)
- TokenResponse: access_token, token_type, user (UserRead)

backend/schemas/connection.py:
- DatabaseConfig: host, port, database, username, password, ssl (bool)
- GDriveConfig: spreadsheet_id, sheet_name, credentials (dict)
- FileConfig: file_path, file_name, file_type
- ColumnMetadata: name, type, is_primary_key, is_foreign_key, sample_values (list[str])
- TableMetadata: name, columns (list[ColumnMetadata]), row_count, relationships
- SchemaMetadata: tables (list[TableMetadata])
- ConnectionCreate: name, type (Literal postgres/mysql/sqlite/gdrive/csv/excel/json), config (dict)
- ConnectionRead: id, name, type, status, schema_cache (optional SchemaMetadata), last_synced, created_at
- ConnectionTest: success (bool), message (str), schema (optional SchemaMetadata)

backend/schemas/dashboard.py:
- DashboardCreate: title, description (optional)
- DashboardRead: id, title, description, layout, settings, is_public, widget_count (int), created_at, updated_at
- DashboardDetail: DashboardRead + widgets (list of WidgetRead)
- LayoutUpdate: widgets (list of dict with id, x, y, w, h)

backend/schemas/widget.py:
- ChartConfig: x_field, y_fields (list[str]), group_field (optional), aggregation,
  colors (list[str]), stacked (bool), show_values (bool), orientation
- LayoutPosition: x, y, w, h, min_w (default 2), min_h (default 2)
- WidgetCreate: dashboard_id, type, title, connection_id, query_config, chart_config, layout_position
- WidgetRead: id, dashboard_id, type, title, prompt_used, chart_config, layout_position, data (optional), created_at
- WidgetUpdate: title (opt), chart_config (opt), layout_position (opt)

backend/schemas/prompt.py:
- PromptRequest: prompt (str), connection_id (optional), dashboard_id (optional)
- QueryInfo: sql, params, execution_ms, row_count
- WidgetResult: id (opt), type, title, prompt_used, query_config, chart_config, layout_position, data (list[dict]), explanation
- PromptResponse: widget (WidgetResult), query_info (QueryInfo), explanation
- PromptExplainRequest: prompt, connection_id (optional)
- PromptExplainResponse: answer, query_used, data (list[dict])
- PromptSuggestResponse: suggestions (list[str])

backend/schemas/query.py:
- QueryRequest: connection_id, sql, params (optional list)
- QueryResult: columns (list[str]), rows (list[dict]), row_count, execution_ms
```

---

### PROMPT 4 — Data Connector Layer (All Connectors)

```
Build the complete data connector layer in backend/services/connectors/.

backend/services/connectors/base.py:
Define an abstract DataConnector protocol:
  class DataConnector(Protocol):
      async def test_connection(self) -> bool: ...
      async def get_schema(self) -> SchemaMetadata: ...
      async def execute_query(self, sql: str, params: list | None = None) -> QueryResult: ...
      async def get_sample_data(self, table: str, limit: int = 20) -> list[dict]: ...
      async def disconnect(self) -> None: ...

backend/services/connectors/factory.py:
- ConnectorFactory.create(conn_type: str, config: dict) → DataConnector
- Maps type string to correct connector class

backend/services/connectors/postgres.py:
- Uses asyncpg connection pool
- get_schema(): queries information_schema.tables + columns + key_column_usage
  for foreign keys. Samples 5 values per column via
  SELECT DISTINCT col FROM table LIMIT 5
- execute_query(): parameterized queries with 30s timeout
- Handles connection errors with retry (3 attempts)

backend/services/connectors/mysql.py:
- Uses aiomysql pool
- Schema introspection via information_schema adapted for MySQL
- Same interface as Postgres

backend/services/connectors/sqlite.py:
- Uses aiosqlite
- Schema from sqlite_master + PRAGMA table_info

backend/services/connectors/csv_connector.py:
- Uses pandas to read the CSV file
- Loads into DuckDB in-memory database: duckdb.connect(':memory:')
- Auto-detects column types by sampling first 100 rows:
  numeric → DOUBLE, date-like strings → DATE, else → VARCHAR
- Register the dataframe: conn.register('table_name', df)
- execute_query runs SQL against DuckDB
- get_schema returns the DuckDB schema

backend/services/connectors/excel_connector.py:
- Uses openpyxl to read .xlsx files
- Each sheet becomes a separate table in DuckDB
- Same DuckDB pattern as CSV connector

backend/services/connectors/json_connector.py:
- Uses pandas.read_json() or json_normalize for nested JSON
- Flattens nested objects (dot notation: address.city → address_city)
- Loads into DuckDB same as CSV

backend/services/connectors/gdrive.py:
- Uses gspread with service account or OAuth credentials
- Reads Google Sheets into pandas DataFrames
- Loads into DuckDB for SQL querying
- Supports listing all spreadsheets in the drive
- Token refresh logic for OAuth

All connectors:
- Cache schema in Redis for 5 minutes (key: schema:{connection_id})
- Return sample values in schema metadata
- Handle errors with typed exceptions: ConnectionError, QueryError, TimeoutError
- Log all queries to QueryLog via a shared utility function
```

---

### PROMPT 5 — Connection Management API

```
Create backend/api/connections.py with FastAPI router for data connections:

POST   /api/connections
  - Body: ConnectionCreate
  - Encrypts sensitive config fields (password, tokens) using AES-256-GCM
    (backend/utils/encryption.py: encrypt_dict / decrypt_dict using JWT_SECRET)
  - Saves to DB, returns ConnectionRead

GET    /api/connections
  - Returns list of user's connections (ConnectionRead[])
  - Includes status and last_synced

GET    /api/connections/{id}
  - Returns ConnectionRead with full schema_cache

PUT    /api/connections/{id}
  - Updates connection config, re-encrypts if needed

DELETE /api/connections/{id}
  - Soft check: warn if widgets depend on this connection

POST   /api/connections/{id}/test
  - Uses ConnectorFactory to create connector, calls test_connection()
  - Returns ConnectionTest with success/error message + schema preview

POST   /api/connections/{id}/sync
  - Force re-fetches schema from the data source
  - Updates schema_cache in DB + Redis cache
  - Returns updated SchemaMetadata

GET    /api/connections/{id}/schema
  - Returns cached SchemaMetadata (from Redis first, then DB)

GET    /api/connections/{id}/preview/{table_name}
  - Returns first 20 rows from the specified table
  - Uses connector.get_sample_data()

Create backend/api/uploads.py:
POST   /api/upload
  - Accepts multipart file upload (CSV, XLSX, JSON)
  - Max 50MB, validated by content type
  - Saves file to UPLOAD_DIR/{user_id}/{filename}
  - Auto-creates a DataConnection with type=csv/excel/json
  - Parses schema immediately and caches it
  - Returns ConnectionRead with schema

Create backend/utils/encryption.py:
  - encrypt_config(config: dict, key: str) → str (base64 encoded)
  - decrypt_config(encrypted: str, key: str) → dict
  - Uses cryptography.fernet or AES-256-GCM

All routes require authentication (Depends(get_current_user)).
Add proper error handling with HTTPException for all failure cases.
```

---

### PROMPT 6 — The Prompt Engine (Core AI Brain)

```
Build the Prompt Engine in backend/services/prompt_engine/. This is the
most critical component — it converts natural language to widgets.

backend/services/prompt_engine/intent_classifier.py:
- classify(prompt: str) → str
  Returns one of: "create_chart", "create_table", "create_kpi",
  "create_filter", "modify_widget", "ask_question"
- Fast path: keyword matching:
  "chart/graph/plot/visualize/trend" → create_chart
  "table/list/show all/show data" → create_table
  "total/count/average/how many/sum" → create_kpi
  "filter/filter by/segment" → create_filter
  "change/modify/update/make it" → modify_widget
- Fallback: call Claude with a short classification prompt

backend/services/prompt_engine/schema_context.py:
- build_context(connection_ids: list[str], db_session) → str
  Fetches SchemaMetadata for all specified connections.
  Formats as a compact string:
    "=== Connection: Sales DB (postgres) ===
     Table: customers (15,230 rows)
       id: integer (PK)
       name: string [samples: 'Acme Corp', 'Globex', 'Initech']
       email: string
       created_at: date
     Table: orders (142,500 rows)
       id: integer (PK)
       customer_id: integer (FK → customers.id)
       amount: number [samples: 99.99, 250.00, 15.50]
       status: string [samples: 'completed', 'pending', 'cancelled']
       order_date: date"
  Keep under 2000 tokens. If too large, prioritize tables mentioned
  in the prompt (fuzzy match table/column names).

backend/services/prompt_engine/query_generator.py:
- async generate(prompt: str, schema_context: str, intent: str) → dict
- Calls Claude API (anthropic SDK, model="claude-sonnet-4-20250514"):

  System prompt:
  """
  You are a SQL query generator for a Business Intelligence system.
  Given a user's natural language request and the database schema below,
  generate a response.

  DATABASE SCHEMA:
  {schema_context}

  RULES:
  1. Generate ONLY SELECT queries. Never INSERT/UPDATE/DELETE/DROP.
  2. Use standard SQL compatible with PostgreSQL.
  3. Always alias columns with human-readable names using AS.
  4. For time series, ORDER BY date ASC.
  5. For rankings/top-N, ORDER BY metric DESC with LIMIT.
  6. For KPIs, return exactly one row with the metric.
  7. Include GROUP BY when using aggregations.
  8. If the request references tables that don't exist in the schema,
     explain what's missing instead of guessing.

  Respond ONLY with valid JSON (no markdown):
  {
    "sql": "SELECT ...",
    "params": [],
    "chart_type": "bar",
    "chart_config": {
      "x_field": "column_alias",
      "y_fields": ["column_alias"],
      "group_field": null,
      "aggregation": "sum",
      "sort_by": "value",
      "sort_order": "desc"
    },
    "title": "Short Descriptive Title",
    "explanation": "Brief explanation of what this query does"
  }
  """

  User message: the prompt text

- Parse JSON response, validate with Pydantic schema
- Retry once if response is malformed
- Raise QueryGenerationError with explanation if Claude says schema is insufficient

backend/services/prompt_engine/chart_recommender.py:
- recommend(data: list[dict], column_types: dict, intent: str) → str
  Analyzes the actual query results to pick the best chart type:
  - len(data) == 1 and has numeric column → "kpi"
  - Has datetime column + numeric → "line"
  - Has 1 categorical + 1 numeric, <15 categories → "bar"
  - Has 1 categorical + 1 numeric, >=15 categories → "table"
  - Has 2 numeric columns → "scatter"
  - Has 1 categorical + 1 numeric summing ~100% → "pie"
  - Many columns or >50 rows → "table"
  Override Claude's suggestion only if data shape clearly indicates otherwise.

backend/services/prompt_engine/widget_builder.py:
- build_widget(prompt, query_result, chart_type, chart_config, title, explanation,
               connection_id, dashboard_id) → WidgetResult
  Assembles the complete widget with:
  - Auto-generated color palette (8 colors)
  - Smart number formatting (detect currency, percentage, large numbers)
  - Default layout: w=6, h=4 for charts; w=12, h=6 for tables; w=3, h=2 for KPIs
  - Auto-position: find next open grid slot

backend/services/prompt_engine/engine.py:
- Main orchestrator class: PromptEngine
  async def process_prompt(self, request: PromptRequest, user_id: str,
                           db_session: AsyncSession) → PromptResponse:
    1. intent = IntentClassifier.classify(request.prompt)
    2. schema_ctx = await SchemaContext.build_context(connection_ids, db_session)
    3. generation = await QueryGenerator.generate(request.prompt, schema_ctx, intent)
    4. Validate SQL with sql_validator.py
    5. Execute query via connector
    6. chart_type = ChartRecommender.recommend(results, column_types, intent)
    7. widget = WidgetBuilder.build_widget(...)
    8. Log to query_logs
    9. If dashboard_id provided, save widget to DB
    10. Return PromptResponse(widget, query_info, explanation)

backend/utils/sql_validator.py:
- validate_sql(sql: str) → bool
  Uses sqlparse to parse the SQL and check:
  - Statement type is SELECT (not INSERT/UPDATE/DELETE/DROP/ALTER/CREATE)
  - No dangerous functions: pg_sleep, pg_read_file, lo_import, COPY, etc.
  - No semicolons (prevent injection of multiple statements)
  - No subqueries that modify data
  Returns True or raises UnsafeQueryError with explanation.
```

---

### PROMPT 7 — Prompt API Routes

```
Create backend/api/prompts.py with the prompt-related endpoints:

POST /api/prompt
  - Body: PromptRequest (prompt, connection_id optional, dashboard_id optional)
  - Calls PromptEngine.process_prompt()
  - If dashboard_id is provided:
    - Auto-saves the widget to that dashboard in the DB
    - Emits WebSocket event "widget:created" to the dashboard room
  - Logs the query to query_logs table
  - Returns PromptResponse

POST /api/prompt/explain
  - Body: PromptExplainRequest (prompt, connection_id optional)
  - Same pipeline but doesn't create a widget
  - Calls Claude with a different system prompt:
    "You are a data analyst. Answer the user's question about their data.
     Provide the SQL query you used, then a clear natural language answer."
  - Returns PromptExplainResponse (answer, query_used, data)

POST /api/prompt/suggest
  - Body: { connection_id: str }
  - Reads the schema for that connection
  - Generates 8-10 prompt suggestions based on the schema:
    Uses Claude: "Given this schema, suggest 10 interesting BI questions
    a business user might ask. Format as a JSON array of strings."
  - Cache suggestions in Redis for 10 minutes
  - Returns PromptSuggestResponse

POST /api/prompt/modify
  - Body: { widget_id: str, modification_prompt: str }
  - Fetches the existing widget from DB (including its original query)
  - Sends to Claude: "Here is an existing query: {sql}. The user wants
    to modify it: {modification_prompt}. Generate the updated query."
  - Re-executes, rebuilds widget, updates DB
  - Returns PromptResponse with updated widget

Set up python-socketio in backend/main.py:
  - Create AsyncServer with async_mode="asgi"
  - Mount as ASGI app alongside FastAPI
  - Namespace: /dashboard
  - Events: connect (join dashboard room), disconnect
  - Server emits: widget:created, widget:updated, widget:deleted,
    widget:moved, dashboard:layout_changed
  - Auth: verify JWT from connection headers
```

---

### PROMPT 8 — Dashboard & Widget CRUD APIs

```
Create backend/api/dashboards.py:

POST   /api/dashboards
  - Body: DashboardCreate (title, description)
  - Creates dashboard with empty layout, returns DashboardRead

GET    /api/dashboards
  - Returns list of user's dashboards
  - Include widget_count computed from relationship
  - Sort by updated_at DESC

GET    /api/dashboards/{id}
  - Returns DashboardDetail (dashboard + all widgets with their cached_data)
  - Verify user owns this dashboard (or is_public=True)

PUT    /api/dashboards/{id}
  - Update title, description, settings

PUT    /api/dashboards/{id}/layout
  - Body: LayoutUpdate (list of {widget_id, x, y, w, h})
  - Batch updates all widget layout_positions in one transaction
  - Emit WebSocket "dashboard:layout_changed"

DELETE /api/dashboards/{id}
  - Cascade deletes all widgets

POST   /api/dashboards/{id}/duplicate
  - Deep clone: new dashboard + copies of all widgets
  - Returns new DashboardRead

POST   /api/dashboards/{id}/export
  - Body: { format: "pdf" | "png" }
  - Uses backend/services/export_service.py:
    - Launches Playwright headless Chromium
    - Navigates to /dashboard/{id}?export=true (hides UI chrome)
    - Waits for all charts to render (wait_for_selector ".recharts-wrapper")
    - PDF: page.pdf(landscape=True, format="A4")
    - PNG: page.screenshot(full_page=True)
  - Returns file as streaming response

POST   /api/dashboards/{id}/share
  - Toggle is_public, return share URL: /public/dashboard/{id}

GET    /api/public/dashboard/{id}
  - No auth required, returns DashboardDetail if is_public=True

Create backend/api/widgets.py:

POST   /api/widgets
  - Body: WidgetCreate
  - Manual widget creation (not from prompt)
  - Returns WidgetRead

GET    /api/widgets/{id}
  - Returns WidgetRead with current data

PUT    /api/widgets/{id}
  - Body: WidgetUpdate (partial update)

PUT    /api/widgets/{id}/position
  - Update just layout_position (x, y, w, h)
  - Emit WebSocket "widget:moved"

DELETE /api/widgets/{id}
  - Delete widget, emit WebSocket "widget:deleted"

POST   /api/widgets/{id}/refresh
  - Re-execute the widget's stored query against its connection
  - Update cached_data
  - Return WidgetRead with fresh data

Create backend/api/queries.py:

POST   /api/query/execute
  - Body: QueryRequest (connection_id, sql, params)
  - Validate SQL (SELECT only)
  - Execute via connector with 30s timeout, max 10000 rows
  - Log to query_logs
  - Return QueryResult

GET    /api/query/history
  - Returns user's last 50 queries from query_logs
  - Include prompt, generated_query, execution_ms, row_count, created_at
```

---

### PROMPT 9 — Authentication System

```
Build the complete auth system:

backend/services/auth_service.py:
- hash_password(password: str) → str using passlib bcrypt (rounds=12)
- verify_password(password: str, hash: str) → bool
- create_access_token(user_id: str, email: str, expires_delta: timedelta = 24h) → str
  Uses python-jose with HS256 algorithm
- decode_token(token: str) → dict (raises HTTPException 401 if invalid/expired)

backend/middleware/auth.py:
- get_current_user dependency:
  Extracts Bearer token from Authorization header
  Decodes and validates JWT
  Fetches user from DB
  Returns User object

backend/api/auth.py:

POST /api/auth/register
  - Body: UserCreate
  - Check email doesn't exist
  - Hash password, create user
  - Return TokenResponse (access_token + UserRead)

POST /api/auth/login
  - Body: UserLogin
  - Verify email + password
  - Return TokenResponse

GET /api/auth/me
  - Returns current UserRead (from JWT)

PUT /api/auth/me
  - Update name, email

Apply auth middleware to ALL routes except:
  /api/auth/register, /api/auth/login, /api/public/*

Add rate limiting with slowapi:
  - Auth endpoints: 10/minute
  - Prompt endpoint: 30/minute
  - Query endpoint: 60/minute
  - General: 200/minute
```

---

### PROMPT 10 — Frontend: App Shell & State Management

```
Build the React frontend app shell in frontend/src/:

App.tsx:
- React Router v6 with routes:
  /auth → Login/Register page
  / → Dashboard list (protected)
  /dashboard/:id → Canvas view (protected)
  /connections → Connection management (protected)
  /explore → Prompt-first exploration (protected)
- Layout: collapsible sidebar + top header + main content area
- ProtectedRoute wrapper that redirects to /auth if not logged in

State Management (Zustand):

stores/authStore.ts:
  state: user, token, isAuthenticated
  actions: login(email, pw), register(email, name, pw), logout, loadUser
  Stores token in memory (not localStorage for security)

stores/dashboardStore.ts:
  state: dashboards[], currentDashboard, widgets[]
  actions: fetchDashboards, createDashboard, setCurrentDashboard,
    addWidget, removeWidget, updateWidgetPosition, updateWidgetConfig,
    batchUpdateLayout, saveDashboard

stores/connectionStore.ts:
  state: connections[], currentConnection, schemas (map of id→SchemaMetadata)
  actions: fetchConnections, createConnection, deleteConnection,
    testConnection, syncSchema, fetchSchema

stores/promptStore.ts:
  state: history[], suggestions[], isProcessing, lastResult (WidgetResult)
  actions: sendPrompt, fetchSuggestions, clearLastResult

lib/api.ts:
  Axios instance with baseURL "/api"
  Request interceptor: attach Bearer token from authStore
  Response interceptor: on 401, redirect to /auth
  Type-safe wrapper functions for every endpoint

hooks/useWebSocket.ts:
  Connect to Socket.IO /dashboard namespace on mount
  Join room for current dashboard ID
  Listen for: widget:created, widget:updated, widget:deleted,
    widget:moved, dashboard:layout_changed
  Update Zustand store on each event
```

---

### PROMPT 11 — Frontend: Prompt Bar Component

```
Build the PromptBar in frontend/src/components/prompt/:

PromptBar.tsx:
- Full-width input bar with a modern design:
  - Left: data source selector dropdown (list of user's connections,
    plus "Auto-detect" option)
  - Center: large text input, placeholder "Ask anything about your data..."
  - Right: Send button (arrow icon) + loading spinner when processing
- Submit on Enter key or click send
- Keyboard shortcut: Cmd+K / Ctrl+K focuses the prompt bar globally
- While processing: show animated pulsing dots in the send button area
- After result arrives, show a result preview card directly below:
  - Chart type icon + title + "12 rows, 0.045s"
  - Mini preview of the chart/table (thumbnail sized)
  - Two buttons: "Add to Dashboard" (primary) + "Explore" (secondary)
  - "Add to Dashboard" adds the widget to the current dashboard canvas
    at the next available grid position
- Prompt history dropdown (click clock icon):
  - Shows last 20 prompts
  - Click to re-run with the same connection
  - Clear history button

PromptSuggestions.tsx:
- Shows when the prompt bar is focused but empty
- Fetches suggestions from /api/prompt/suggest for the selected connection
- Display as clickable chips in categories:
  "📊 Trends": "Monthly revenue trend", "User signups over time"
  "📈 Rankings": "Top 10 customers by revenue", "Best selling products"
  "🔢 Metrics": "Total revenue this quarter", "Average order value"
  "📋 Data": "Show all orders from last month", "Customer list with emails"
- Click a suggestion → fills the prompt bar and auto-submits

PromptHistory.tsx:
- Dropdown list of previous prompts
- Shows: prompt text, chart type icon, timestamp, connection name
- Click to re-run or click copy icon to copy prompt text

Style with Tailwind: glass-morphism effect (backdrop-blur), subtle shadow,
rounded-xl, smooth focus animations. Use a gradient border on focus.
```

---

### PROMPT 12 — Frontend: Dashboard Canvas (Drag & Drop Grid)

```
Build the Dashboard Canvas in frontend/src/components/canvas/:

DashboardCanvas.tsx:
- Uses react-grid-layout (ResponsiveGridLayout)
- Grid config: 24 columns, rowHeight=40px, gap=8px
- Responsive breakpoints: lg=1200px (24 cols), md=996 (16), sm=768 (8), xs=480 (4)
- Vertical compaction enabled (widgets settle to top)
- Prevent overlap = true
- Each widget rendered inside WidgetWrapper
- Background: subtle dot grid pattern (CSS background-image) visible
  only when dragging/resizing
- Empty state (no widgets):
  Centered: large "+" icon, "Create your first widget"
  Below: 4 example prompt chips user can click to create instantly
- On layout change: debounce 2 seconds, then PUT /api/dashboards/:id/layout
  with all widget positions

WidgetWrapper.tsx:
- Container for each widget with:
  - Title bar: drag handle (grip dots icon), editable title (double-click
    to edit inline), connection badge (small colored dot)
  - Three-dot menu (top right): Edit Config, Change Chart Type,
    Duplicate, Refresh Data, Download CSV, Download PNG, Delete
  - Resize handle: bottom-right corner (diagonal lines icon)
  - States:
    - Normal: light border, shadow-sm
    - Hover: blue border, shadow-md
    - Selected (clicked): blue-500 border 2px, shadow-lg, show action menu
    - Loading: semi-transparent overlay with spinner
    - Error: red border, error message with "Retry" button
  - Click outside deselects
  - Delete key on selected widget → confirm dialog → delete

CanvasToolbar.tsx:
- Horizontal bar above the canvas:
  Left section:
  - Dashboard title (editable inline, auto-saves)
  - "Saved" / "Saving..." / "Unsaved" status badge
  Center section:
  - "Add Text" button → creates a TextWidget at next available spot
  - "Add Filter" button → creates a FilterWidget
  Right section:
  - Undo / Redo buttons (track layout history with a stack)
  - Grid toggle (show/hide grid lines)
  - Share button → modal with public link toggle
  - Export dropdown: "Download PDF", "Download PNG"
  - Settings gear → dashboard settings modal (theme, auto-refresh interval)

Implement auto-save:
- Track layout changes in a ref
- Debounce 2 seconds
- Call PUT /api/dashboards/:id/layout
- Show "Saving..." badge during save, "Saved ✓" after success
```

---

### PROMPT 13 — Frontend: Widget Components & Charts

```
Build all widget renderers in frontend/src/components/widgets/ and charts/:

WidgetRenderer.tsx:
- Props: widget (WidgetRead object)
- Switch on widget.type:
  bar/line/pie/area/scatter/heatmap → <ChartWidget type={widget.type} ... />
  table → <TableWidget ... />
  kpi → <KPIWidget ... />
  text → <TextWidget ... />
  filter → <FilterWidget ... />
- Pass data, chartConfig, title as props

ChartWidget.tsx:
- Container that renders the correct Recharts chart
- Props: type, data, chartConfig, onChartClick
- Responsive: uses ResponsiveContainer from Recharts
- Common features across all charts:
  - Animated entrance (isAnimationActive=true)
  - Tooltip on hover showing exact values
  - Legend (toggleable via chartConfig.legend)
  - Consistent color palette from dashboard theme

Chart components (each file, using Recharts):

charts/BarChart.tsx:
- Vertical and horizontal orientation
- Stacked or grouped mode
- Custom bar colors from chartConfig.colors
- Click on a bar → emit filter event

charts/LineChart.tsx:
- Smooth curves (type="monotone") or linear
- Multi-line support (multiple y_fields)
- Optional area fill beneath lines
- Dot markers on data points

charts/PieChart.tsx:
- Donut variant (innerRadius=60%)
- Custom colors
- Labels showing percentage
- Click slice → emit filter

charts/AreaChart.tsx:
- Stacked area or layered
- Gradient fill (linearGradient in defs)
- Responsive

charts/ScatterPlot.tsx:
- Dot size can encode a third variable
- Optional trend line (linear regression)

charts/Heatmap.tsx:
- Use Recharts or custom SVG
- Color scale (green→yellow→red)
- Cell labels with values

TableWidget.tsx:
- Built with native HTML table + Tailwind styling
- Features:
  - Sortable columns (click header → sort asc/desc, arrow indicator)
  - Column filtering (small search input per column header)
  - Pagination (25/50/100 rows per page)
  - Sticky header (position: sticky)
  - Alternating row colors (even:bg-gray-50)
  - Number formatting: commas for thousands, 2 decimal places,
    currency prefix ($) if detected, percentage suffix (%) if detected
  - Compact mode for small widget sizes

KPIWidget.tsx:
- Large centered number with formatting
- Title above, subtitle below (optional)
- Trend indicator: up arrow (green) or down arrow (red) with % change
- Optional sparkline chart behind the number (small LineChart)
- Adapts font size to widget size

TextWidget.tsx:
- Rich text editor using contentEditable
- Toolbar: Bold, Italic, H1, H2, Link, Bullet list
- Saves content as HTML string in widget config
- Used for dashboard titles, section headers, annotations

FilterWidget.tsx:
- Renders as a dropdown, date range picker, or search input
  based on the column type it's filtering
- When value changes:
  - Update global filter state in dashboardStore
  - Re-query all widgets on the same dashboard that share the connection
  - Append WHERE clause to each widget's query
```

---

### PROMPT 14 — Frontend: Connections Page & File Upload

```
Build frontend/src/routes/connections.tsx and components/connections/:

connections.tsx (route page):
- Two-column layout:
  Left (40%): Connection list
    - Each connection card shows:
      Icon (database/file/google-drive based on type)
      Name, type badge, status dot (green=active, red=error)
      Last synced time, table count
    - "Add Connection" button at top
  Right (60%): Selected connection details / add new form
    - When connection selected: show schema explorer
    - When "Add New" clicked: show ConnectionForm wizard

ConnectionForm.tsx:
- Multi-step wizard:
  Step 1: Choose type
    Grid of cards: PostgreSQL, MySQL, SQLite,
    Google Sheets, CSV Upload, Excel Upload, JSON Upload
    Each card: icon + name + brief description
  Step 2: Configure (dynamic per type)
    DatabaseConnector for SQL databases
    GoogleDriveConnector for Sheets
    FileUploader for CSV/Excel/JSON
  Step 3: Test connection
    "Test" button → loading → green checkmark / red X with error
  Step 4: Review schema
    Show discovered tables and columns in a tree
  Step 5: Name and save
    Name input, "Save Connection" button

DatabaseConnector.tsx:
- Form fields: Host, Port (default per type), Database Name,
  Username, Password, SSL toggle
- Per-type defaults: Postgres port 5432, MySQL port 3306
- "Test Connection" button (calls POST /api/connections/test)
- Show inline validation errors

GoogleDriveConnector.tsx:
- "Sign in with Google" button → opens OAuth popup
- After auth: shows list of user's Google Spreadsheets
  (checkboxes to select which to import)
- Preview selected sheet data (first 5 rows)
- "Import Selected" button

FileUploader.tsx:
- Large drag-and-drop zone with dashed border
- Accept: .csv, .xlsx, .xls, .json
- Max 50MB label
- On drop/select:
  - Show upload progress bar
  - After upload: show auto-detected schema
  - Column list with detected types (editable dropdowns)
  - Preview first 10 rows
  - "Create Connection" button

SchemaExplorer.tsx:
- Collapsible tree view:
  Connection name
  └── Table name (row count)
      ├── column_name: type [PK/FK icon]
      ├── column_name: type
      └── ...
- Hover on column → tooltip with sample values
- Click table → modal with full data preview (20 rows)
- Right-click table → "Create prompt from this table"
  → navigates to explore page with pre-filled prompt
```

---

### PROMPT 15 — Frontend: Explore Page (Prompt-First Data Exploration)

```
Build frontend/src/routes/explore.tsx:

Layout: Full height, three sections stacked:

Top: PromptBar (full width, same component as dashboard view)

Middle: Two-panel view:
  Left panel (25%): Schema Browser
    - Collapsible tree of all connections → tables → columns
    - Click table name → auto-fills prompt: "Show me data from {table}"
    - Click column → adds to prompt context
    - Search box at top to filter tables/columns
    - Drag a table name into the prompt bar (bonus feature)

  Right panel (75%): Results Area
    - Conversation-style layout: each prompt+result stacks vertically
    - Each result card shows:
      - The prompt text (with copy button)
      - Generated SQL (collapsible code block, syntax highlighted)
      - Execution stats: "12 rows • 45ms • postgres:sales_db"
      - The visualization (chart or table, full width)
      - Action bar below:
        "Add to Dashboard" → dropdown to pick which dashboard
        "Modify" → small input "Change this to..." for iterative refinement
        "Show as Table" / "Show as Chart" toggle
        "Download CSV" button
        "Download PNG" button
    - Scroll down to see history of prompts in this session

Bottom: Quick suggestion bar
  - "Try asking:" followed by clickable chips
  - Refreshes based on which connection is selected

State:
- Keep an array of {prompt, result} pairs in promptStore
- New prompts add to the top (or bottom, conversation style)
- Modify prompts reference the previous result's widget_id

The explore page is for ad-hoc data exploration.
The dashboard page is for building persistent dashboards.
Both share the same PromptBar and widget rendering components.
```

---

### PROMPT 16 — Frontend: Login/Register + Protected Routes

```
Build frontend/src/routes/auth.tsx:

Clean, centered auth page with two tabs: "Login" and "Register"

Login tab:
- Email input
- Password input
- "Log In" button (primary, full width)
- Loading state while authenticating
- Error message display (invalid credentials, etc.)

Register tab:
- Name input
- Email input
- Password input (min 8 chars, show strength indicator)
- Confirm password input
- "Create Account" button
- Loading state

After successful login/register:
- Store token in authStore (memory)
- Redirect to / (dashboard list)

ProtectedRoute component:
- Wraps routes that require auth
- Checks authStore.isAuthenticated
- If not authenticated, redirect to /auth
- Show loading spinner while checking token validity
  (call GET /api/auth/me on app load)

Add to App.tsx:
- On app mount, check if token exists → call /api/auth/me
- If valid, set user + isAuthenticated
- If invalid/expired, clear store, show login

Style: minimal, elegant design with subtle background pattern.
Card centered on page with shadow. Brand logo/name at top.
```

---

### PROMPT 17 — Theming, Dark Mode, Polish

```
Apply final UI polish across the entire frontend:

tailwind.config.ts:
- Custom colors:
  primary: { 50-900 shades of deep navy blue #0f2b46 }
  accent: { 50-900 shades of teal #0d9488 }
  surface: { light: slate-50, dark: slate-900 }
- Chart colors palette: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"]
- Font: "Inter" for body, "JetBrains Mono" for code/SQL
- Consistent border-radius: 8px cards, 6px inputs, full for buttons

Dark mode:
- Toggle button in Header (sun/moon icon)
- Tailwind "dark:" variants throughout all components
- Charts: adapt grid lines, text colors, backgrounds for dark theme
- Store preference in localStorage, respect system preference on first visit

Loading states:
- Skeleton loaders: animated shimmer placeholders for:
  Widget cards while loading, dashboard list, schema tree
- Prompt processing: animated gradient bar + "Analyzing your data..." text
- File upload: progress bar with percentage

Error handling:
- Toast notifications (bottom-right corner):
  Success (green), Error (red), Warning (amber), Info (blue)
  Auto-dismiss after 5 seconds, click to dismiss
- Widget-level errors: red border + error icon + "Retry" button
- Connection errors: banner at top of page
- Network offline detection: "You're offline" banner

Animations:
- Page transitions: fade-in (200ms)
- Widget appearing on canvas: scale-in animation
- Sidebar: slide transition when toggling
- Modal: fade + scale
- Charts: entrance animations (Recharts isAnimationActive)

Responsive:
- Dashboard grid: 24 cols → 16 → 8 → single column
- Sidebar: full sidebar → icon-only → hidden (hamburger menu)
- Prompt bar: adapts to width
- Modals: full-screen on mobile

Keyboard shortcuts (show with ? key):
- Cmd+K: Focus prompt bar
- Cmd+S: Save dashboard
- Delete: Remove selected widget
- Cmd+Z: Undo layout change
- Cmd+Shift+Z: Redo
- Escape: Deselect / close modal
```

---

### PROMPT 18 — Docker & Deployment

```
Create production-ready Docker setup:

docker-compose.yml:
  services:
    postgres:
      image: postgres:15-alpine
      environment: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
      volumes: postgres_data:/var/lib/postgresql/data
      healthcheck: pg_isready
      ports: "5432:5432"

    redis:
      image: redis:7-alpine
      volumes: redis_data:/data
      ports: "6379:6379"

    backend:
      build: ./backend.Dockerfile
      depends_on: postgres (healthy), redis
      environment: all env vars
      ports: "8000:8000"
      command: >
        sh -c "alembic upgrade head && uvicorn backend.main:app --host 0.0.0.0 --port 8000"

    frontend:
      build: ./frontend.Dockerfile
      depends_on: backend
      ports: "80:80"

backend.Dockerfile (multi-stage):
  Stage 1 (builder): python:3.11-slim, install deps with pip
  Stage 2 (prod): python:3.11-slim, copy installed packages,
    non-root user, HEALTHCHECK curl localhost:8000/api/health

frontend.Dockerfile (multi-stage):
  Stage 1: node:20-alpine, npm ci, npm run build
  Stage 2: nginx:alpine, copy dist, copy nginx.conf

nginx.conf:
  - SPA fallback: try_files $uri /index.html
  - Proxy /api → backend:8000
  - Proxy /socket.io → backend:8000
  - Gzip on, cache static assets 1 year

docker-compose.dev.yml (override for development):
  - backend: volume mount ./backend, uvicorn --reload
  - frontend: volume mount ./frontend/src, Vite dev server
  - Expose debug ports

Add to backend/api/router.py:
  GET /api/health → { "status": "ok", "db": true/false, "redis": true/false }

Create .env.example with all variables documented with comments.

README.md:
  - Project overview (what it does)
  - Architecture diagram (ASCII)
  - Quick start: docker compose up
  - Development setup:
    1. Clone repo
    2. docker compose -f docker-compose.dev.yml up -d (DB + Redis)
    3. cd backend && pip install -e . && make migrate && make dev
    4. cd frontend && npm install && npm run dev
  - Environment variables reference table
  - API documentation link
  - Screenshots placeholder
```

---

## 9. Tech Stack Summary

| Layer | Technology | Why |
|---|---|---|
| **Backend Framework** | FastAPI (async) | Fastest Python web framework, auto-docs, Pydantic native |
| **ORM** | SQLAlchemy 2.0 (async) | Industry standard, async support, migration-ready |
| **Migrations** | Alembic | SQLAlchemy's official migration tool |
| **App Database** | PostgreSQL 15 | JSONB for widget configs, robust, production-grade |
| **Cache** | Redis 7 | Schema cache, rate limits, session data |
| **AI Engine** | Claude API (anthropic SDK) | NL → SQL, intent classification, suggestions |
| **Data Processing** | Pandas + DuckDB | Pandas for ETL, DuckDB for SQL on files |
| **File Connectors** | openpyxl, csv, json | Native Python libraries for all file types |
| **Google Integration** | gspread + google-api | Google Sheets/Drive access |
| **Auth** | python-jose + passlib | JWT tokens + bcrypt password hashing |
| **Encryption** | cryptography (Fernet) | AES-256 for connection secrets |
| **Realtime** | python-socketio | WebSocket for live dashboard updates |
| **Export** | Playwright | Headless browser for PDF/PNG screenshots |
| **Rate Limiting** | slowapi | Per-endpoint rate limits |
| **Logging** | loguru | Better Python logging |
| **SQL Safety** | sqlparse | Parse and validate generated SQL |
| **Frontend** | React 18 + TypeScript | Component-based UI |
| **Styling** | Tailwind CSS 3 | Utility-first, dark mode built-in |
| **Charts** | Recharts | React-native charting library |
| **Grid Layout** | react-grid-layout | Drag-drop dashboard canvas |
| **State** | Zustand | Lightweight, no boilerplate |
| **Data Fetching** | TanStack React Query | Caching, background refresh |
| **Container** | Docker + Docker Compose | One-command deployment |

---

## 10. Development Phases

| Phase | Duration | Deliverables |
|---|---|---|
| **Phase 1: Foundation** | Week 1-2 | Scaffolding, DB models, auth, Postgres connector, basic prompt engine |
| **Phase 2: Core BI** | Week 3-4 | Full prompt engine, all chart types, dashboard canvas, widget CRUD |
| **Phase 3: Data Sources** | Week 5-6 | CSV/Excel/JSON/Google Drive connectors, file upload, connection UI |
| **Phase 4: Polish** | Week 7-8 | Dark mode, export, sharing, responsive, Docker deployment, testing |

---

## 11. Data Flow: Prompt to Dashboard Widget

```
User types: "Show top 10 customers by revenue as a bar chart"
  │
  ├─ POST /api/prompt { prompt, connection_id, dashboard_id }
  │
  ├─ IntentClassifier: "chart/bar" keywords → "create_chart"
  │
  ├─ SchemaContext builds:
  │   "Table: customers(id INT PK, name VARCHAR, email VARCHAR)
  │    Table: orders(id INT PK, customer_id INT FK→customers.id,
  │           amount DECIMAL [99.99, 250.00], status VARCHAR
  │           [completed, pending], order_date DATE)"
  │
  ├─ QueryGenerator → Claude API returns:
  │   {
  │     "sql": "SELECT c.name AS customer, SUM(o.amount) AS revenue
  │             FROM customers c JOIN orders o ON o.customer_id = c.id
  │             WHERE o.status = 'completed'
  │             GROUP BY c.name ORDER BY revenue DESC LIMIT 10",
  │     "chart_type": "bar",
  │     "chart_config": {"x_field":"customer", "y_fields":["revenue"]},
  │     "title": "Top 10 Customers by Revenue"
  │   }
  │
  ├─ sql_validator: ✓ SELECT only, no dangerous functions
  │
  ├─ Execute via PostgresConnector: 10 rows, 45ms
  │
  ├─ ChartRecommender: confirms "bar" (categorical + numeric)
  │
  ├─ WidgetBuilder: creates Widget with data + config + layout {x:0,y:0,w:6,h:4}
  │
  ├─ Save to DB (widgets table), emit WebSocket "widget:created"
  │
  └─ Frontend receives widget → renders BarChart on canvas
```

# Phase 1 — Infrastructure and Configuration

> **Document Purpose**: Define Docker Compose setup, environment variables, database initialization, port allocations, and deployment configuration. An AI coding agent should be able to create all infrastructure files from this document alone.

---

## 1. Infrastructure Overview

Phase 1 runs entirely on a single machine using Docker Compose with three containers:

| Container | Image | Port | Purpose |
|---|---|---|---|
| `cognitwin-db` | `postgres:15-alpine` | 5432 | PostgreSQL database |
| `cognitwin-backend` | Custom (Dockerfile) | 8000 | FastAPI backend |
| `cognitwin-frontend` | Custom (Dockerfile) | 3000 | Next.js frontend |

### Why Docker Compose (Not Bare Metal)

1. **Reproducibility**: `docker-compose up` works identically on Windows, Mac, and Linux.
2. **Isolation**: PostgreSQL doesn't need to be installed on the host machine.
3. **Single command startup**: Demo-ready with one command.
4. **Environment parity**: Dev environment matches future production.

### Why NOT Kubernetes

Kubernetes adds orchestration complexity (pod specs, services, ingress controllers) that provides zero value for a single-machine deployment. Docker Compose is the correct tool for Phase 1.

---

## 2. Docker Compose Configuration

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    container_name: cognitwin-db
    environment:
      POSTGRES_DB: cognitwin
      POSTGRES_USER: cognitwin_user
      POSTGRES_PASSWORD: <your_secure_password>
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/scripts/init_db.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cognitwin_user -d cognitwin"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: cognitwin-backend
    environment:
      DATABASE_URL: postgresql+asyncpg://cognitwin_user:<password>@db:5432/cognitwin
      DATABASE_READONLY_URL: postgresql+asyncpg://cognitwin_readonly:<password>@db:5432/cognitwin
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      ML_MODELS_DIR: /app/ml_models
      UPLOAD_DIR: /app/uploads
      LOG_LEVEL: INFO
      CORS_ORIGINS: '["http://localhost:3000"]'
    ports:
      - "8000:8000"
    volumes:
      - ml_models:/app/ml_models
      - uploads:/app/uploads
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: cognitwin-frontend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000/api/v1
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  ml_models:
  uploads:
```

### Key Design Decisions

1. **Named volumes** for database data, ML models, and uploads. This persists data across container restarts.
2. **Health check on database** with `depends_on: condition: service_healthy` ensures the backend doesn't start until PostgreSQL is ready. This prevents connection errors on first startup.
3. **`GEMINI_API_KEY` from host environment** (`${GEMINI_API_KEY}`). The user sets this in their shell or `.env` file. It is NOT hardcoded in docker-compose.yml.
4. **Backend connects to `db`** (Docker DNS name), not `localhost`. Docker Compose creates a network where services reference each other by name.

---

## 3. Backend Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Prophet and psycopg
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e ".[dev]"

# Copy source code
COPY . .

# Create directories for models and uploads
RUN mkdir -p /app/ml_models /app/uploads

# Run database migrations and start server
CMD ["sh", "-c", "alembic upgrade head && python -m src.seed.load_seeds && uvicorn src.main:app --host 0.0.0.0 --port 8000"]
```

### Why `python:3.11-slim` (Not Alpine)

Prophet and numpy have C extensions that compile against glibc. Alpine uses musl libc, which causes compilation failures or requires manual workarounds. `slim` is the pragmatic choice.

### Startup Sequence

The CMD runs three commands in sequence:
1. `alembic upgrade head` — Run any pending database migrations
2. `python -m src.seed.load_seeds` — Load seed data (idempotent, skips if data exists)
3. `uvicorn src.main:app` — Start the FastAPI server

This ensures the database is always up-to-date and seeded before the API starts accepting requests.

---

## 4. Frontend Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build not needed for dev mode
# For production: RUN npm run build

# Start development server
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
```

### Why Dev Mode (Not Production Build) in Phase 1

Phase 1 is a development prototype. Running in dev mode provides:
- Hot module replacement (fast iteration)
- Better error messages
- No build step during Docker build (faster container startup)

For demo or production, change CMD to `npm run build && npm start`.

---

## 5. Database Initialization Script

### `backend/scripts/init_db.sql`

This script runs ONCE when the PostgreSQL container is first created (via Docker's `docker-entrypoint-initdb.d` mechanism):

```sql
-- Create read-only role for LLM query execution
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cognitwin_readonly') THEN
        CREATE ROLE cognitwin_readonly WITH LOGIN PASSWORD '<password>';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE cognitwin TO cognitwin_readonly;
GRANT USAGE ON SCHEMA public TO cognitwin_readonly;

-- The GRANT SELECT on tables happens AFTER Alembic creates them.
-- This is handled by a post-migration step in the Alembic env.py.
```

### Why a Separate Init Script

Alembic handles table creation, but **role creation** is a database-level operation that should happen before any migration runs. Docker's init mechanism ensures this runs exactly once on first container creation.

---

## 6. Environment Variables — Complete Catalog

### Backend Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | SQLAlchemy async connection string for read-write operations |
| `DATABASE_READONLY_URL` | Yes | — | SQLAlchemy async connection string for read-only operations (LLM queries) |
| `GEMINI_API_KEY` | Yes | — | Google Gemini API key |
| `GEMINI_MODEL_NAME` | No | `gemini-2.0-flash` | Gemini model name to use |
| `ML_MODELS_DIR` | No | `./ml_models` | Directory to store trained ML models |
| `UPLOAD_DIR` | No | `./uploads` | Temporary directory for uploaded files |
| `MAX_UPLOAD_SIZE_MB` | No | `50` | Maximum CSV file size in MB |
| `MAX_UPLOAD_ROWS` | No | `100000` | Maximum rows per CSV upload |
| `FORECAST_HORIZON_MAX_DAYS` | No | `90` | Maximum forecast horizon |
| `FORECAST_MIN_DATA_POINTS` | No | `30` | Minimum data points for training |
| `QUERY_RATE_LIMIT` | No | `10` | Max NL queries per minute |
| `QUERY_TIMEOUT_SECONDS` | No | `10` | SQL execution timeout for LLM queries |
| `LOG_LEVEL` | No | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `CORS_ORIGINS` | No | `["http://localhost:3000"]` | Allowed CORS origins (JSON array) |
| `API_PREFIX` | No | `/api/v1` | API URL prefix |
| `DB_POOL_SIZE` | No | `5` | Database connection pool size |
| `DB_MAX_OVERFLOW` | No | `10` | Max overflow connections above pool size |

### Frontend Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8000/api/v1` | Backend API base URL |

### `.env.example` (Backend)

```env
# Database
DATABASE_URL=postgresql+asyncpg://<username>:<password>@localhost:5432/<dbname>
DATABASE_READONLY_URL=postgresql+asyncpg://<readonly_username>:<password>@localhost:5432/<dbname>

# LLM
GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL_NAME=gemini-2.0-flash

# ML
ML_MODELS_DIR=./ml_models

# Server
LOG_LEVEL=DEBUG
CORS_ORIGINS=["http://localhost:3000"]
```

---

## 7. Development Setup Without Docker

For developers who prefer running services directly:

### Prerequisites

1. Python 3.11+ installed
2. Node.js 20+ installed
3. PostgreSQL 15+ running on localhost:5432
4. Database `cognitwin` created with user `cognitwin_user`

### Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # or .venv\Scripts\activate on Windows
pip install -e ".[dev]"
cp .env.example .env             # Edit with actual GEMINI_API_KEY
alembic upgrade head             # Run migrations
python -m src.seed.load_seeds    # Load seed data
uvicorn src.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local  # Usually no changes needed
npm run dev                        # Starts on port 3000
```

---

## 8. Port Allocations

| Service | Port | Protocol | Notes |
|---|---|---|---|
| PostgreSQL | 5432 | TCP | Standard PostgreSQL port |
| FastAPI Backend | 8000 | HTTP | Uvicorn default for dev |
| Next.js Frontend | 3000 | HTTP | Next.js default |

All ports are exposed to `localhost` only. No public exposure in Phase 1.

---

## 9. Python Dependencies (`pyproject.toml`)

```toml
[project]
name = "cognitwin-backend"
version = "0.1.0"
requires-python = ">=3.11"

dependencies = [
    "fastapi>=0.104.0",
    "uvicorn[standard]>=0.24.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.29.0",
    "alembic>=1.13.0",
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",
    "pandas>=2.1.0",
    "prophet>=1.1.5",
    "google-generativeai>=0.3.0",
    "python-multipart>=0.0.6",
    "chardet>=5.2.0",
    "rapidfuzz>=3.5.0",
    "python-json-logger>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.25.0",
    "pytest-cov>=4.1.0",
    "ruff>=0.1.0",
]
```

### Dependency Justifications

| Package | Purpose | Why This One |
|---|---|---|
| `fastapi` | Web framework | See architecture doc |
| `uvicorn[standard]` | ASGI server | Standard FastAPI server, `standard` extras include lifespan support |
| `sqlalchemy[asyncio]` | ORM | See architecture doc. `asyncio` extras for async support |
| `asyncpg` | PostgreSQL async driver | Fastest Python PostgreSQL async driver |
| `alembic` | Database migrations | Standard SQLAlchemy migration tool |
| `pydantic` | Data validation | Built into FastAPI, used for request/response schemas |
| `pydantic-settings` | Config management | Loads env vars into typed Settings class |
| `pandas` | Data manipulation | CSV parsing, data cleaning, aggregation |
| `prophet` | Time-series forecasting | See ML forecasting doc |
| `google-generativeai` | Gemini API SDK | Official Google SDK |
| `python-multipart` | File upload parsing | Required by FastAPI for `UploadFile` |
| `chardet` | Encoding detection | Detect CSV file encoding |
| `rapidfuzz` | Fuzzy string matching | Column name matching. Faster than `fuzzywuzzy` (C implementation) |
| `python-json-logger` | Structured logging | JSON log output for Docker |
| `pytest` | Testing | Standard Python test framework |
| `pytest-asyncio` | Async test support | Test async FastAPI endpoints |
| `httpx` | HTTP test client | FastAPI test client (`AsyncClient`) |
| `ruff` | Linting & formatting | Fast, comprehensive Python linter (replaces flake8 + black + isort) |

---

## 10. Git Ignore

### `.gitignore`

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
dist/
build/

# Environment
.env
.env.local

# ML Models (generated, not committed)
backend/ml_models/

# Uploads (temporary)
backend/uploads/

# Database
postgres_data/

# Node
node_modules/
.next/
out/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Docker
docker-compose.override.yml
```

### What IS Committed

- All source code
- `pyproject.toml`, `package.json`, `package-lock.json`
- Docker files (`Dockerfile`, `docker-compose.yml`)
- Alembic configuration and migration scripts
- Seed data CSV files
- Documentation
- `.env.example` files (templates, not actual secrets)
- Test fixtures

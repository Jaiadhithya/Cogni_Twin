# Prompt: Set up CogniTwin on a new computer

> Paste everything below the line into an AI coding assistant (for example Claude Code) opened in an **empty folder** on the new computer. It works on Windows, macOS and Linux.

---

You are setting up **CogniTwin** on this computer. It's an AI "business digital twin" web app: you upload a sales CSV and get a dashboard, a revenue forecast, what-if simulation, plain-English questions answered with SQL ("Ask AI"), and PDF document search.

- Repository: https://github.com/Jaiadhithya/Cogni_Twin (public)
- **Backend:** Python 3.13, FastAPI, SQLAlchemy (async), Alembic migrations, Prophet, LightGBM, scikit-learn. Lives in `backend/`.
- **Frontend:** Next.js 16, React 19, TypeScript. Lives in `frontend/`.
- **Databases:** PostgreSQL 15 (required for the full app) and Qdrant (optional; only the Documents page needs it).
- **LLM:** Groq API key (optional; without it, Ask AI falls back to simpler non-LLM answers).

Your goal: get the app running at http://localhost:3000, with the backend at http://localhost:8000, and prove it works. Follow the steps in order. Run each command yourself, check its output, and fix problems before moving on.

## Ground rules

1. **Don't change the project's source code** to make setup work. Only create or edit the environment files named below (`.env`, `backend/.env`, `frontend/.env.local`). If something seems to need a code change, stop and tell me what and why.
2. **Never commit or push anything**, and never print secret values (API keys, passwords) back to me. `.env` files are already git-ignored; keep it that way.
3. **Ask me before installing system-wide software** (Python, Node.js, Docker, PostgreSQL). Tell me exactly what you want to install and from where (the official site or the OS package manager: winget on Windows, Homebrew on macOS, apt or dnf on Linux).
4. **Ask me for my Groq API key** when you reach that step. I can get a free one at https://console.groq.com/keys. If I don't have one, continue without it.
5. **Use the right shell syntax for this OS.** On Windows PowerShell: activate the virtual env with `.venv\Scripts\Activate.ps1`, copy files with `Copy-Item`, set variables with `$env:NAME = "value"`. If activation is blocked by execution policy, use `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` for that session only, and don't change it permanently.
6. **Explain each step in a short sentence before doing it**, and give me a summary at the end.

## Step 1: Check the system

Detect the OS and CPU architecture, then check these tools and versions:

| Tool | Needed version | Check with |
|---|---|---|
| Git | any recent | `git --version` |
| Python | **3.13.x** (the backend requires `>=3.13`) | `python --version`, `python3 --version`, and on Windows `py -3.13 --version` |
| Node.js | **20 or newer** (22 LTS recommended) | `node --version` |
| npm | comes with Node | `npm --version` |
| Docker | optional; makes the databases easy | `docker --version`, then `docker info` to confirm the engine is actually running |

Also check free disk space. After installing dependencies the project folder grows to about **3–5 GB** (Python packages ~1.2 GB, `node_modules` ~0.6 GB, Next.js build caches 1–3 GB).

Report what is present or missing, then **decide the setup path**:

- **Path A, Docker for everything:** Docker is installed and running. This is the easiest path, and the one to recommend.
- **Path B, local backend and frontend, Docker only for the databases:** good for development; needs Python 3.13, Node 20+ and Docker.
- **Path C, no Docker at all:** needs Python 3.13, Node 20+, and PostgreSQL 15 installed natively (or a hosted PostgreSQL such as Supabase). Qdrant is optional.
- **Path D, demo only:** needs only Node 20+. The frontend runs on built-in sample data, with no backend or database.

Tell me which path you recommend and why, and wait for me to confirm before installing anything.

## Step 2: Clone the repository

```
git clone https://github.com/Jaiadhithya/Cogni_Twin.git
cd Cogni_Twin
```

The download is small (~9 MB). Confirm that `backend/`, `frontend/`, `demo_data/`, `docker-compose.yml` and `README.md` exist. From here on, all paths are relative to the `Cogni_Twin` folder.

## Path A: Docker for everything

1. Create a file named `.env` in the **project root** (next to `docker-compose.yml`). Docker Compose reads it automatically:
   ```env
   GROQ_API_KEY=<my key, or leave empty>
   ```
2. Build and start all four services (PostgreSQL, Qdrant, backend, frontend). The first build takes **10–20 minutes**:
   ```
   docker compose up --build -d
   ```
3. Wait until the database is healthy and the backend is up: check `docker compose ps`, and read `docker compose logs backend --tail 50` if needed.
4. Create the database tables. This is required on first run; the containers don't do it automatically:
   ```
   docker compose exec backend alembic upgrade head
   ```
5. Go to the **Verify** section.

Notes:
- PostgreSQL is exposed on host port **5433**, not 5432, so it won't clash with a local PostgreSQL install.
- `docker compose down` stops everything; `docker compose down -v` also deletes all data.

## Path B: Databases in Docker, backend and frontend run locally

### B1. Start only the databases

```
docker compose up -d db qdrant
```

On first start, the `db` container automatically:
- creates database `cognitwin`, owned by user `cognitwin_user` (password `postgres`)
- runs `backend/scripts/init_db.sql`, which creates the read-only role `cognitwin_readonly` (password `readonly`) that Ask AI uses

It listens on **localhost:5433**. Qdrant listens on localhost:6333.

### B2. Backend

Run these from inside `backend/`:

1. Create and activate a virtual environment **with Python 3.13 specifically**. On Windows: `py -3.13 -m venv .venv`. On macOS/Linux: `python3.13 -m venv .venv`.
2. Upgrade pip, then install everything (this takes 3–10 minutes; Prophet and LightGBM are large):
   ```
   python -m pip install --upgrade pip
   pip install -r requirements-dev.txt
   ```
3. Copy `.env.example` to `.env`, then set these values:
   ```env
   DATABASE_URL=postgresql+asyncpg://cognitwin_user:postgres@localhost:5433/cognitwin
   DATABASE_READONLY_URL=postgresql+asyncpg://cognitwin_readonly:readonly@localhost:5433/cognitwin
   GROQ_API_KEY=<my key, or leave empty>
   GROQ_MODEL_NAME=openai/gpt-oss-120b
   ML_MODELS_DIR=./ml_models
   LOG_LEVEL=INFO
   CORS_ORIGINS=["http://localhost:3000"]
   ```
   Settings are read from `.env` in the current folder and from `../.env`, so **always start the backend from inside `backend/`**.
4. Create the tables:
   ```
   alembic upgrade head
   ```
5. Start the API **in the background, or in a separate terminal** so it keeps running:
   ```
   uvicorn src.main:app --reload --port 8000
   ```
   Keep this backend process to a single worker; the app assumes one process.

### B3. Frontend

In a second terminal, inside `frontend/`:

```
npm install
```

Copy `.env.local.example` to `.env.local`. The defaults are correct: `BACKEND_API_URL=http://localhost:8000/api/v1`, and `BACKEND_API_KEY` stays empty unless the backend has `API_KEY` set. Then start the dev server, also in the background or a separate terminal:

```
npm run dev
```

Go to the **Verify** section.

## Path C: No Docker

Same as Path B, except you provide PostgreSQL yourself.

1. **Install PostgreSQL 15 or newer** natively (ask me first), or use a hosted PostgreSQL that I give you the connection details for.
2. As a PostgreSQL superuser (for example `postgres`), using `psql`:
   ```sql
   CREATE USER cognitwin_user WITH PASSWORD 'postgres';
   CREATE DATABASE cognitwin OWNER cognitwin_user;
   ```
   Then run the read-only role script against the `cognitwin` database:
   ```
   psql -U postgres -d cognitwin -f backend/scripts/init_db.sql
   ```
   The script grants on a database named exactly `cognitwin`. If you use a different name, tell me before changing anything.
3. In `backend/.env`, use the **native port 5432** (or the hosted host and port):
   ```env
   DATABASE_URL=postgresql+asyncpg://cognitwin_user:postgres@localhost:5432/cognitwin
   DATABASE_READONLY_URL=postgresql+asyncpg://cognitwin_readonly:readonly@localhost:5432/cognitwin
   ```
   Hosted providers such as Supabase often require SSL and a "session pooler" connection string. Use the one they give, keeping the `postgresql+asyncpg://` prefix.
4. Continue with B2 (from step 1) and B3.
5. **Qdrant is optional.** Without it, everything works except the Documents page, which shows "Document search is unavailable right now". To enable it without Docker, download the Qdrant binary from https://github.com/qdrant/qdrant/releases (ask me first), run it, and leave `QDRANT_HOST=localhost` and `QDRANT_PORT=6333`.

## Path D: Demo only (no backend)

```
cd frontend
npm install
npm run dev
```

Open http://localhost:3000, click the gear icon (Settings), and turn on **Demo mode**. Every page then uses built-in sample data.

## Verify (Paths A, B and C)

Do all of these and report the results:

1. **Backend health:** request `http://localhost:8000/api/v1/health` (with `curl`, or `Invoke-RestMethod` on Windows). It should respond and report database status. Qdrant and the LLM may show as unavailable if they were skipped; that's acceptable.
2. **API docs:** http://localhost:8000/docs loads.
3. **Frontend:** http://localhost:3000 loads the landing page, and "Open dashboard" goes to `/dashboard`.
4. **End-to-end check with demo data:**
   - Upload `demo_data/nexa_electronics_sales_2024_2026.csv` (17,520 rows), either in the UI (**Data → Upload**) or via the API: `POST http://localhost:8000/api/v1/ingest/csv` as multipart form-data with field name `file`. It should return a `dataset_id` and a `row_count` of about 17,520.
   - In the UI, select that dataset in the picker at the top, open **Dashboard**, and confirm the numbers appear.
   - Open **Forecast**, click **Train model**, wait for the job to finish, and confirm the forecast chart appears. Move a lever in the What-if panel.
   - If a Groq key was set, open **Ask AI** and ask "Which category had the highest net revenue?"
5. **Optional: run the test suites.**
   - Backend: run `pytest -q` from `backend/`. It needs the database from Path B or C, and it creates and drops its own test data in that database.
   - Frontend: run `npm run lint`, `npm run typecheck` and `npm test` from `frontend/`.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `pip install` fails building `prophet`, `lightgbm` or `asyncpg` | Wrong Python version: make sure the venv uses **3.13**. On Linux you may also need `build-essential` and `libpq-dev`. |
| `alembic upgrade head` can't connect | Wrong port (Docker = **5433**, native = 5432), the database isn't running, or there's a typo in `DATABASE_URL` |
| Ask AI errors with "permission denied" or the read-only role doesn't exist | `init_db.sql` wasn't run (Path C), or migrations ran before it. Run the script, then `alembic upgrade head` again. |
| Port 3000, 8000, 5433 or 6333 already in use | Stop the other process, or change the port mapping and tell me what you changed |
| `docker compose` says it can't connect to the Docker API | Docker Desktop isn't running; start it and retry |
| Frontend shows network or backend errors | The backend isn't running, or `BACKEND_API_URL` in `frontend/.env.local` is wrong |
| First PDF upload is slow | The embedding model (`fastembed`) downloads once on first use; this is expected |
| PowerShell won't run `Activate.ps1` | Use `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` for the current session only |

## Final report

When done, tell me:
- which path was used, and what you installed
- which files you created or edited (without secret values)
- the URLs that are working
- the commands to **start** and **stop** the app next time, for the path used
- anything that failed or was skipped, and why

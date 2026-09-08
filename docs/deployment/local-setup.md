# Local Development Setup

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker | ≥ 24.0 | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Docker Compose | ≥ 2.20 | Included with Docker Desktop |
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) |
| Python | 3.11+ | [python.org](https://python.org) |
| Poetry | 1.8+ | `pip install poetry` |

---

## Quick Start (Docker)

The fastest way to run the full stack:

```bash
# 1. Clone the repository
git clone https://github.com/Savoy11/finance-now.git
cd finance-now

# 2. Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 3. Start all services
docker compose -f infrastructure/docker/docker-compose.yml up -d

# 4. Wait for services to be healthy (~30 seconds)
docker compose -f infrastructure/docker/docker-compose.yml ps

# 5. Run database migrations
docker compose -f infrastructure/docker/docker-compose.yml exec backend \
  alembic upgrade head

# 6. Access the platform
open http://localhost:3000      # Frontend dashboard
open http://localhost:8000/docs # Backend API docs (debug mode)
open http://localhost:3001      # Grafana (admin/admin)
open http://localhost:9090      # Prometheus
```

---

## Manual Development Setup

### Backend

```bash
cd backend

# Install dependencies
poetry install

# Configure environment
cp .env.example .env
# Edit .env with your values — at minimum set:
#   DATABASE_URL=postgresql+asyncpg://fn:fn@localhost:5432/fn
#   REDIS_URL=redis://localhost:6379/0
#   SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")

# Start external services (Postgres + Redis only)
docker compose -f ../infrastructure/docker/docker-compose.yml up -d postgres redis

# Run migrations
poetry run alembic upgrade head

# Start the API server (hot-reload)
poetry run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment. Nothing here is required to run the app: it is
# live-only against keyless public providers, and every surface with no
# reachable source says so rather than inventing a figure.
cp .env.example .env.local

# Start dev server
npm run dev
# App available at http://localhost:3000
```

### Running Tests

```bash
# Backend unit + integration tests
cd backend
poetry run pytest -v --cov=app

# Frontend type check
cd frontend
npm run type-check

# Frontend lint
npm run lint
```

---

## Environment Variables Reference

### Backend (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL async connection string |
| `REDIS_URL` | — | Redis connection string |
| `SECRET_KEY` | — | JWT signing secret (min 32 chars) |
| `DEBUG` | `false` | Enable debug mode + docs UI |
| `COINGECKO_API_KEY` | — | CoinGecko Pro API key |
| `CORS_ORIGINS` | `[]` | JSON array of allowed origins |

### Frontend (`.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
**None of these are required.** Full annotated list with what each one unlocks:
`frontend/.env.example`, and `CLAUDE.md` § Environment Variables.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | Postgres. Backs portfolios, watchlists, builder plans, wallets, users. Without it those routes answer 503 and the rest of the app runs |
| `AUTH_SECRET` | — | Required only once the login wall is re-enabled. `openssl rand -base64 32` |
| `FN_ALLOW_LOCAL_USER` | dev: allow, prod: deny | ⚠ true in production hands every anonymous visitor the same account |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Optional dormant legacy backend. The **origin only** — no `/api` or `/api/v1` suffix; the rewrite appends `/api/:path` itself |
| `ANTHROPIC_API_KEY` | — | Daily Brief, all agents, Pump Report. Also settable in Integrations → AI Providers, where the UI key wins |
| `FMP_API_KEY` | — | First rung of the quote ladder; the only source for the Stock Registry universe. Free tier covers per-symbol data, not the broad universe |

> **`NEXT_PUBLIC_WS_URL` and `NEXT_PUBLIC_USE_MOCK` were listed here and no longer
> exist** (removed in M8). The app opens no socket, and `LIVE_DATA` is hardcoded
> `true` in `lib/constants.ts` — there is no mock data path at all. Corrected
> 2026-09-08.

---

## Common Issues

**Port conflicts**: If `5432` or `6379` are in use, change `ports:` in `docker-compose.yml`.

**Migration errors**: Ensure TimescaleDB extension is installed:
```bash
docker exec -it fn-postgres psql -U fn -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

**Frontend auth redirect loop**: Not reachable at present — the login wall is off (`REQUIRE_AUTH = false` in `src/app/(dashboard)/layout.tsx`, `LOGIN_DISABLED = true` on the login page). See `docs/architecture/auth.md` before changing either.

**CORS errors**: Add `http://localhost:3000` to `CORS_ORIGINS` in `backend/.env`.

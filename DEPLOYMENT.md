# Probabylon Deployment

## Architecture

- Frontend: Next.js app in `apps/web`
- Backend: FastAPI app in `services/api`
- Worker: Celery worker in `services/worker`
- Database: Neon Postgres
- Cache / broker: Redis

## Environment Variables

### Frontend (`apps/web`)

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`

### Backend (`services/api`)

- `APP_ENV`
- `LOG_LEVEL`
- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `REDIS_URL`
- `BROKER_URL`
- `RESULT_BACKEND`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FRONTEND_URL`
- `BACKEND_URL`
- `CORS_ORIGINS`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `DEFAULT_LLM_PROVIDER`
- `DEFAULT_LLM_MODEL`

## Neon Configuration

- Runtime app traffic should use `DATABASE_URL`
- Alembic migrations should use `DATABASE_URL_UNPOOLED`
- Ensure both URLs include SSL requirements for Neon

## Backend Deployment

Use any container-capable host such as Render, Railway, or Fly.io.

### Build command

`docker build -f services/api/Dockerfile -t probabylon-api .`

### Start command

`alembic -c alembic.ini upgrade head && gunicorn -k uvicorn.workers.UvicornWorker -w 2 app.main:app --bind 0.0.0.0:8000`

### Working directory

`/app`

## Worker Deployment

### Build command

`docker build -f services/worker/Dockerfile -t probabylon-worker .`

### Start command

`celery -A worker.celery_app worker --loglevel=info`

## Frontend Deployment

Recommended Vercel project settings:

- Root directory: `apps/web`
- Install command: `npm install`
- Build command: `npm run build`
- Output: Next.js default

### Frontend environment

- `NEXT_PUBLIC_API_URL=https://<your-backend-domain>/api`
- `NEXT_PUBLIC_WS_URL=wss://<your-backend-domain>/ws/markets`

## Google OAuth

Create a Google OAuth web application with these redirect URIs:

- `http://localhost:8000/api/auth/google/callback`
- `https://<your-backend-domain>/api/auth/google/callback`

Authorized JavaScript origins:

- `http://localhost:3000`
- `https://a20-app-065.vercel.app`
- `https://<your-frontend-domain>`

## Migrations

From `services/api`:

`alembic -c alembic.ini upgrade head`

## Local Stack

From repo root:

`docker compose up --build`

## Seeded Admin Account

- Email: `admin@probabylon.ai`
- Password: `Admin123!Secure`

The backend seeds this account during startup and stores the password as a bcrypt hash.

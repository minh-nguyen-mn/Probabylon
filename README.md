# Probabylon

Probabylon is a production-ready, distributed multi-agent prediction market engine for collective AI forecasting.

## Structure

```
├── apps/web/                  # Next.js 15 dashboard (Zustand + Recharts + Tailwind)
├── services/api/              # FastAPI async backend
│   ├── app/api                # HTTP routes
│   ├── app/db                 # SQLAlchemy models and session
│   ├── app/markets            # LMSR engine
│   ├── app/llm                # Provider-agnostic LLM abstraction
│   ├── app/schemas            # Pydantic v2 contracts
│   └── alembic                # DB migrations
├── services/worker/           # Celery distributed simulation worker
├── infra/                     # bootstrap SQL / infra config
├── src/                       # legacy local MVP modules (kept for compatibility)
├── scripts/
│   ├── setup_hooks.sh  # One-time hook installer
│   ├── log_hook.py     # AI tool hook handler
│   └── submit_log.py   # Submits logs on git push
├── requirements.txt
├── .env.example
├── AGENTS.md           # Rules for using AI coding agents
├── JOURNAL.md          # Weekly journal — product journey & learnings
└── WORKLOG.md          # Technical decisions, task assignments, brainstorming
```

## Getting Started

### 1. Clone and setup

```bash
git clone <repo-url>
cd <repo>

# Install git pre-push hook (required, run once)
bash scripts/setup_hooks.sh
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in your provider key. If you only use OpenAI, `OPENAI_API_KEY` is enough. The `AI_LOG_*` variables are pre-filled.

### 3. Run distributed stack

```bash
python -m venv venv
source venv/bin/activate       # Linux/Mac
# or: venv\Scripts\activate    # Windows

pip install -r requirements.txt
docker compose up --build
```

Services:

- `web` on `http://localhost:3000`
- `api` on `http://localhost:8000`
- websocket stream on `ws://localhost:8000/ws/markets`
- distributed worker via Celery + Redis
- PostgreSQL durable storage

### 4. API quickstart

Create market:

```bash
curl -X POST http://localhost:8000/api/markets \
  -H "Content-Type: application/json" \
  -d '{
    "question":"Will AGI exist before 2035?",
    "description":"General-purpose AGI before deadline",
    "resolution_criteria":"YES if broad AGI is recognized by 2034-12-31 UTC",
    "category":"technology",
    "initial_probability":0.5,
    "lmsr_b":75
  }'
```

Start simulation:

```bash
curl -X POST http://localhost:8000/api/simulations/start \
  -H "Content-Type: application/json" \
  -d '{"market_id":"<id>","rounds":8,"max_agents":24}'
```

## Weekly Journal

Update **[JOURNAL.md](./JOURNAL.md)** at the end of every week to document your product-building journey:

- Features shipped
- AI tools used and how they helped
- Hardest problem of the week and how you solved it
- What you'd do differently
- Plan for next week

> JOURNAL.md **must be updated** before each PR. It is your learning record for the course.

## Worklog

Update **[WORKLOG.md](./WORKLOG.md)** whenever your team makes a technical decision or changes direction:

- **Technical decisions** — why did you choose this approach over alternatives?
- **Task assignments** — who does what, by when
- **Brainstorming** — options considered, pros/cons, conclusion
- **Important bugs** — root cause and fix

See each file for the format and examples.

## AI Logging

Prompts and tool calls are **automatically logged** when you use any supported AI tool (Claude Code, Cursor, Codex, Gemini, Copilot). No manual steps needed after running `setup_hooks.sh`.

See [AGENTS.md](./AGENTS.md) for details.

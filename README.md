# Human OS

The Operating System For Understanding Yourself. Powered by Viyaan AI.

Human OS is a two-part application:

- `frontend`: Next.js app for Reflect, DNA, Graph, Vault, and Timeline.
- `backend`: Express API, Groq-powered pattern engine, and local JSON or Supabase persistence.

## Local Setup

Install dependencies in both apps:

```powershell
cd frontend
npm install
cd ..\backend
npm install
```

Create backend environment:

```powershell
Copy-Item backend\.env.example backend\.env
```

Start both apps:

```powershell
powershell ./run.ps1
```

Frontend runs at `http://localhost:3000`. Backend runs at `http://localhost:5000`.

## Modes

Sandbox mode works without API keys and persists to `backend/db/local_db.json` or browser local storage when the backend is unavailable.

Groq mode is enabled by setting `GROQ_API_KEY` in `backend/.env`.

Supabase mode is enabled by setting `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then running `backend/db/schema.sql` in the Supabase SQL editor.

## Environment

Backend:

```env
PORT=5000
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_PER_MINUTE=30
GROQ_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

Frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Verification

Use these before deployment:

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix backend run start
```

Health check:

```powershell
Invoke-RestMethod http://localhost:5000/api/health
```
"# HUMAN-OS" 

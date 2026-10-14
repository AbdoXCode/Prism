# Prism

Upload documents, ask questions, get streamed answers with page citations.
A general-purpose RAG chatbot: React + TypeScript + Tailwind frontend, FastAPI
backend (Groq for generation, `intfloat/multilingual-e5-small` for embeddings,
Supabase for storage + pgvector chunk search).

## Project layout

```
Rag chatbot/
├── backend/    FastAPI + Supabase (services/, main.py)
└── frontend/   this app — Vite + React + TS + Tailwind
```

Both repos are yours to edit. The table below is the contract the frontend
depends on — keep the two in sync if you change it.

## Backend contract

| Endpoint | Method | Body | Response |
|---|---|---|---|
| `/upload` | POST | multipart `file` (PDF only) | `{ message, document_id, filename, storage_path }` |
| `/analyze/{document_id}` | POST | — | `{ message, document_id, chunks_created }` |
| `/ask` | POST | `{ question, document_ids }` | SSE `text/event-stream`: `token` / `sources` / `done` / `error` |
| `/documents/{document_id}` | DELETE | — | `{ message, document_id, filename }` |
| `/documents` | GET | — | all indexed documents (unused by the UI) |
| `/health` | GET | — | `{ status: "healthy" }` |

Upload flow in the UI: `POST /upload` → `POST /analyze/{id}` automatically → doc becomes "ready".

Indexed docs + ticked selection persist in `localStorage`, so uploads survive reloads. The trash button calls the DELETE endpoint and removes the file server-side.

## Branding

The product name lives in one place: `src/config.ts` (`APP_NAME`, `APP_TAGLINE`,
`EXAMPLE_PROMPTS`). Update the `<title>` in `index.html` to match — HTML can't
import the module.

Keep copy domain-agnostic. Prism is not tied to any vertical, so nothing in the
UI or README should assume an industry.

## Setup

```bash
cd frontend
npm install
```

## Run (dev)

```bash
npm run dev
# open http://localhost:5173
```

The backend is expected at `http://127.0.0.1:8000`:

```bash
cd ../backend
uvicorn main:app --reload --port 8000
```

> **CORS note:** the backend has no `CORSMiddleware`. With the default empty
> `VITE_API_URL`, the app uses relative URLs (`/ask`, `/upload`, `/analyze`)
> and the Vite dev proxy (`vite.config.ts`) forwards them to the backend, so
> dev works with no backend changes.

## Production

Set `VITE_API_URL` to your deployed backend URL (and enable CORS on the server
or serve behind the same origin):

```bash
VITE_API_URL=https://your-backend.example.com npm run build
```

## Scripts

- `npm run dev` — dev server with API proxy
- `npm run build` — type-check + production build
- `npm run preview` — preview the build

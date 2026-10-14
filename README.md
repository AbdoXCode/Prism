# Prism — RAG Chatbot

Upload PDFs, ask questions, get streamed answers with page citations.

Prism retrieves the most relevant chunks from your documents using vector
similarity, then answers using only what it retrieved — citing the page for
every claim.

## How it works

1. **Upload** — the PDF goes to Supabase Storage, a row lands in `documents`
2. **Analyze** — text is extracted, split into overlapping chunks, and each
   chunk is embedded into pgvector
3. **Ask** — your question is embedded, the nearest chunks are retrieved by
   cosine similarity, and Groq streams an answer grounded in those chunks
   with `[Page X]` citations

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind 4 |
| Backend | FastAPI (Python) |
| Storage | Supabase Storage + Postgres pgvector |
| Embeddings | Google Gemini `gemini-embedding-001` (384-dim) |
| Generation | Groq (`qwen/qwen3.8-27b`) |

## Highlights

- **Streams answers** — SSE, token by token, rather than one blocking wait
- **Page citations** — every claim links back to a source chunk
- **Multi-document** — tick any combination of files to scope a question
- **Custom markdown renderer** — tables, lists and KaTeX math, with RTL
  support for Arabic and Hebrew
- **Server status indicator** — live health check in the header, so a cold or
  dead backend is obvious instead of silently blank
- **Lightweight backend** — ~88 MB of dependencies, ~14 MB resident, boots in
  about 3 seconds. No torch, no GPU, no model download

## Project layout

```
prism-rag-chatbot/
├── backend/            FastAPI + Supabase + Groq + Gemini
│   ├── main.py         Routes, CORS, SSE
│   ├── requirements.txt
│   └── services/
│       ├── analyze_pdf.py      download → chunk → embed → store
│       ├── chunk_pdf.py        PDF text extraction + splitting
│       ├── embedding_model.py  Gemini embeddings (384-dim)
│       ├── user_question.py    retrieval + prompt + SSE stream
│       ├── upload_supabase.py  PDF → Storage + documents row
│       ├── delete_document.py  remove file + row (+ chunks cascade)
│       └── supabase_client.py  shared client
└── frontend/           Vite + React + TypeScript
    ├── src/
    │   ├── App.tsx
    │   ├── components/         ChatMessage, Composer, DocsPanel, ServerStatus
    │   └── lib/                api, store, markdown, math
    └── package.json
```

## Quick start

```bash
# Backend — http://127.0.0.1:8000
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend — http://localhost:5173
cd frontend
npm install
npm run dev
```

The Vite dev proxy forwards `/ask`, `/upload`, `/analyze`, `/documents` and
`/health` to the backend, so no CORS configuration is needed locally.

## Configuration

`backend/.env`

```bash
SUPABASE_URL=
SUPABASE_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=

# Optional. Comma-separated. Defaults to the Vite dev server.
CORS_ORIGINS=https://your-app.vercel.app
```

`frontend/.env`

```bash
# Leave empty for local dev — the app uses relative URLs.
VITE_API_URL=
```

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `POST` | `/upload` | Upload a PDF (multipart `file`) |
| `POST` | `/analyze/{id}` | Chunk + embed an uploaded document |
| `POST` | `/ask` | Ask a question — returns an SSE stream |
| `DELETE` | `/documents/{id}` | Remove a document, its file, and its chunks |

`/ask` emits `event: token` per token, then `event: sources`, then
`event: done` (or `event: error`).

## Limitations

### 4.5 MB upload cap when deployed on Vercel

Vercel caps request bodies at **4.5 MB**. `POST /upload` sends the PDF as the
request body, so any file larger than that is rejected at Vercel's edge with
`413 FUNCTION_PAYLOAD_TOO_LARGE` — the request never reaches FastAPI, Supabase,
or Gemini.

Browsers surface this as the generic `Failed to fetch` rather than a readable
error, because Vercel closes the connection while the upload is still in
progress and `fetch()` never receives a status it can inspect.

**This is a Vercel platform rule and cannot be raised by configuration** — no
`vercel.json` setting, plan upgrade, or header removes it. Most scanned PDFs
exceed 4.5 MB, so expect it to trigger often in practice.

### Need bigger files? Host the backend yourself

The cap exists only in Vercel's infrastructure. Run the backend on your own
machine and it disappears:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Leave `VITE_API_URL` empty in `frontend/.env` — the Vite dev proxy forwards
`/upload` straight to FastAPI with no size limit beyond your own disk and RAM.
The same applies to any server you control: the limit is Vercel's, not Prism's.

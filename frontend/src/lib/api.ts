// Backend contract (from backend/main.py + services/):
//   POST /upload (multipart `file`, PDF only)
//     -> { message, document_id, filename, storage_path }
//   POST /analyze/{document_id}
//     -> { message, document_id, chunks_created }
//   POST /ask { question, document_ids }
//     -> SSE stream `text/event-stream` with events:
//        event: token   data: "<text chunk>"
//        event: sources data: [{ page, similarity, content }]
//        event: done    data: { message: "complete" }
//        event: error   data: { detail }
//   DELETE /documents/{document_id}
//     -> { message, document_id, filename } (file + chunks removed server-side)
// The frontend sends the ticked files as `document_ids` (list). For
// compatibility it also sends `document_id` (singular) when exactly one
// file is ticked — the backend ignores unknown fields.

export interface UploadResult {
  message: string;
  document_id: number;
  filename: string;
  storage_path: string;
}

export interface AnalyzeResult {
  message: string;
  document_id: number;
  chunks_created: number;
}

export interface Source {
  page: number;
  similarity: number;
  content: string;
}

export type ServerState = "checking" | "online" | "not-found" | "offline" | "error";

export interface HealthResult {
  state: ServerState;
  /** HTTP status when the server responded; null when it didn't (offline). */
  code: number | null;
}

const RAW_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
/** Empty string = relative URLs, which the Vite dev proxy forwards to FastAPI. */
export const API_BASE = RAW_BASE.trim().replace(/\/$/, "");

const url = (path: string) => `${API_BASE}${path}`;

export async function uploadPdf(file: File, signal?: AbortSignal): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(url("/upload"), { method: "POST", body: form, signal });
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new Error(detail || `Upload failed (${res.status})`);
  }
  return res.json() as Promise<UploadResult>;
}

export async function analyzeDocument(documentId: number, signal?: AbortSignal): Promise<AnalyzeResult> {
  const res = await fetch(url(`/analyze/${documentId}`), { method: "POST", signal });
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new Error(detail || `Analyze failed (${res.status})`);
  }
  return res.json() as Promise<AnalyzeResult>;
}

export interface DeleteResult {
  message: string;
  document_id: number;
  filename: string;
}

/** DELETE /documents/{id} — removes the file + its chunks server-side. */
export async function deleteDocument(documentId: number, signal?: AbortSignal): Promise<DeleteResult> {
  const res = await fetch(url(`/documents/${documentId}`), { method: "DELETE", signal });
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new Error(detail || `Delete failed (${res.status})`);
  }
  return res.json() as Promise<DeleteResult>;
}

async function safeDetail(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: unknown };
    if (typeof data.detail === "string") return data.detail;
    return JSON.stringify(data.detail ?? data);
  } catch {
    try {
      return await res.text();
    } catch {
      return "";
    }
  }
}

/** GET /health — distinguishes "server down" from "endpoint missing".
 *  Uses a short timeout so a hung server reports Offline rather than
 *  sitting on Checking forever. */
export async function checkHealth(signal?: AbortSignal): Promise<HealthResult> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url("/health"), { signal: controller.signal, cache: "no-store" });
    if (res.ok) return { state: "online", code: res.status };
    if (res.status === 404) return { state: "not-found", code: 404 };
    // Gateway errors mean the backend itself was unreachable (in dev the Vite
    // proxy answers 502 for a dead upstream). Treat as Offline, not Error.
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return { state: "offline", code: res.status };
    }
    return { state: "error", code: res.status };
  } catch {
    // Network-level failure: connection refused, wrong host, DNS, timeout.
    return { state: "offline", code: null };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export interface AskCallbacks {
  onToken: (token: string) => void;
  onSources: (sources: Source[]) => void;
  signal?: AbortSignal;
}

export interface AskOptions {
  /** Backend document ids to scope the question to. Sent as `document_ids`. */
  documentIds?: number[];
  signal?: AbortSignal;
}

/** POST /ask and stream SSE events via fetch reader (EventSource can't do POST). */
export async function askQuestionStream(
  question: string,
  cb: AskCallbacks,
  opts: AskOptions = {},
): Promise<void> {
  const ids = opts.documentIds ?? [];
  const body: Record<string, unknown> = { question, document_ids: ids };
  // Compat: also send singular `document_id` when exactly one file is ticked.
  if (ids.length === 1) body.document_id = ids[0];
  const res = await fetch(url("/ask"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal: cb.signal ?? opts.signal,
  });

  if (!res.ok) {
    throw new Error((await safeDetail(res)) || `Request failed (${res.status})`);
  }
  if (!res.body) throw new Error("Streaming not supported in this browser.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = dispatchSse(buffer, cb);
  }
  buffer += decoder.decode();
  dispatchSse(buffer, cb, true);
}

function dispatchSse(buffer: string, cb: AskCallbacks, flush = false): string {
  // SSE frames are separated by a blank line.
  const parts = buffer.split("\n\n");
  const rest = flush ? "" : (parts.pop() ?? "");
  for (const part of parts) {
    if (!part.trim()) continue;
    let event = "";
    const dataLines: string[] = [];
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    const raw = dataLines.join("\n");
    if (!event || !raw) continue;
    try {
      if (event === "token") {
        const token = JSON.parse(raw) as unknown;
        if (typeof token === "string") cb.onToken(token);
      } else if (event === "sources") {
        cb.onSources(JSON.parse(raw) as Source[]);
      } else if (event === "error") {
        const err = JSON.parse(raw) as { detail?: unknown };
        throw new Error(typeof err.detail === "string" ? err.detail : "Model error");
      }
      // "done" needs no action
    } catch (e) {
      if (e instanceof Error && e.message !== "Model error") {
        // Non-JSON token payload — append raw.
        if (event === "token") cb.onToken(raw);
      } else if (e instanceof Error) {
        throw e;
      }
    }
  }
  return rest;
}

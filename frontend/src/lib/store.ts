import { uid, type DocItem } from "../types";

/** Minimal doc record persisted to localStorage so uploads survive reloads. */
export interface SavedDoc {
  documentId: number;
  filename: string;
  chunks?: number;
}

const DOCS_KEY = "rag.docs.v1";
const SELECTED_KEY = "rag.selected.v1";

function isSavedDoc(v: unknown): v is SavedDoc {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.documentId === "number" && typeof o.filename === "string";
}

export function loadSavedDocs(): SavedDoc[] {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedDoc);
  } catch {
    return [];
  }
}

function loadSelectedIds(): number[] {
  try {
    const raw = localStorage.getItem(SELECTED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is number => typeof v === "number");
  } catch {
    return [];
  }
}

/** Hydrate persisted docs into DocItems (already indexed server-side) + selection keys. */
export function loadPersisted(): { docs: DocItem[]; selectedKeys: string[] } {
  const saved = loadSavedDocs();
  const docs: DocItem[] = saved.map((s) => ({
    key: uid(),
    filename: s.filename,
    documentId: s.documentId,
    status: "ready" as const,
    chunks: s.chunks,
  }));
  const byId = new Map(docs.map((d) => [d.documentId, d.key]));
  const selectedKeys = loadSelectedIds()
    .map((id) => byId.get(id))
    .filter((k): k is string => k !== undefined);
  return { docs, selectedKeys };
}

/** Persist ready (indexed) docs + ticked selection. Call on docs/selection change. */
export function persist(docs: DocItem[], selectedKeys: string[]): void {
  try {
    const saved: SavedDoc[] = docs
      .filter((d) => d.status === "ready" && d.documentId != null)
      .map((d) => ({
        documentId: d.documentId as number,
        filename: d.filename,
        ...(d.chunks != null ? { chunks: d.chunks } : {}),
      }));
    localStorage.setItem(DOCS_KEY, JSON.stringify(saved));
    const selectedIds = selectedKeys
      .map((k) => docs.find((d) => d.key === k)?.documentId)
      .filter((id): id is number => id != null);
    localStorage.setItem(SELECTED_KEY, JSON.stringify(selectedIds));
  } catch {
    // Storage full or unavailable — app keeps working in-memory.
  }
}

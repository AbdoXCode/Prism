export type DocStatus = "uploading" | "analyzing" | "ready" | "error";

export interface DocItem {
  key: string;
  filename: string;
  documentId: number | null;
  status: DocStatus;
  chunks?: number;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: import("./lib/api").Source[];
  pending?: boolean;
  error?: boolean;
  /** Backend document ids this message was asked against (ticked files). */
  documentIds?: number[];
}

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

import { Check, FileText, FileUp, LoaderCircle, PanelLeftClose, Trash2, X } from "lucide-react";
import { useDropzone } from "./useDropzone";
import type { DocItem } from "../types";

interface Props {
  docs: DocItem[];
  onFiles: (files: File[]) => void;
  compact?: boolean;
  selectedKeys?: string[];
  onToggle?: (key: string) => void;
  onDelete?: (key: string) => void;
  deletingKey?: string | null;
  disabled?: boolean;
  /** Collapses this panel (desktop sidebar) / drawer (mobile). */
  onCollapse?: () => void;
}

function statusPill(status: DocItem["status"]) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium";
  switch (status) {
    case "ready":
      return `${base} bg-emerald-500/15 text-emerald-300`;
    case "uploading":
    case "analyzing":
      return `${base} bg-amber-500/15 text-amber-300`;
    default:
      return `${base} bg-red-500/15 text-red-300`;
  }
}

function statusLabel(doc: DocItem): string {
  switch (doc.status) {
    case "uploading":
      return "Uploading…";
    case "analyzing":
      return "Analyzing…";
    case "ready":
      return doc.chunks != null ? `${doc.chunks} chunks` : "Ready";
    default:
      return "Failed";
  }
}

export function DocsPanel({ docs, onFiles, compact = false, selectedKeys = [], onToggle, onDelete, deletingKey, disabled = false, onCollapse }: Props) {
  const { dragging, inputRef, handlers, onInputChange } = useDropzone(onFiles);

  return (
    <div className={compact ? "" : "flex h-full flex-col"}>
      {/* Panel header — the single home of the collapse control. */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Documents ({docs.length})
        </h2>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Collapse documents panel"
            aria-label="Collapse documents panel"
            className="-me-1 shrink-0 rounded-md border border-zinc-700 bg-zinc-900 p-1.5 text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-50"
          >
            {/* Desktop collapses a sidebar; mobile closes a drawer. */}
            <X size={15} className="lg:hidden" />
            <PanelLeftClose size={15} className="hidden lg:block" />
          </button>
        )}
      </div>

      <button
        type="button"
        {...handlers}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging
            ? "border-emerald-400 bg-emerald-400/10"
            : "border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800/70"
        }`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
          <FileUp size={20} className="text-emerald-400" />
        </span>
        <span className="text-sm font-medium text-zinc-100">
          {dragging ? "Drop your PDF here" : "Upload a PDF"}
        </span>
        <span className="text-xs text-zinc-400">Drag & drop or click to browse · PDF only · max 4.5 MB</span>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={onInputChange} />
      </button>

      <div className={compact ? "mt-3" : "mt-4 min-h-0 flex-1 overflow-y-auto slim-scroll"}>
        {docs.some((d) => d.status === "ready") && (
          <p className="mb-2 text-[11px] text-zinc-500">
            Tick one or more files to chat with them.
          </p>
        )}
        {docs.length === 0 ? (
          <p className="rounded-lg bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-400">
            No documents yet. Upload a PDF and it's ready to chat in moments —
            then tick it to start asking questions.
          </p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => {
              const selectable = d.status === "ready" && !disabled;
              const selected = selectedKeys.includes(d.key);
              const deletable = d.documentId != null && !disabled && deletingKey !== d.key;
              return (
                <li
                  key={d.key}
                  dir="auto"
                  className={`flex items-start gap-1.5 rounded-lg border p-2.5 transition-colors ${
                    selected
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-zinc-800 bg-zinc-900"
                  }`}
                >
                  <button
                    type="button"
                    disabled={!selectable}
                    onClick={() => onToggle?.(d.key)}
                    title={selectable ? `Chat with ${d.filename}` : d.filename}
                    className={`flex min-w-0 flex-1 items-start gap-2.5 text-left ${
                      selectable ? "cursor-pointer" : "cursor-default opacity-80"
                    }`}
                  >
                    {/* Tick */}
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        selected
                          ? "border-emerald-400 bg-emerald-500"
                          : "border-zinc-600"
                      }`}
                    >
                      <Check size={12} strokeWidth={4} className={selected ? "text-white" : "text-transparent"} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13px] font-medium text-zinc-100" title={d.filename}>
                          <FileText size={14} className="shrink-0 text-zinc-400" />
                          <span className="min-w-0 flex-1 truncate">{d.filename}</span>
                        </span>
                        <span className={statusPill(d.status)}>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              d.status === "ready"
                                ? "bg-emerald-400"
                                : d.status === "error"
                                  ? "bg-red-400"
                                  : "animate-pulse bg-amber-400"
                            }`}
                          />
                          {statusLabel(d)}
                        </span>
                      </span>
                      {(d.status === "uploading" || d.status === "analyzing") && (
                        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-zinc-800">
                          <span className="block h-full w-1/2 animate-pulse rounded-full bg-amber-400" />
                        </span>
                      )}
                      {d.status === "error" && d.error && (
                        <span className="mt-1.5 block text-xs text-red-300">{d.error}</span>
                      )}
                      {selected && (
                        <span className="mt-1.5 block text-[11px] font-medium text-emerald-300">
                          Ticked for chat
                        </span>
                      )}
                    </span>
                  </button>
                  {d.documentId != null && (
                    <button
                      type="button"
                      disabled={!deletable}
                      onClick={() => onDelete?.(d.key)}
                      title={deletingKey === d.key ? "Deleting…" : `Delete ${d.filename} from server`}
                      aria-label={`Delete ${d.filename}`}
                      className="mt-0.5 shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-red-500/15 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deletingKey === d.key ? (
                        <LoaderCircle size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

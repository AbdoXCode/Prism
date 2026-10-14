import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpenText, Check, FileText, MessagesSquare, PanelLeftOpen, X } from "lucide-react";
import { analyzeDocument, askQuestionStream, deleteDocument, uploadPdf, type Source } from "./lib/api";
import { loadPersisted, persist } from "./lib/store";
import { ChatMessage } from "./components/ChatMessage";
import { Composer } from "./components/Composer";
import { DocsPanel } from "./components/DocsPanel";
import { ServerStatus } from "./components/ServerStatus";
import { uid, type ChatMessage as Msg, type DocItem } from "./types";
import { APP_NAME, APP_TAGLINE, EXAMPLE_PROMPTS } from "./config";

export default function App() {
  const [persisted] = useState(loadPersisted);
  const [docs, setDocs] = useState<DocItem[]>(persisted.docs);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(persisted.selectedKeys);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [focusRequest, setFocusRequest] = useState(0);
  // Sidebar/drawer: open on desktop, closed on mobile so the chat gets the screen.
  const [docsOpen, setDocsOpen] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const readyDocs = docs.filter((d) => d.status === "ready");
  const selectedDocs = docs.filter((d) => selectedKeys.includes(d.key) && d.status === "ready");
  const selectedIds = selectedDocs
    .map((d) => d.documentId)
    .filter((id): id is number => id != null);
  const canChat = selectedIds.length > 0;

  // Auto-scroll on new tokens
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Abort in-flight stream on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  // Persist indexed docs + ticked selection so uploads survive reloads.
  useEffect(() => {
    persist(docs, selectedKeys);
  }, [docs, selectedKeys]);

  const handleToggle = useCallback(
    (key: string) => {
      if (streaming) return;
      setSelectedKeys((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
      );
    },
    [streaming],
  );

  const handleFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      const key = uid();
      setDocs((prev) => [
        ...prev,
        { key, filename: file.name, documentId: null, status: "uploading" },
      ]);
      try {
        const up = await uploadPdf(file);
        setDocs((prev) =>
          prev.map((d) =>
            d.key === key ? { ...d, documentId: up.document_id, status: "analyzing" } : d,
          ),
        );
        const an = await analyzeDocument(up.document_id);
        setDocs((prev) =>
          prev.map((d) =>
            d.key === key ? { ...d, status: "ready", chunks: an.chunks_created } : d,
          ),
        );
        // Auto-tick the newly indexed file so the user can chat with it.
        setSelectedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      } catch (e) {
        const message = e instanceof Error ? e.message : "Upload failed";
        setDocs((prev) =>
          prev.map((d) => (d.key === key ? { ...d, status: "error", error: message } : d)),
        );
      }
    }
    // Collapse the mobile drawer after upload; leave the desktop sidebar open
    // so the user can see the progress of a multi-file batch.
    if (window.matchMedia("(max-width: 1023px)").matches) setDocsOpen(false);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!canChat) return;
      const ids = selectedIds;
      const userMsg: Msg = { id: uid(), role: "user", content: text, documentIds: ids };
      const botId = uid();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: botId, role: "assistant", content: "", pending: true, documentIds: ids },
      ]);
      setStreaming(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      let acc = "";
      let gotSources: Source[] | undefined;
      try {
        await askQuestionStream(
          text,
          {
            signal: ctrl.signal,
            onToken: (tok) => {
              acc += tok;
              const snapshot = acc;
              setMessages((prev) =>
                prev.map((m) => (m.id === botId ? { ...m, content: snapshot } : m)),
              );
            },
            onSources: (sources) => {
              gotSources = sources;
            },
          },
          { documentIds: ids },
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botId
              ? {
                  ...m,
                  content: acc || "I don't have enough information to answer that.",
                  sources: gotSources,
                  pending: false,
                }
              : m,
          ),
        );
      } catch (e) {
        if (ctrl.signal.aborted) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botId ? { ...m, content: acc || "(stopped)", pending: false } : m,
            ),
          );
        } else {
          const message = e instanceof Error ? e.message : "Request failed";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botId ? { ...m, content: message, pending: false, error: true } : m,
            ),
          );
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [canChat, selectedIds],
  );

  const handleStop = useCallback(() => abortRef.current?.abort(), []);

  // Example chip → drop the prompt into the composer and hand it the caret.
  const handlePickPrompt = useCallback(
    (prompt: string) => {
      if (streaming) return;
      setDraft(prompt);
      setFocusRequest((n) => n + 1);
    },
    [streaming],
  );

  const handleDelete = useCallback(
    async (key: string) => {
      if (streaming || deletingKey) return;
      const doc = docs.find((d) => d.key === key);
      if (!doc || doc.documentId == null) return;
      if (
        !window.confirm(
          `Delete "${doc.filename}" from the server? This removes the file and its indexed chunks.`,
        )
      ) {
        return;
      }
      setDeletingKey(key);
      try {
        await deleteDocument(doc.documentId);
        setDocs((prev) => prev.filter((d) => d.key !== key));
        setSelectedKeys((prev) => prev.filter((k) => k !== key));
      } catch (e) {
        alert(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setDeletingKey(null);
      }
    },
    [docs, streaming, deletingKey],
  );

  const clearChat = useCallback(() => {
    if (streaming) return;
    setMessages([]);
  }, [streaming]);

  const selectionLabel =
    selectedDocs.length === 0
      ? null
      : selectedDocs.length === 1
        ? selectedDocs[0].filename
        : `${selectedDocs.length} files`;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
            <MessagesSquare size={18} className="text-white" />
          </span>
          <div>
            <h1 className="text-sm font-semibold leading-tight sm:text-base">{APP_NAME}</h1>
            <p className="text-[11px] leading-tight text-zinc-500 sm:text-xs">{APP_TAGLINE}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ServerStatus />
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              disabled={streaming}
              className="rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-40"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setDocsOpen((o) => !o)}
            title={docsOpen ? "Hide documents" : "Show documents"}
            aria-expanded={docsOpen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 lg:hidden"
          >
            {docsOpen ? (
              <>
                <X size={14} /> Docs
              </>
            ) : (
              <>
                <FileText size={14} /> Docs ({docs.length})
              </>
            )}
          </button>
        </div>
      </header>

      {/* Mobile docs drawer */}
      {docsOpen && (
        <div className="border-b border-zinc-800 bg-zinc-950 p-3 lg:hidden">
          <DocsPanel
            docs={docs}
            onFiles={handleFiles}
            compact
            selectedKeys={selectedKeys}
            onToggle={handleToggle}
            onDelete={handleDelete}
            deletingKey={deletingKey}
            disabled={streaming}
            onCollapse={() => setDocsOpen(false)}
          />
        </div>
      )}

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-4 p-3 sm:p-4">
        {/* Sidebar (desktop). Collapsed state stays as a rail so the panel is always
            recoverable — the only way back would otherwise be a button inside the
            panel you just hid.
            overflow-hidden (not -auto): the aside must not become a second scroll
            container. The doc list inside DocsPanel is the only scroller, so there's
            exactly one scrollbar and it sits inside the menu. */}
        {docsOpen ? (
          <aside className="hidden min-h-0 w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-4 lg:flex">
            <DocsPanel
              docs={docs}
              onFiles={handleFiles}
              selectedKeys={selectedKeys}
              onToggle={handleToggle}
              onDelete={handleDelete}
              deletingKey={deletingKey}
              disabled={streaming}
              onCollapse={() => setDocsOpen(false)}
            />
            <div className="mt-4 shrink-0 rounded-xl bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-500">
              <p className="mb-1 font-semibold text-zinc-400">How it works</p>
              <ol className="list-decimal space-y-0.5 pl-4">
                <li>Drop in your PDFs — nothing else to set up.</li>
                <li>Each one is read and indexed automatically.</li>
                <li>Pick the files you want to discuss, then ask away.</li>
              </ol>
            </div>
          </aside>
        ) : (
          <aside className="hidden w-12 shrink-0 items-start justify-center rounded-2xl border border-zinc-800 bg-zinc-950 py-3 lg:flex">
            <button
              type="button"
              onClick={() => setDocsOpen(true)}
              title="Show documents panel"
              aria-label="Show documents panel"
              className="rounded-md border border-zinc-700 bg-zinc-900 p-1.5 text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-50"
            >
              <PanelLeftOpen size={15} />
            </button>
          </aside>
        )}

        {/* Chat column */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-zinc-800 bg-zinc-950">
          {/* Ticked files banner */}
          <div className="border-b border-zinc-800 px-3 py-2 sm:px-4">
            <p className="mx-auto max-w-3xl truncate text-xs text-zinc-400">
              {canChat ? (
                <><Check size={12} className="inline text-emerald-400" /> Chatting with <span className="font-medium text-emerald-300">{selectedDocs.map((d) => d.filename).join(", ")}</span></>
              ) : readyDocs.length > 0 ? (
                "Tick one or more files in the documents panel to chat with them."
              ) : (
                "Upload a PDF to get started."
              )}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto slim-scroll">
            <div className="mx-auto max-w-3xl space-y-3 p-3 sm:p-5">
              {messages.length === 0 ? (
                <EmptyState
                  hasDocs={readyDocs.length > 0}
                  hasSelection={canChat}
                  label={selectionLabel}
                  onPick={handlePickPrompt}
                />
              ) : (
                messages.map((m) => <ChatMessage key={m.id} msg={m} />)
              )}
              <div ref={bottomRef} />
            </div>
          </div>
          <div className="border-t border-zinc-800 p-2.5 sm:p-3">
            <div className="mx-auto max-w-3xl">
              <Composer
                onSend={handleSend}
                onStop={handleStop}
                streaming={streaming}
                disabled={!canChat}
                activeFilename={selectionLabel}
                value={draft}
                onValueChange={setDraft}
                focusRequest={focusRequest}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function EmptyState({
  hasDocs,
  hasSelection,
  label,
  onPick,
}: {
  hasDocs: boolean;
  hasSelection: boolean;
  label?: string | null;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center sm:py-16">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600/15">
        <BookOpenText size={28} className="text-emerald-400" />
      </span>
      <h2 className="mb-1.5 text-lg font-semibold">Chat with your PDFs</h2>
      <p className="max-w-md text-sm leading-relaxed text-zinc-400">
        {!hasDocs
          ? "Upload PDFs using the panel on the left (or the Docs button on mobile). Each will be indexed automatically, then tick them to chat."
          : !hasSelection
            ? "Tick one or more files in the documents panel — you'll chat with the ticked files only."
            : `You're chatting with ${label ?? "the ticked files"}. Ask anything — e.g. “Summarize this document” — and the answer will stream back with page citations.`}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs">
        {EXAMPLE_PROMPTS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={!hasSelection}
            onClick={() => onPick(s)}
            title={hasSelection ? `Ask: ${s}` : "Select a document first"}
            className={`rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-400 ${
              hasSelection
                ? "transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/10 hover:text-emerald-300"
                : "cursor-not-allowed opacity-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { SendHorizontal, Square } from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  activeFilename?: string | null;
  value: string;
  onValueChange: (text: string) => void;
  /** Bump to pull focus into the composer (used when an example chip is clicked). */
  focusRequest?: number;
}

export function Composer({
  onSend,
  onStop,
  streaming,
  disabled,
  activeFilename,
  value,
  onValueChange,
  focusRequest,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [value]);

  // A chip was clicked — move the caret in so the user can edit or hit Enter.
  useEffect(() => {
    if (!focusRequest) return;
    taRef.current?.focus();
  }, [focusRequest]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming || disabled) return;
    onSend(text);
    onValueChange("");
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-2 shadow-lg">
      <textarea
        ref={taRef}
        dir="auto"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        placeholder={
          disabled
            ? "Upload and analyze a PDF to start chatting…"
            : activeFilename
              ? `Ask about ${activeFilename}… (Enter to send, Shift+Enter for newline)`
              : "Ask about your documents… (Enter to send, Shift+Enter for newline)"
        }
        disabled={disabled || streaming}
        className="max-h-40 w-full resize-none bg-transparent px-3 py-2 text-start text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-60"
      />
      <div className="flex items-center justify-end px-1 pb-0.5">
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500"
          >
            <Square size={12} /> Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim() || disabled}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendHorizontal size={14} /> Send
          </button>
        )}
      </div>
    </div>
  );
}

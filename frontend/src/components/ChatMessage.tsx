import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ChatMessage as Msg } from "../types";
import { renderInline, renderMarkdown } from "../lib/markdown";

export function ChatMessage({ msg }: { msg: Msg }) {
  const [showSources, setShowSources] = useState(false);
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[75%] ${
          isUser
            ? "rounded-br-md bg-emerald-600 text-white"
            : msg.error
              ? "rounded-bl-md border border-red-500/40 bg-red-500/10 text-red-200"
              : "rounded-bl-md border border-zinc-800 bg-zinc-900 text-zinc-100"
        }`}
      >
        {!isUser && msg.pending && msg.content.length === 0 ? (
          <span className="flex items-center gap-1.5 py-1 text-zinc-400">
            <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500" />
          </span>
        ) : (
          <div dir="auto" className={`${msg.pending ? "stream-caret" : ""} space-y-2 text-start`}>
            {isUser ? msg.content : renderMarkdown(msg.content, msg.id)}
          </div>
        )}

        {!isUser && msg.sources && msg.sources.length > 0 && (
          <div className="mt-2 border-t border-zinc-800 pt-2">
            <button
              type="button"
              onClick={() => setShowSources((s) => !s)}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-200"
            >
              {showSources ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {showSources ? "Hide" : "Show"} {msg.sources.length} source
              {msg.sources.length > 1 ? "s" : ""}
            </button>
            {showSources && (
              <ul className="mt-1.5 space-y-1.5">
                {msg.sources.map((s, i) => (
                  <li key={i} className="rounded-lg bg-zinc-950 p-2 text-xs text-zinc-300">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-semibold text-zinc-200">
                        Page {s.page}
                      </span>
                      <span className="text-zinc-500">
                        {(s.similarity * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <div dir="auto" className="leading-relaxed text-zinc-400 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4] overflow-hidden">
                      {renderInline(s.content, `${msg.id}-s${i}`)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

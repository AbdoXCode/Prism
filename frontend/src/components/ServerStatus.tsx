import { useEffect, useState } from "react";
import { checkHealth, type ServerState } from "../lib/api";

/** How often to re-check the backend. */
const POLL_MS = 15000;

/** Presentation for each server state: dot colour, label and tooltip text. */
interface StatusMeta {
  label: string;
  tooltip: string;
  dot: string;
  text: string;
}

function statusMeta(state: ServerState, code: number | null): StatusMeta {
  switch (state) {
    case "online":
      return {
        label: "Online",
        tooltip: `Server responded ${code ?? 200} OK — the API is running.`,
        dot: "bg-emerald-400",
        text: "text-emerald-300",
      };
    case "not-found":
      return {
        label: "Not found",
        tooltip:
          "Reached the server, but /health returned 404. The backend may be an older build, or VITE_API_URL points somewhere unexpected.",
        dot: "bg-amber-400",
        text: "text-amber-300",
      };
    case "offline":
      return {
        label: "Offline",
        tooltip:
          "Couldn't reach the server. Check that the backend is running — uvicorn main:app --port 8000.",
        dot: "bg-red-400",
        text: "text-red-300",
      };
    case "error":
      return {
        label: `Error ${code ?? ""}`.trim(),
        tooltip: `The server responded with HTTP ${code} instead of 200. It may still be starting up or misconfigured.`,
        dot: "bg-amber-400",
        text: "text-amber-300",
      };
    default:
      return {
        label: "Checking…",
        tooltip: "Contacting the server…",
        dot: "bg-zinc-500 animate-pulse",
        text: "text-zinc-400",
      };
  }
}

/** Header status pill: a coloured dot + label, with an explanatory tooltip. */
export function ServerStatus() {
  const [state, setState] = useState<ServerState>("checking");
  const [code, setCode] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    const tick = async () => {
      const result = await checkHealth(ctrl.signal);
      if (cancelled) return;
      setState(result.state);
      setCode(result.code);
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearInterval(id);
    };
  }, []);

  const meta = statusMeta(state, code);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span
        role="status"
        tabIndex={0}
        aria-label={`Server ${meta.label}. ${meta.tooltip}`}
        className={`inline-flex cursor-default items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs ${meta.text} hover:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-600`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
        {meta.label}
      </span>
      {open && (
        <span className="absolute right-0 top-full z-50 mt-1 block w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-xs leading-relaxed text-zinc-300 shadow-lg">
          {meta.tooltip}
        </span>
      )}
    </span>
  );
}
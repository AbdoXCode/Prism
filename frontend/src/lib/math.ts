import katex from "katex";

/** A math segment found in text. */
interface MathSegment {
  latex: string;
  display: boolean;
}

/** Split text into plain and math segments.
 * Supports $$...$$ (display), \[...\] (display), \(...\) (inline), $...$ (inline).
 */
export function splitMath(text: string): Array<{ type: "text"; value: string } | { type: "math"; value: MathSegment }> {
  const pattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;
  const out: Array<{ type: "text"; value: string } | { type: "math"; value: MathSegment }> = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ type: "text", value: text.slice(last, idx) });
    const raw = m[0];
    if (raw.startsWith("$$")) {
      out.push({ type: "math", value: { latex: raw.slice(2, -2), display: true } });
    } else if (raw.startsWith("\\[")) {
      out.push({ type: "math", value: { latex: raw.slice(2, -2), display: true } });
    } else if (raw.startsWith("\\(")) {
      out.push({ type: "math", value: { latex: raw.slice(2, -2), display: false } });
    } else {
      // Single-dollar inline: skip currency-like "$5" / "$5 and $10" false positives
      const inner = raw.slice(1, -1);
      if (/^\d[\d.,]*$/.test(inner.trim()) || inner.trim().length === 0) {
        out.push({ type: "text", value: raw });
      } else {
        out.push({ type: "math", value: { latex: inner, display: false } });
      }
    }
    last = idx + raw.length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

/** Render a LaTeX string to HTML. Never throws — falls back to raw text. */
export function renderLatex(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  } catch {
    return `<span>${escapeHtml(latex)}</span>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

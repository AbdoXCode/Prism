import React from "react";
import { renderLatex, splitMath } from "./math";

/* ---------- inline ---------- */

function PageBadge({ label }: { label: string }) {
  return (
    <span
      dir="auto"
      className="mx-0.5 inline-block whitespace-nowrap rounded bg-emerald-500/15 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-emerald-300"
    >
      {label}
    </span>
  );
}

const INLINE_TOKEN =
  /(`[^`\n]+`|\*\*[^*\n]+?\*\*|__[^_\n]+?__|\*[^*\n]+?\*|_[^_\n]+?_)/g;

function parseMdRuns(text: string, key: string): React.ReactNode[] {
  const parts = text.split(INLINE_TOKEN);
  return parts.map((part, i) => {
    const k = `${key}-${i}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={k}
          className="rounded bg-zinc-950 px-1 py-0.5 font-mono text-[12px] text-emerald-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (
      (part.startsWith("**") && part.endsWith("**") && part.length > 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length > 4)
    ) {
      const inner = part.slice(2, -2);
      return (
        <strong key={k} className="font-semibold text-zinc-50">
          {parseMdRuns(inner, k)}
        </strong>
      );
    }
    if (
      part.length > 2 &&
      ((part.startsWith("*") && part.endsWith("*")) ||
        (part.startsWith("_") && part.endsWith("_")))
    ) {
      const inner = part.slice(1, -1);
      return (
        <em key={k}>
          {parseMdRuns(inner, k)}
        </em>
      );
    }
    return <React.Fragment key={k}>{part}</React.Fragment>;
  });
}

/** Inline rendering: citation badges + KaTeX math + bold/italic/code.
 * Citations stay in Arabic [المصدر X] and render as a green chip.
 * Accepts أ/ا/إ/آ + ال variants + English fallback + any Unicode space
 * (regular, NBSP U+00A0, narrow NBSP U+202F — all covered by \s),
 * so the model can never leak a raw "[المصدر 7]" as plain text. */
const CITATION_RE = /\[(?:Pages?|P\.?|Sources?|[أإآا]?ل?(?:مصدر|صفح[ةه]))\s*\d+\]/i;
const CITATION_TOKEN = new RegExp(`(${CITATION_RE.source})`, "gi");
const CITATION_FULL = new RegExp(`^${CITATION_RE.source}$`, "i");
export function renderInline(text: string, key: string): React.ReactNode[] {
  const cited = text.split(CITATION_TOKEN);
  return cited.map((part, ci) => {
    if (CITATION_FULL.test(part)) {
      return <PageBadge key={`${key}-c${ci}`} label={part} />;
    }
    const segs = splitMath(part);
    if (segs.length === 1 && segs[0].type === "text") {
      return <React.Fragment key={`${key}-c${ci}`}>{parseMdRuns(part, `${key}-c${ci}`)}</React.Fragment>;
    }
    return (
      <React.Fragment key={`${key}-c${ci}`}>
        {segs.map((s, si) =>
          s.type === "text" ? (
            <React.Fragment key={si}>{parseMdRuns(s.value, `${key}-c${ci}-t${si}`)}</React.Fragment>
          ) : (
            <span
              key={si}
              dir="ltr"
              className={s.value.display ? "my-1 block overflow-x-auto py-1" : "inline"}
              dangerouslySetInnerHTML={{ __html: renderLatex(s.value.latex, s.value.display) }}
            />
          ),
        )}
      </React.Fragment>
    );
  });
}

/* ---------- blocks ---------- */

interface ListItem {
  ordered: boolean;
  indent: number;
  text: string;
}

/** Strong RTL scripts (Arabic, Hebrew, Persian, Urdu, …). */
const RTL_RE = /[؀-ۿ֐-׿ﭐ-﷿ﹰ-﻿]/;

/** dir=auto keys off the FIRST strong char, so "12. نص" or "[Page 3] نص"
 *  stays LTR. Any strong RTL char flips the whole item instead. */
function itemDir(text: string): "rtl" | "auto" {
  return RTL_RE.test(text) ? "rtl" : "auto";
}

function renderList(items: ListItem[], key: string, small: boolean) {
  return (
    <ul key={key} className={`space-y-1 ${small ? "text-xs" : "text-sm"}`}>
      {items.map((it, i) => (
        <li
          key={i}
          dir={itemDir(it.text)}
          className="flex gap-2 text-start"
          style={{ marginInlineStart: `${Math.min(it.indent, 4) * 1.1}rem` }}
        >
          <span className="shrink-0 text-emerald-400">{it.ordered ? `${i + 1}.` : "•"}</span>
          <span className="min-w-0 flex-1" dir="auto">{renderInline(it.text, `${key}-li${i}`)}</span>
        </li>
      ))}
    </ul>
  );
}

function isTableSeparator(line: string): boolean {
  const cells = line.trim().replace(/^\||\|$/g, "").split("|");
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.trim()));
}

function renderTable(lines: string[], key: string) {
  const rows = lines.map((l) =>
    l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()),
  );
  const [header, ...body] = rows;
  return (
    <div key={key} className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i} dir="auto" className="border border-zinc-700 bg-zinc-800 px-2 py-1 text-start font-semibold">
                {renderInline(h, `${key}-h${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} dir="auto" className="border border-zinc-800 px-2 py-1 text-start">
                  {renderInline(c, `${key}-r${ri}c${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Block markdown: headings, lists, quotes, code, tables, math blocks, paragraphs. */
export function renderMarkdown(text: string, keyPrefix: string, small = false): React.ReactNode[] {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let n = 0;
  const key = () => `${keyPrefix}-b${n++}`;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      out.push(
        <pre key={key()} dir="ltr" className="overflow-x-auto rounded-lg bg-zinc-950 p-2.5 text-left font-mono text-xs leading-relaxed text-zinc-200">
          {buf.join("\n")}
        </pre>,
      );
      continue;
    }

    // $$ display-math block
    if (line.trim() === "$$") {
      const buf: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "$$") {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing $$
      out.push(
        <div key={key()} dir="ltr" className="overflow-x-auto py-1">
          <span dangerouslySetInnerHTML={{ __html: renderLatex(buf.join("\n"), true) }} />
        </div>,
      );
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const sizes = ["text-base font-bold", "text-[15px] font-bold", "text-sm font-semibold", "text-sm font-semibold"];
      out.push(
        <div key={key()} dir="auto" className={`${sizes[level - 1]} mt-1 text-start text-zinc-50`}>
          {renderInline(heading[2], `${keyPrefix}-h${n}`)}
        </div>,
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      out.push(<hr key={key()} className="my-2 border-zinc-800" />);
      i++;
      continue;
    }

    // Blockquote (group consecutive)
    if (line.trimStart().startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(
        <div key={key()} dir="auto" className="border-s-2 border-emerald-500/60 ps-2.5 text-start text-zinc-300">
          {renderInline(buf.join("\n"), `${keyPrefix}-q${n}`)}
        </div>,
      );
      continue;
    }

    // Table (header + separator + rows)
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const buf: string[] = [line];
      i += 2; // skip header + separator
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        buf.push(lines[i]);
        i++;
      }
      out.push(renderTable(buf, key()));
      continue;
    }

    // List (group consecutive items)
    const listMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (listMatch) {
      const items: ListItem[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) break;
        items.push({
          ordered: /^\d/.test(m[2]),
          indent: Math.floor(m[1].replace(/\t/g, "    ").length / 2),
          text: m[3],
        });
        i++;
      }
      out.push(renderList(items, key(), small));
      continue;
    }

    // Paragraph (group consecutive plain lines)
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trimStart().startsWith("```") &&
      lines[i].trim() !== "$$" &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !lines[i].trimStart().startsWith(">") &&
      !lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+/)
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(
      <div key={key()} dir="auto" className="whitespace-pre-wrap break-words text-start">
        {renderInline(buf.join("\n"), `${keyPrefix}-p${n}`)}
      </div>,
    );
  }

  return out;
}

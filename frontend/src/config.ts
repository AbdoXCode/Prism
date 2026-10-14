/**
 * Product-level branding. Keep this app-neutral: no company, store or
 * vertical-specific copy. Rename the product here (and in `index.html`,
 * which cannot read this module) and it updates everywhere else.
 */
export const APP_NAME = "Prism";

/** Shown under the product name in the header. */
export const APP_TAGLINE = "RAG Chatbot";

/** Suggested questions shown on the empty state — kept domain-agnostic. */
export const EXAMPLE_PROMPTS = [
  "Summarize this document",
  "What are the key takeaways?",
  "Which section covers pricing?",
] as const;
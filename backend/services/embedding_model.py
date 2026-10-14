"""Embedding backend — Google Gemini `gemini-embedding-001`.

Emits 384 dimensions, matching the `chunks.embedding vector(384)` column, so
no database migration is needed.

Queries and documents are embedded with different task types
(RETRIEVAL_QUERY / RETRIEVAL_DOCUMENT), which is what makes the vectors
comparable across the two sides.
"""

import os

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
GEMINI_DIMS = int(os.getenv("GEMINI_EMBEDDING_DIMS", "384"))
# Gemini accepts up to 100 inputs per embed_content call.
GEMINI_BATCH_SIZE = int(os.getenv("GEMINI_EMBED_BATCH_SIZE", "100"))


def embed_query(text: str) -> list[float]:
    """Embed one user question for retrieval."""
    return _embed([text], "RETRIEVAL_QUERY")[0]


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed stored chunks for indexing."""
    return _embed(texts, "RETRIEVAL_DOCUMENT")


_client = None


def _get_client():
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Get a free key at "
                "https://aistudio.google.com/apikey"
            )
        from google import genai

        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


def _embed(texts: list[str], task_type: str) -> list[list[float]]:
    from google.genai import types

    client = _get_client()
    out: list[list[float]] = []

    for start in range(0, len(texts), GEMINI_BATCH_SIZE):
        result = client.models.embed_content(
            model=GEMINI_MODEL,
            contents=texts[start : start + GEMINI_BATCH_SIZE],
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=GEMINI_DIMS,
            ),
        )
        out.extend(item.values for item in result.embeddings)

    return out
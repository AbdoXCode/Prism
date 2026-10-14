import json
from collections.abc import Iterator
from typing import Any, TypedDict

from groq import Groq

from .embedding_model import embed_query
from .supabase_client import supabase


class Source(TypedDict):
    page: int
    similarity: float
    content: str


def make_sse_event(event_name: str, data: Any) -> str:
    """Format one Server-Sent Event message."""
    return f"event: {event_name}\ndata: {json.dumps(data)}\n\n"


def find_relevant_chunks(question: str, document_ids: list[int]) -> list[dict[str, Any]]:
    """Find the document chunks most relevant to the user's question."""
    question_embedding = embed_query(question)
    response = supabase.rpc(
        "match_chunks",
        {
            "query_embedding": question_embedding,
            "match_count": 10,
            "target_document_ids": document_ids,
        },
    ).execute()

    return response.data or []


def build_prompt(question: str, chunks: list[dict[str, Any]]) -> str:
    """Create the prompt sent to the language model."""
    sources_text = "\n".join(
        f"SOURCE {number}\n"
        f"Page: {chunk['page_number']}\n\n"
        f"{chunk['content']}"
        for number, chunk in enumerate(chunks, start=1)
    )

    return f"""
You are a helpful AI assistant that answers questions using information retrieved from the user's uploaded PDF documents.

Your job is to answer the user's question accurately using ONLY the provided sources.

Rules:
1. Use only information contained in the provided sources.
2. Do not use your own knowledge to fill in missing information.
3. You may summarize, explain, and combine information from multiple sources.
4. If the sources do not contain enough information to answer the question, say:
   "I don't have enough information to answer that."
5. Always cite the source immediately after the statement it supports.
6. Use this citation format:
   [Page X]
7. Never invent a page number.
8. If multiple sources support an answer, cite each relevant source.
9. If the user asks a question that cannot be answered from the provided sources, clearly say that the information is not available.
10. Keep the answer concise but provide enough explanation to fully answer the question.

Retrieved sources:
{sources_text}

User question:
{question}
"""


def make_sources(chunks: list[dict[str, Any]]) -> list[Source]:
    """Convert database chunks into the source data returned to the client."""
    return [
        {
            "page": chunk["page_number"],
            "similarity": chunk["similarity"],
            "content": chunk["content"],
        }
        for chunk in chunks
    ]


def user_question(question: str, document_ids: list[int], groq_client: Groq) -> Iterator[str]:
    """Stream the answer, followed by sources and a completion event."""
    relevant_chunks = find_relevant_chunks(question, document_ids)
    prompt = build_prompt(question, relevant_chunks)

    try:
        answer_stream = groq_client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.15,
            stream=True,
        )

        for answer_chunk in answer_stream:
            token = answer_chunk.choices[0].delta.content
            if token:
                yield make_sse_event("token", token)

        yield make_sse_event("sources", make_sources(relevant_chunks))
        yield make_sse_event("done", {"message": "complete"})
    except Exception as error:
        yield make_sse_event("error", {"detail": str(error)})


from fastapi import HTTPException

from .supabase_client import supabase
from .chunk_pdf import chunk_pdf
from .embedding_model import embed_documents


async def analyze_pdf(document_id: int):
    response = supabase.table("documents").select("*").eq("id", document_id).single().execute()

    document = response.data

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    # Get PDF directly from Supabase Storage
    pdf_bytes = supabase.storage \
        .from_("pdfs") \
        .download(document["storage_path"])

    # Chunk PDF directly from memory
    chunks = chunk_pdf(pdf_bytes)

    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from PDF"
        )

    # Generate embeddings
    texts = [chunk["content"] for chunk in chunks]

    embeddings = embed_documents(texts)

    # Prepare rows
    rows = []

    for chunk, embedding in zip(chunks, embeddings):

        rows.append({
            "document_id": document_id,
            "content": chunk["content"],
            "embedding": embedding,
            "page_number": chunk["page_number"]
        })

    # Save chunks to Supabase
    supabase.table("chunks") \
        .insert(rows) \
        .execute()

    return {
        "message": "PDF analyzed successfully",
        "document_id": document_id,
        "chunks_created": len(chunks)
    }

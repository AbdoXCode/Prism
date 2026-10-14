from fastapi import HTTPException
from .supabase_client import supabase

async def delete_document(document_id: int):
    # 1. Get the document first so we know its storage path
    response = (
        supabase
        .table("documents")
        .select("id, filename, storage_path")
        .eq("id", document_id)
        .maybe_single()
        .execute()
    )

    document = response.data

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    storage_path = document["storage_path"]

    # 2. Delete the file from Supabase Storage
    supabase.storage \
        .from_("pdfs") \
        .remove([storage_path])

    # 3. Delete the document from the database
    #    chunks are deleted automatically because of ON DELETE CASCADE
    supabase \
        .table("documents") \
        .delete() \
        .eq("id", document_id) \
        .execute()

    return {
        "message": "Document deleted successfully",
        "document_id": document_id,
        "filename": document["filename"]
    }
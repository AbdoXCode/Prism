import uuid

from fastapi import File, HTTPException, UploadFile
from .supabase_client import supabase


async def upload_pdf(file: UploadFile = File(...)):

    # Make sure it is a PDF
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed"
        )

    # Read the uploaded file
    file_bytes = await file.read()

    # Create unique storage path
    print("Uploading PDF to Supabase Storage...")
    file_id = str(uuid.uuid4())

    storage_path = f"{file_id}.pdf"

    # Upload PDF to Supabase Storage
    supabase.storage.from_("pdfs").upload(
        storage_path,
        file_bytes,
        {
            "content-type": "application/pdf"
        }
    )

    # Save document information in database
    response = supabase.table("documents").insert({
        "filename": file.filename,
        "storage_path": storage_path
    }).execute()

    document = response.data[0]

    return {
        "message": "PDF uploaded successfully",
        "document_id": document["id"],
        "filename": document["filename"],
        "storage_path": document["storage_path"]
    }

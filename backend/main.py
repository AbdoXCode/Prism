import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from groq import Groq

from services.upload_supabase import upload_pdf
from services.analyze_pdf import analyze_pdf as analyze_pdf_service
from services.user_question import user_question
from services.delete_document import delete_document


load_dotenv()


groq = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

app = FastAPI()

# Comma-separated list of browser origins allowed to call this API, e.g.
#   CORS_ORIGINS=https://your-app.vercel.app
# Defaults to the Vite dev server so local dev works with nothing configured.
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
CORS_ORIGINS = _origins or ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QuestionRequest(BaseModel):
    question: str
    document_ids: list[int] 



@app.get("/")
def root():
    return {
        "status": "200 OK",
        "message": "RAG API is running"
    }

@app.get("/health")
def health_check():
    return {
        "status": "200 OK",
        "message": "RAG API is healthy"
    }

@app.post("/ask")
def ask_question(request: QuestionRequest):
    return StreamingResponse(
        user_question(request.question,request.document_ids, groq),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Stop nginx / Render / any reverse proxy from buffering the
            # stream — without this the whole answer arrives at once.
            "X-Accel-Buffering": "no",
        },
    )
@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        result = await upload_pdf(file)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/{document_id}")
async def analyze_document(document_id: int):
    try:
        result = await analyze_pdf_service(document_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/documents/{document_id}")
async def delete(document_id: int):
    try:
        result = await delete_document(document_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 

from io import BytesIO

from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader


splitter = RecursiveCharacterTextSplitter(
    chunk_size=700,
    chunk_overlap=100
)


def chunk_pdf(pdf_bytes):

    reader = PdfReader(BytesIO(pdf_bytes))

    chunks = []

    for page_number, page in enumerate(reader.pages, start=1):

        text = page.extract_text()

        if not text:
            continue

        page_chunks = splitter.split_text(text)

        for chunk in page_chunks:
            chunks.append({
                "content": chunk,
                "page_number": page_number
            })

    return chunks

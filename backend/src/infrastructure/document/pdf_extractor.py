import os
from src.domain.interfaces.document_parser import DocumentParser
from src.domain.exceptions import DocumentParseError
import pymupdf4llm

class PyMuPDFExtractor(DocumentParser):
    """PDF Extractor using PyMuPDF and pymupdf4llm."""

    def extract_text(self, file_path: str) -> str:
        """Extract Markdown-formatted text from target PDFs."""
        if not os.path.exists(file_path):
            raise DocumentParseError(f"File not found: {file_path}")
            
        try:
            md_text = pymupdf4llm.to_markdown(file_path)
            return md_text
        except Exception as e:
            raise DocumentParseError(f"Failed to parse PDF {file_path}: {e}")

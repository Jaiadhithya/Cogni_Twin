from abc import ABC, abstractmethod

class DocumentParser(ABC):
    """Abstract interface for document parsing."""
    
    @abstractmethod
    def extract_text(self, file_path: str) -> str:
        """Extract Markdown-formatted text from target PDFs."""
        pass

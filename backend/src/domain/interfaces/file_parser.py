"""File parser interface."""

from typing import Protocol, Tuple, List
import pandas as pd

class FileParser(Protocol):
    """Protocol for parsing files into dataframes."""
    
    @staticmethod
    def validate_file(file_path: str, mime_type: str, original_filename: str) -> None:
        """Validate the file before parsing. Raises IngestionError subclasses on failure."""
        ...

    @staticmethod
    def parse(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
        """Parse file into DataFrame and return a list of warnings. Raises IngestionError subclasses on failure."""
        ...

"""CSV parsing and validation."""

import os
import csv
from typing import Tuple, List
import pandas as pd
import chardet
from .exceptions import FileValidationError

MAX_UPLOAD_SIZE_MB = 50
MAX_UPLOAD_ROWS = 100000

class CSVParser:
    """Parses and validates CSV files into pandas DataFrames."""

    @staticmethod
    def validate_file(file_path: str, mime_type: str, original_filename: str) -> None:
        """Validate the file before parsing."""
        if not original_filename.lower().endswith(".csv"):
            raise FileValidationError(f"File must be a CSV file. Received: {original_filename}")

        allowed_mimes = ["text/csv", "text/plain", "application/csv", "application/octet-stream"]
        if mime_type not in allowed_mimes:
            raise FileValidationError("Invalid file type. Expected CSV.")

        size_bytes = os.path.getsize(file_path)
        size_mb = size_bytes / (1024 * 1024)
        if size_mb > MAX_UPLOAD_SIZE_MB:
            raise FileValidationError(f"File size ({size_mb:.1f}MB) exceeds maximum allowed ({MAX_UPLOAD_SIZE_MB}MB).")

        if size_bytes == 0:
            raise FileValidationError("File is empty or contains only a header row.")

    @staticmethod
    def _detect_encoding(file_path: str) -> str:
        """Detect file encoding using chardet."""
        with open(file_path, 'rb') as f:
            raw_data = f.read(10000)
        
        result = chardet.detect(raw_data)
        if result['confidence'] and result['confidence'] < 0.5:
            return 'utf-8'
        return result['encoding'] or 'utf-8'

    @staticmethod
    def _detect_delimiter(file_path: str, encoding: str) -> str:
        """Detect CSV delimiter using csv.Sniffer."""
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                head = f.read(2048)
                sniffer = csv.Sniffer()
                dialect = sniffer.sniff(head, delimiters=",;\t|")
                return dialect.delimiter
        except Exception:
            return ","

    @staticmethod
    def parse(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
        """Parse CSV file into DataFrame and return warnings."""
        warnings = []
        
        try:
            encoding = CSVParser._detect_encoding(file_path)
            delimiter = CSVParser._detect_delimiter(file_path, encoding)
            
            # Using read_csv to parse
            try:
                df = pd.read_csv(
                    file_path,
                    encoding=encoding,
                    sep=delimiter,
                    header=0,
                    dtype=str,
                    keep_default_na=False,
                    skipinitialspace=True,
                    nrows=MAX_UPLOAD_ROWS + 1,
                    on_bad_lines="warn" # Valid in modern pandas
                )
            except Exception as e:
                raise FileValidationError("File could not be parsed as CSV.") from e
                
            if len(df) == 0:
                raise FileValidationError("File is empty or contains only a header row.")
                
            if len(df) > MAX_UPLOAD_ROWS:
                raise FileValidationError(f"File exceeds maximum allowed rows ({MAX_UPLOAD_ROWS}).")
            
            # Clean headers
            df.columns = df.columns.str.strip().str.lower()
            
            # Pandas renames duplicates to .1, .2 etc. We need to convert that to _1, _2
            import re
            new_cols = []
            for col in df.columns:
                if re.search(r'\.\d+$', col):
                    new_col = re.sub(r'\.(\d+)$', r'_\1', col)
                    new_cols.append(new_col)
                    warnings.append(f"Duplicate column name renamed to '{new_col}'.")
                else:
                    new_cols.append(col)
            df.columns = new_cols

            return df, warnings
            
        except FileValidationError:
            raise
        except Exception as e:
            raise FileValidationError(f"File could not be parsed as CSV. Error: {str(e)}") from e

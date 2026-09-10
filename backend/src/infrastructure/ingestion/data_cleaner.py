"""Data cleaning operations."""

import math
import re
from datetime import datetime
from typing import Tuple, List, Dict, Any, Optional

import numpy as np
import pandas as pd

from src.domain.value_objects import EntityType

DATE_COLUMNS = {"sale_date", "first_purchase_date", "last_restocked"}
NUMERIC_COLUMNS = {
    "quantity", "unit_price", "total_amount", "discount", "cost_price", 
    "quantity_on_hand", "reorder_level", "reorder_quantity", "lead_time_days", "rating"
}
STRING_COLUMNS_REQUIRED = {"name"}  # entity name

DATE_FORMATS = [
    # ISO & standard datetime
    "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S.%f%z",
    # Dashes
    "%d-%m-%Y", "%m-%d-%Y", "%d-%b-%Y", "%d-%B-%Y",
    # Slashes (non-standard date formats)
    "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d/%m/%y", "%m/%d/%y", "%Y/%d/%m",
    # Dots (non-standard date formats)
    "%Y.%m.%d", "%d.%m.%Y", "%m.%d.%Y", "%d.%m.%y",
    # Spaces
    "%d %b %Y", "%b %d, %Y", "%B %d, %Y", "%d %B %Y"
]

class DataCleaner:
    """Cleans and transforms mapped DataFrames and arbitrary dynamic CSV schemas."""

    @staticmethod
    def _is_numeric_like(val: Any) -> bool:
        """Check if a value or string represents a valid numeric quantity (signed, currency, scientific)."""
        if pd.isna(val) or val is None or val == "":
            return False
        if isinstance(val, (int, float, np.integer, np.floating)):
            return not (np.isnan(val) or np.isinf(val))
        s = str(val).strip()
        if not s or s.lower() in ('nan', 'none', 'null', 'n/a', '<na>', '-', '#', 'inf', '-inf'):
            return False
        # Remove parentheses if accounting style: (123.45)
        if s.startswith('(') and s.endswith(')'):
            s = s[1:-1].strip()
        # Remove currency symbols, commas, and percentage sign
        s_clean = re.sub(r'[₹$€£¥₩,%]|USD|INR|EUR|GBP|Rs\.?', '', s, flags=re.IGNORECASE).strip()
        if not s_clean:
            return False
        try:
            float(s_clean)
            return True
        except (ValueError, OverflowError):
            return False

    @staticmethod
    def _sanitize_cell(val: Any) -> Any:
        """Sanitize CSV injection while strictly preserving valid signed numbers and scientific notation."""
        if isinstance(val, str) and len(val) > 0:
            first_char = val[0]
            if first_char in ('=', '@'):
                return val[1:]
            elif first_char == '+':
                # For numbers like +123, stripping '+' leaves 123 (preserving numeric value and matching CSV injection test specs)
                return val[1:]
            elif first_char == '-':
                # Strictly preserve negative signed numbers, scientific notation, and financial currencies
                if DataCleaner._is_numeric_like(val):
                    return val
                # Non-numeric string starting with '-' is stripped to prevent CSV formula triggers
                return val[1:]
        return val

    @staticmethod
    def _normalize_whitespace(df: pd.DataFrame) -> pd.DataFrame:
        """Strip and normalize whitespace and sanitize CSV injection."""
        for col in df.columns:
            # Normalize whitespace and sanitize
            df[col] = df[col].astype(str).str.strip()
            df[col] = df[col].replace(r'\s+', ' ', regex=True)
            df[col] = df[col].apply(DataCleaner._sanitize_cell)
            df[col] = df[col].replace(['nan', 'None', 'none', 'null', 'NULL', '', '<NA>', 'N/A', 'n/a'], np.nan)
        return df

    @staticmethod
    def _clean_numeric(value: Any) -> float:
        """
        Clean string or numeric value to float.
        Strictly preserves signed numbers, scientific notation, financial currencies, and accounting parentheses.
        """
        if pd.isna(value) or value is None or value == "":
            return np.nan
        if isinstance(value, (int, float, np.integer, np.floating)):
            if np.isinf(value) or np.isnan(value):
                return np.nan
            return float(value)
            
        val_str = str(value).strip()
        if val_str.lower() in ('nan', 'none', 'null', 'n/a', '<na>', '-', '#', 'inf', '-inf', ''):
            return np.nan

        # Accounting negative in parentheses: (1,234.56) or ($500.00)
        is_negative = False
        if val_str.startswith('(') and val_str.endswith(')'):
            is_negative = True
            val_str = val_str[1:-1].strip()

        # Handle explicit signs before currency: -$50 or +$50
        if val_str.startswith('-'):
            is_negative = True
            val_str = val_str[1:].strip()
        elif val_str.startswith('+'):
            val_str = val_str[1:].strip()

        is_percentage = '%' in val_str

        # Remove currency symbols and thousands separators
        val_str = re.sub(r'[₹$€£¥₩,%]|USD|INR|EUR|GBP|Rs\.?', '', val_str, flags=re.IGNORECASE).strip()

        # Handle negative sign after currency symbol: $-50 or €-50
        if val_str.startswith('-'):
            is_negative = not is_negative
            val_str = val_str[1:].strip()
        elif val_str.startswith('+'):
            val_str = val_str[1:].strip()

        try:
            val_float = float(val_str)
            if is_percentage:
                val_float /= 100.0
            if is_negative:
                val_float = -val_float
            if math.isinf(val_float) or math.isnan(val_float):
                return np.nan
            # Outlier guard: prevent float overflow from corrupt entries
            if abs(val_float) > 1e20:
                return np.nan
            return val_float
        except (ValueError, OverflowError):
            return np.nan

    @staticmethod
    def _parse_epoch_series(series: pd.Series) -> Optional[pd.Series]:
        """Attempt to parse integer or float epoch timestamps into UTC naive datetimes."""
        try:
            numeric_vals = pd.to_numeric(series.dropna(), errors='coerce')
            if numeric_vals.empty or (numeric_vals.isna().sum() / max(len(numeric_vals), 1)) > 0.5:
                return None
            median_val = float(numeric_vals.median())
            # 10 digits: ~5e8 to 2.5e9 -> seconds (1985 to 2049)
            if 500_000_000 <= median_val <= 2_500_000_000:
                parsed = pd.to_datetime(pd.to_numeric(series, errors='coerce'), unit='s', errors='coerce')
                return parsed
            # 13 digits: ~5e11 to 2.5e12 -> milliseconds
            elif 500_000_000_000 <= median_val <= 2_500_000_000_000:
                parsed = pd.to_datetime(pd.to_numeric(series, errors='coerce'), unit='ms', errors='coerce')
                return parsed
            # 16 digits: microseconds
            elif 500_000_000_000_000 <= median_val <= 2_500_000_000_000_000:
                parsed = pd.to_datetime(pd.to_numeric(series, errors='coerce'), unit='us', errors='coerce')
                return parsed
        except Exception:
            pass
        return None

    @staticmethod
    def _parse_dates(series: pd.Series, warnings: List[str], col_name: str) -> pd.Series:
        """Parse date column using epoch detection, format voting, and fallback parser with timezone stripping."""
        if series.isna().all():
            return series

        col_lower = str(col_name).lower()
        is_date_named = any(k in col_lower for k in ['date', 'time', 'timestamp', 'epoch', 'day', 'ds', 'period'])

        # 1. Check for epoch timestamps
        if pd.api.types.is_numeric_dtype(series) or is_date_named:
            epoch_parsed = DataCleaner._parse_epoch_series(series)
            if epoch_parsed is not None and epoch_parsed.notna().sum() > 0:
                return epoch_parsed

        non_null_vals = series.dropna().head(30).astype(str)
        if len(non_null_vals) == 0:
            return series

        best_format = None
        max_success = -1

        for fmt in DATE_FORMATS:
            success = 0
            for val in non_null_vals:
                try:
                    datetime.strptime(val.strip(), fmt)
                    success += 1
                except (ValueError, TypeError):
                    pass
            if success > max_success:
                max_success = success
                best_format = fmt
                if success == len(non_null_vals):
                    break

        has_tz_in_format = bool(best_format and ("%z" in best_format or "%Z" in best_format))
        if max_success > 0 and best_format:
            try:
                if has_tz_in_format:
                    parsed = pd.to_datetime(series, format=best_format, errors='coerce', utc=True)
                else:
                    parsed = pd.to_datetime(series, format=best_format, errors='coerce')
            except Exception:
                parsed = pd.to_datetime(series, errors='coerce', format='mixed', utc=True)
        else:
            try:
                parsed = pd.to_datetime(series, errors='coerce', format='mixed', utc=True)
            except Exception:
                parsed = pd.to_datetime(series, errors='coerce')

        if parsed.dtype == 'object':
            parsed = pd.to_datetime(parsed, errors='coerce', utc=True)

        # Convert timezone-aware datetimes to UTC naive datetimes
        if hasattr(parsed, 'dt') and hasattr(parsed.dt, 'tz') and parsed.dt.tz is not None:
            try:
                parsed = parsed.dt.tz_convert('UTC').dt.tz_localize(None)
            except Exception:
                parsed = parsed.dt.tz_localize(None)

        # Add warnings for failed parses
        failed_mask = series.notna() & parsed.isna()
        if failed_mask.any():
            failed_indices = failed_mask[failed_mask].index[:10]
            for idx in failed_indices:
                orig = series.loc[idx]
                warnings.append(f"Row {idx + 2}: date value '{orig}' could not be parsed, set to null.")
            if failed_mask.sum() > 10:
                warnings.append(f"Total of {failed_mask.sum()} unparseable date values in '{col_name}' set to null.")

        return parsed

    @staticmethod
    def clean_dynamic_df(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """
        Clean an arbitrary dynamic CSV dataframe without synthetic column pollution.
        Preserves signed numbers, scientific notation, and financial currencies while replacing nulls.
        Parses non-standard dates (slashes, dots, epoch timestamps, ISO with timezone offsets).
        """
        warnings: List[str] = []
        df = df.copy()

        # 1. Eliminate synthetic / artifact index columns (e.g. Unnamed: 0, index, _index)
        valid_cols = []
        for c in df.columns:
            c_str = str(c).strip()
            c_lower = c_str.lower()
            if not c_str or c_lower.startswith("unnamed:") or c_lower in ("index", "_index"):
                # If column is empty or simply an integer sequence 0..N, omit it
                if df[c].isna().all() or (pd.api.types.is_numeric_dtype(df[c]) and (df[c].dropna() == range(len(df[c].dropna()))).all()):
                    continue
            valid_cols.append(c)
        df = df[valid_cols]

        # 2. Normalize whitespace and clean spreadsheet injections while strictly preserving signs
        for col in df.columns:
            if df[col].dtype == 'object' or pd.api.types.is_string_dtype(df[col]):
                df[col] = df[col].astype(str).str.strip()
                df[col] = df[col].replace(r'\s+', ' ', regex=True)
                df[col] = df[col].apply(DataCleaner._sanitize_cell)
                df[col] = df[col].replace(['nan', 'None', 'none', 'null', 'NULL', '', '<NA>', 'N/A', 'n/a', '-', '#'], np.nan)

        # 3. Detect and parse non-standard dates (slashes, dots, epochs, ISO with timezones)
        for col in df.columns:
            col_lower = str(col).lower()
            is_date_col = any(k in col_lower for k in ['date', 'time', 'timestamp', 'epoch', 'day', 'ds', 'period', 'created', 'updated'])

            if pd.api.types.is_numeric_dtype(df[col]):
                if is_date_col:
                    epoch_parsed = DataCleaner._parse_epoch_series(df[col])
                    if epoch_parsed is not None and epoch_parsed.notna().sum() > 0:
                        df[col] = epoch_parsed
            elif df[col].dtype == 'object' or pd.api.types.is_string_dtype(df[col]):
                sample = df[col].dropna().head(25)
                if len(sample) > 0:
                    try:
                        parsed_sample = pd.to_datetime(sample, errors='coerce', format='mixed')
                        valid_ratio = parsed_sample.notna().sum() / len(sample)
                        if (valid_ratio >= 0.6 or is_date_col) and parsed_sample.notna().sum() > 0:
                            df[col] = DataCleaner._parse_dates(df[col], warnings, str(col))
                    except Exception:
                        pass

        # 4. Detect and convert dirty numeric strings (financial currencies, commas, scientific notation, signed)
        for col in df.columns:
            if df[col].dtype == 'object' or pd.api.types.is_string_dtype(df[col]):
                sample = df[col].dropna().head(30)
                if len(sample) > 0:
                    num_count = sum(1 for v in sample if pd.notna(DataCleaner._clean_numeric(v)))
                    col_lower = str(col).lower()
                    is_num_col_name = any(k in col_lower for k in [
                        'price', 'cost', 'amount', 'total', 'revenue', 'profit', 'units',
                        'qty', 'quantity', 'spend', 'discount', 'cogs', 'lead_time', 'rating',
                        'rate', 'pct', 'percent', 'score', 'target', 'margin', 'gross', 'net'
                    ])
                    if (num_count / len(sample) >= 0.7) or (is_num_col_name and num_count > 0):
                        df[col] = df[col].apply(DataCleaner._clean_numeric)

        # 5. Outlier sanitization: replace inf / -inf with NaN
        for col in df.select_dtypes(include=['number']).columns:
            df[col] = df[col].replace([np.inf, -np.inf], np.nan)

        return df, warnings

    @staticmethod
    def clean(df: pd.DataFrame, entity_type: EntityType, mapping: Dict[str, str]) -> Tuple[pd.DataFrame, List[str], int]:
        """
        Clean the dataframe according to entity schema mapping.
        Returns:
            Tuple of (cleaned_df, warnings, skipped_rows_count)
        """
        warnings: List[str] = []
        skipped_rows = 0
        
        # Rename columns according to mapping, drop unmapped
        df = df[list(mapping.keys())].rename(columns=mapping)
        
        # 1. Whitespace
        df = DataCleaner._normalize_whitespace(df)
        
        # 2. Date parsing
        for col in df.columns:
            if col in DATE_COLUMNS:
                df[col] = DataCleaner._parse_dates(df[col], warnings, col)
                
        # 3. Numeric parsing
        for col in df.columns:
            if col in NUMERIC_COLUMNS:
                df[col] = df[col].apply(DataCleaner._clean_numeric)
                
                # Specific rule: negative quantity -> absolute + warning
                if col in ["quantity", "quantity_on_hand"]:
                    neg_mask = df[col] < 0
                    if neg_mask.any():
                        for idx in df[neg_mask].index:
                            warnings.append(f"Row {idx + 2}: negative quantity converted to absolute value")
                        df.loc[neg_mask, col] = df.loc[neg_mask, col].abs()
                        
        # 4. Missing value handling & derived computations for sales
        if entity_type == "sales":
            has_qty = "quantity" in df.columns
            has_price = "unit_price" in df.columns
            has_total = "total_amount" in df.columns
            
            if has_total and has_qty and has_price:
                # Derive total_amount
                missing_total = df["total_amount"].isna()
                can_derive_total = missing_total & df["quantity"].notna() & df["unit_price"].notna()
                if can_derive_total.any():
                    df.loc[can_derive_total, "total_amount"] = df.loc[can_derive_total, "quantity"] * df.loc[can_derive_total, "unit_price"]
                    warnings.append(f"total_amount computed as quantity × unit_price for {can_derive_total.sum()} rows")
                    
                # Derive quantity
                missing_qty = df["quantity"].isna()
                can_derive_qty = missing_qty & df["total_amount"].notna() & df["unit_price"].notna() & (df["unit_price"] != 0)
                if can_derive_qty.any():
                    df.loc[can_derive_qty, "quantity"] = (df.loc[can_derive_qty, "total_amount"] / df.loc[can_derive_qty, "unit_price"]).astype(int)
                    
                # Derive unit_price
                missing_price = df["unit_price"].isna()
                can_derive_price = missing_price & df["total_amount"].notna() & df["quantity"].notna() & (df["quantity"] != 0)
                if can_derive_price.any():
                    df.loc[can_derive_price, "unit_price"] = df.loc[can_derive_price, "total_amount"] / df.loc[can_derive_price, "quantity"]

        # Default fills
        for col in df.columns:
            if col == "discount":
                df[col] = df[col].fillna(0.0)
            elif col in NUMERIC_COLUMNS:
                if col == "quantity":
                    missing = df[col].isna()
                    if missing.any():
                        for idx in df[missing].index:
                            warnings.append(f"Row {idx + 2}: missing '{col}' value, filled with 1")
                    df[col] = df[col].fillna(1)
                else:
                    missing = df[col].isna()
                    if missing.any():
                        for idx in df[missing].index:
                            warnings.append(f"Row {idx + 2}: missing '{col}' value, filled with 0")
                    df[col] = df[col].fillna(0)

        # Drop required columns that are missing
        initial_len = len(df)
        if "sale_date" in df.columns:
            missing = df["sale_date"].isna()
            if missing.any():
                warnings.append(f"Dropped {missing.sum()} rows missing required 'sale_date'")
            df = df.dropna(subset=["sale_date"])
        if "name" in df.columns:
            missing = df["name"].isna()
            if missing.any():
                warnings.append(f"Dropped {missing.sum()} rows missing required 'name'")
            df = df.dropna(subset=["name"])
            
        skipped_rows += (initial_len - len(df))
        
        # 5. Deduplication
        initial_len = len(df)
        df = df.drop_duplicates()
        dups_removed = initial_len - len(df)
        if dups_removed > 0:
            warnings.append(f"Removed {dups_removed} duplicate rows.")
            
        # 6. Empty Row Removal
        initial_len = len(df)
        df = df.dropna(how='all')
        empty_removed = initial_len - len(df)
        if empty_removed > 0:
            warnings.append(f"Removed {empty_removed} empty rows.")
            
        # Ensure quantities are integers where appropriate
        int_cols = ["quantity", "quantity_on_hand", "reorder_level", "reorder_quantity", "lead_time_days"]
        for col in int_cols:
            if col in df.columns:
                df[col] = df[col].fillna(0).astype(int)

        return df, warnings, skipped_rows

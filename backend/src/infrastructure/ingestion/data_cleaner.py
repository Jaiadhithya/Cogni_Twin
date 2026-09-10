"""Data cleaning operations."""

import pandas as pd
import numpy as np
from typing import Tuple, List, Dict, Any
from datetime import datetime
import re

from src.domain.value_objects import EntityType

DATE_COLUMNS = {"sale_date", "first_purchase_date", "last_restocked"}
NUMERIC_COLUMNS = {
    "quantity", "unit_price", "total_amount", "discount", "cost_price", 
    "quantity_on_hand", "reorder_level", "reorder_quantity", "lead_time_days", "rating"
}
STRING_COLUMNS_REQUIRED = {"name"} # entity name

DATE_FORMATS = [
    "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%m-%d-%Y", 
    "%Y/%m/%d", "%d-%b-%Y", "%d %b %Y", "%b %d, %Y"
]

class DataCleaner:
    """Cleans and transforms mapped DataFrames."""

    @staticmethod
    def _sanitize_cell(val: Any) -> Any:
        if isinstance(val, str) and len(val) > 0:
            if val[0] in ('=', '@', '+'):
                return val[1:]
            elif val[0] == '-':
                try:
                    float(val)
                    return val  # Keep signed negative numbers intact
                except ValueError:
                    return val[1:]  # Strip dangerous spreadsheet formula triggers
        return val

    @staticmethod
    def _normalize_whitespace(df: pd.DataFrame) -> pd.DataFrame:
        """Strip and normalize whitespace and sanitize CSV injection."""
        # Convert all to strings, handle NA, strip whitespace
        for col in df.columns:
            # We assume dtype is mostly string initially
            df[col] = df[col].astype(str).str.strip()
            df[col] = df[col].replace(r'\s+', ' ', regex=True)
            # Sanitize CSV injection while preserving valid signed numbers
            df[col] = df[col].apply(DataCleaner._sanitize_cell)
            df[col] = df[col].replace(['nan', 'None', '', '<NA>'], np.nan)
        return df

    @staticmethod
    def _clean_numeric(value: str) -> float:
        """Clean string to float."""
        if pd.isna(value) or value == "":
            return np.nan
        # Remove currency symbols and thousands separators
        val_str = str(value)
        is_percentage = '%' in val_str
        val_str = re.sub(r'[₹$€£¥,%]', '', val_str).strip()
        try:
            val_float = float(val_str)
            if is_percentage:
                val_float /= 100.0
            return val_float
        except ValueError:
            return np.nan

    @staticmethod
    def _parse_dates(series: pd.Series, warnings: List[str], col_name: str) -> pd.Series:
        """Parse date column using majority voting for format."""
        if series.isna().all():
            return series
            
        non_null_vals = series.dropna().head(20).astype(str)
        if len(non_null_vals) == 0:
            return series

        best_format = None
        max_success = -1
        
        for fmt in DATE_FORMATS:
            success = 0
            for val in non_null_vals:
                try:
                    datetime.strptime(val, fmt)
                    success += 1
                except ValueError:
                    pass
            if success > max_success:
                max_success = success
                best_format = fmt
                
        if max_success == 0:
            # Fallback to pandas infer
            parsed = pd.to_datetime(series, errors='coerce')
        else:
            parsed = pd.to_datetime(series, format=best_format, errors='coerce')
            
        # Add warnings for failed parses
        failed_mask = series.notna() & parsed.isna()
        if failed_mask.any():
            failed_indices = failed_mask[failed_mask].index
            for idx in failed_indices:
                orig = series.loc[idx]
                warnings.append(f"Row {idx + 2}: date value '{orig}' could not be parsed, set to null.")
                
        return parsed

    @staticmethod
    def clean(df: pd.DataFrame, entity_type: EntityType, mapping: Dict[str, str]) -> Tuple[pd.DataFrame, List[str], int]:
        """
        Clean the dataframe.
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
                
                # specific rule: negative quantity -> absolute + warning
                if col in ["quantity", "quantity_on_hand"]:
                    neg_mask = df[col] < 0
                    if neg_mask.any():
                        for idx in df[neg_mask].index:
                            warnings.append(f"Row {idx + 2}: negative quantity converted to absolute value")
                        df.loc[neg_mask, col] = df.loc[neg_mask, col].abs()
                        
        # 4. Missing value handling
        # Derived computations for sales
        if entity_type == "sales":
            has_qty = "quantity" in df.columns
            has_price = "unit_price" in df.columns
            has_total = "total_amount" in df.columns
            
            if has_total and has_qty and has_price:
                # derive total_amount
                missing_total = df["total_amount"].isna()
                can_derive_total = missing_total & df["quantity"].notna() & df["unit_price"].notna()
                if can_derive_total.any():
                    df.loc[can_derive_total, "total_amount"] = df.loc[can_derive_total, "quantity"] * df.loc[can_derive_total, "unit_price"]
                    warnings.append(f"total_amount computed as quantity × unit_price for {can_derive_total.sum()} rows")
                    
                # derive quantity
                missing_qty = df["quantity"].isna()
                can_derive_qty = missing_qty & df["total_amount"].notna() & df["unit_price"].notna() & (df["unit_price"] != 0)
                if can_derive_qty.any():
                    df.loc[can_derive_qty, "quantity"] = (df.loc[can_derive_qty, "total_amount"] / df.loc[can_derive_qty, "unit_price"]).astype(int)
                    
                # derive unit_price
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

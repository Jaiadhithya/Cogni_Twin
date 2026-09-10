"""Row validator for applying business rules."""

from typing import Tuple, List, Dict, Any
import pandas as pd
from datetime import datetime
import re

from src.domain.value_objects import EntityType

EMAIL_REGEX = re.compile(r"^[^@]+@[^@]+\.[^@]+$")

class RowValidator:
    """Validates rows against business rules."""

    @staticmethod
    def validate(df: pd.DataFrame, entity_type: EntityType) -> Tuple[List[Dict[str, Any]], List[str], List[str]]:
        """
        Validate rows based on entity type.
        Returns:
            Tuple of (valid_records_as_dicts, warnings, errors)
        """
        warnings: List[str] = []
        errors: List[str] = []
        valid_records = []
        
        today = pd.Timestamp(datetime.now().date())
        min_date = pd.Timestamp("2000-01-01")

        for row_idx, row in df.iterrows():
            idx = row_idx + 2  # 1-indexed + header row
            is_valid = True
            record = row.to_dict()

            if entity_type == "sales":
                # sale_date range
                if pd.notna(record.get("sale_date")):
                    if record["sale_date"] > today:
                        warnings.append(f"Row {idx}: Future sale date detected")
                    if record["sale_date"] < min_date:
                        errors.append(f"Row {idx}: sale_date before 2000-01-01")
                        is_valid = False
                
                # quantity
                if record.get("quantity", 1) <= 0:
                    errors.append(f"Row {idx}: quantity is zero or negative")
                    is_valid = False
                    
                # unit_price
                if record.get("unit_price", 0) < 0:
                    errors.append(f"Row {idx}: unit_price is negative")
                    is_valid = False
                    
                # amount mismatch > 10%
                if is_valid and pd.notna(record.get("total_amount")) and pd.notna(record.get("quantity")) and pd.notna(record.get("unit_price")):
                    expected = record["quantity"] * record["unit_price"]
                    actual = record["total_amount"]
                    if expected != 0:
                        diff_percent = abs((actual - expected) / expected)
                        if diff_percent > 0.10:
                            warnings.append(f"Row {idx}: amount mismatch (expected {expected:.2f}, got {actual:.2f}), keeping original")
                    
            elif entity_type == "products":
                if record.get("unit_price", 0) < 0:
                    errors.append(f"Row {idx}: unit_price is negative")
                    is_valid = False
                
                if pd.isna(record.get("name")) or str(record.get("name")).strip() == "":
                    errors.append(f"Row {idx}: name is empty")
                    is_valid = False
                    
            elif entity_type == "customers":
                if pd.isna(record.get("name")) or str(record.get("name")).strip() == "":
                    errors.append(f"Row {idx}: name is empty")
                    is_valid = False
                    
                email = record.get("email")
                if pd.notna(email) and isinstance(email, str) and email.strip() != "":
                    if not EMAIL_REGEX.match(email):
                        warnings.append(f"Row {idx}: email format invalid, set to null")
                        record["email"] = None
                        
            elif entity_type == "inventory":
                qty = record.get("quantity_on_hand", 0)
                if qty < 0:
                    warnings.append(f"Row {idx}: negative quantity on hand, set to 0")
                    record["quantity_on_hand"] = 0
                    
                if pd.isna(record.get("product_id")) and (pd.isna(record.get("product_name")) or str(record.get("product_name")).strip() == ""):
                    errors.append(f"Row {idx}: missing required column 'product_reference'")
                    is_valid = False
                    
            elif entity_type == "suppliers":
                if pd.isna(record.get("name")) or str(record.get("name")).strip() == "":
                    errors.append(f"Row {idx}: name is empty")
                    is_valid = False
                    
                rating = record.get("rating")
                if pd.notna(rating):
                    if rating > 5 or rating < 0:
                        warnings.append(f"Row {idx}: rating clamped to range [0, 5]")
                        record["rating"] = max(0, min(5, rating))
                        
                lead_time = record.get("lead_time_days")
                if pd.notna(lead_time):
                    if lead_time < 0:
                        warnings.append(f"Row {idx}: negative lead time, set to null")
                        record["lead_time_days"] = None

            if is_valid:
                # Filter out NA values as None
                clean_record = {k: (None if pd.isna(v) else v) for k, v in record.items()}
                valid_records.append(clean_record)

        return valid_records, warnings, errors

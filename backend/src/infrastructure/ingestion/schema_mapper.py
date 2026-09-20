"""Schema mapper for CSV columns."""

from typing import Dict, List, Tuple
from rapidfuzz import fuzz

from src.domain.value_objects import EntityType
from .exceptions import SchemaMappingError

# Predefined alias dictionaries from specification
ALIASES = {
    "sales": {
        "sale_date": ["date", "sale date", "transaction date", "order date", "dt", "dated", "invoice date", "billing date"],
        "category": ["category", "cat", "product category", "group", "type", "department"],
        "product_name": ["product", "product name", "item", "item name", "description", "product description", "sku name"],
        "product_id": ["product id", "product_id", "productid", "prod id", "item id", "sku"],
        "customer_name": ["customer", "customer name", "buyer", "client", "client name", "cust name"],
        "customer_id": ["customer id", "customer_id", "customerid", "cust id", "client id"],
        "quantity": ["qty", "quantity", "units", "no of items", "items", "count", "qty sold", "quantity sold"],
        "unit_price": ["price", "unit price", "rate", "selling price", "mrp", "price per unit", "cost"],
        "total_amount": ["total", "amount", "total amount", "grand total", "value", "amt", "net amount", "invoice amount", "sales amount", "revenue"],
        "discount": ["discount", "disc", "discount amount", "rebate"],
        "payment_method": ["payment", "payment method", "payment type", "pay method", "mode of payment", "payment mode"],
        "channel": ["channel", "sales channel", "source", "order source", "platform"],
    },
    "products": {
        "name": ["product", "product name", "name", "item", "item name", "title"],
        "category": ["category", "cat", "product category", "group", "type", "department"],
        "subcategory": ["subcategory", "sub category", "sub-category", "subcat"],
        "sku": ["sku", "sku code", "product code", "item code", "barcode", "upc"],
        "unit_price": ["price", "selling price", "mrp", "retail price", "unit price", "rate"],
        "cost_price": ["cost", "cost price", "purchase price", "buying price", "wholesale price"],
        "description": ["description", "desc", "details", "product description"],
    },
    "customers": {
        "name": ["name", "customer name", "full name", "client name", "buyer name"],
        "email": ["email", "email address", "e-mail", "mail", "customer email"],
        "phone": ["phone", "mobile", "telephone", "contact", "phone number", "mobile number", "tel"],
        "city": ["city", "location", "town"],
        "state": ["state", "province", "region"],
        "segment": ["segment", "customer segment", "type", "customer type", "class", "tier"],
        "first_purchase_date": ["first purchase", "first purchase date", "join date", "registration date", "first order date"],
    },
    "inventory": {
        "product_name": ["product", "product name", "item", "item name"],
        "product_id": ["product id", "product_id", "sku", "item code"],
        "quantity_on_hand": ["quantity", "stock", "on hand", "available", "qty", "current stock", "stock on hand", "units"],
        "reorder_level": ["reorder level", "min stock", "minimum", "reorder point", "safety stock"],
        "reorder_quantity": ["reorder qty", "reorder quantity", "order quantity"],
        "warehouse_location": ["location", "warehouse", "bin", "section", "store location"],
        "last_restocked": ["last restock", "last restocked", "restock date", "last received"],
    },
    "suppliers": {
        "name": ["name", "supplier name", "vendor name", "company", "vendor"],
        "contact_person": ["contact", "contact person", "contact name", "representative"],
        "email": ["email", "email address", "contact email"],
        "phone": ["phone", "telephone", "contact phone", "mobile"],
        "city": ["city", "location"],
        "state": ["state", "region"],
        "lead_time_days": ["lead time", "lead time days", "delivery days", "delivery time", "lead_time"],
        "rating": ["rating", "score", "performance", "rank", "supplier rating"],
        "payment_terms": ["payment terms", "terms", "payment", "credit terms"],
    }
}

REQUIRED_COLUMNS = {
    "sales": ["sale_date", "quantity", "unit_price"],
    "products": ["name"],
    "customers": ["name"],
    "inventory": ["quantity_on_hand"],
    "suppliers": ["name"]
}

class SchemaMapper:
    """Maps CSV columns to target database schema columns."""

    def __init__(self, min_confidence: float = 0.6):
        self.min_confidence = min_confidence

    def map_columns(self, entity_type: EntityType, csv_columns: List[str]) -> Tuple[Dict[str, str], List[str]]:
        """
        Map CSV columns to schema columns using exact, alias, and fuzzy matching.
        Returns:
            Tuple containing:
            - Dict of {csv_column: schema_column}
            - List of warnings
        """
        if entity_type not in ALIASES:
            raise SchemaMappingError(f"Unknown entity type: {entity_type}")

        schema_aliases = ALIASES[entity_type]
        required_cols = REQUIRED_COLUMNS[entity_type]
        
        mapping: Dict[str, str] = {}
        mapped_schema_cols: set = set()
        warnings: List[str] = []

        # We will keep track of matches for each CSV column
        # List of (schema_col, confidence)
        matches = {col: [] for col in csv_columns}

        for csv_col in csv_columns:
            csv_col_clean = str(csv_col).strip().lower()
            
            for schema_col, alias_list in schema_aliases.items():
                # 1. Exact match (confidence 1.0)
                if csv_col_clean == schema_col:
                    matches[csv_col].append((schema_col, 1.0))
                    continue
                    
                # 2. Alias match (confidence 0.95)
                if csv_col_clean in alias_list:
                    matches[csv_col].append((schema_col, 0.95))
                    continue
                    
                # 3. Fuzzy match
                # Use token_sort_ratio to handle word reordering
                best_fuzzy = fuzz.token_sort_ratio(csv_col_clean, schema_col)
                for alias in alias_list:
                    score = fuzz.token_sort_ratio(csv_col_clean, alias)
                    if score > best_fuzzy:
                        best_fuzzy = score
                
                confidence = best_fuzzy / 100.0
                if confidence >= self.min_confidence:
                    matches[csv_col].append((schema_col, confidence))

        # Resolve matches (highest confidence wins)
        # Create a list of all potential matches (csv_col, schema_col, conf)
        all_matches = []
        for csv_col, col_matches in matches.items():
            for schema_col, conf in col_matches:
                all_matches.append((csv_col, schema_col, conf))
                
        # Sort by confidence descending
        all_matches.sort(key=lambda x: x[2], reverse=True)
        
        # Greedy assignment
        for csv_col, schema_col, conf in all_matches:
            if csv_col not in mapping and schema_col not in mapped_schema_cols:
                mapping[csv_col] = schema_col
                mapped_schema_cols.add(schema_col)
                if conf < 1.0:
                    warnings.append(f"Column '{csv_col}' mapped to '{schema_col}' (fuzzy match, confidence: {conf:.2f})")

        # Check for unmapped required columns
        missing_required = [col for col in required_cols if col not in mapped_schema_cols]
        # In Sales, total_amount can be derived if quantity and unit_price exist, which is true if required are met
        if missing_required:
            raise SchemaMappingError(f"Required columns could not be mapped: {missing_required}")

        # Warn about unmapped CSV columns
        for csv_col in csv_columns:
            if csv_col not in mapping:
                warnings.append(f"Column '{csv_col}' not mapped to any schema column, ignored")

        return mapping, warnings

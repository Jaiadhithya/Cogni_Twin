# Phase 1 — Data Ingestion Engine Specification

> **Document Purpose**: Define the complete CSV ingestion pipeline — every stage, validation rule, cleaning strategy, schema detection algorithm, column mapping logic, error handling, and edge case. An AI coding agent should be able to implement the full ingestion pipeline from this document alone.

---

## 1. Why This Module Exists

Small businesses have data in CSV files exported from POS systems, ERP software, or manual Excel tracking. This data is:

- **Inconsistently formatted**: Column names vary ("Date", "date", "Sale Date", "Dt"), date formats differ, currencies may include symbols.
- **Incomplete**: Missing values are common, especially in optional fields.
- **Unvalidated**: Negative quantities, impossible dates, duplicate rows.

The ingestion engine transforms messy real-world CSV data into clean, validated, schema-conformant records in PostgreSQL. Without this module, every other module (forecasting, Q&A, dashboards) receives garbage data and produces garbage results.

---

## 2. Pipeline Architecture

```
CSV File Upload
      │
      ▼
┌─────────────────┐
│  File Validator  │──→ Reject (wrong type, too large, no header)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   CSV Parser    │──→ Reject (encoding error, parse failure)
│  (pandas read)  │
└────────┬────────┘
         │ DataFrame
         ▼
┌─────────────────┐
│  Schema Mapper  │──→ Reject (required columns unmappable)
│  (fuzzy match)  │
└────────┬────────┘
         │ Mapped DataFrame
         ▼
┌─────────────────┐
│  Data Cleaner   │──→ Warnings (filled values, type coercions)
│ (transform/fix) │
└────────┬────────┘
         │ Clean DataFrame
         ▼
┌─────────────────┐
│  Row Validator  │──→ Skip invalid rows (accumulated as errors)
│  (per-row check)│
└────────┬────────┘
         │ Valid records
         ▼
┌─────────────────┐
│  Persister      │──→ Batch INSERT into PostgreSQL
│  (repository)   │
└────────┬────────┘
         │
         ▼
  IngestionResult
  (rows_ingested, warnings, errors)
```

Each stage has a clear input, output, and failure mode. Stages are independent functions that can be tested in isolation.

---

## 3. Stage 1: File Validation

**Responsibility**: Ensure the uploaded file is a valid CSV before any parsing.

### Checks (in order)

1. **File extension**: Must be `.csv` (case-insensitive). Reject `.xlsx`, `.pdf`, etc.
   - Error: `FILE_VALIDATION_ERROR: "File must be a CSV file. Received: .xlsx"`

2. **MIME type**: Check `Content-Type` header. Accept `text/csv`, `text/plain`, `application/csv`, `application/octet-stream`. Reject `application/pdf`, `image/*`, etc.
   - Error: `FILE_VALIDATION_ERROR: "Invalid file type. Expected CSV."`
   - Note: Some systems send CSV as `application/octet-stream`, so we must accept it.

3. **File size**: Must be ≤ 50MB (configurable via `MAX_UPLOAD_SIZE_MB`).
   - Error: `FILE_VALIDATION_ERROR: "File size (67MB) exceeds maximum allowed (50MB)."`

4. **Non-empty**: File must have at least 2 lines (header + 1 data row).
   - Error: `FILE_VALIDATION_ERROR: "File is empty or contains only a header row."`

### Edge Cases

| Scenario | Handling |
|---|---|
| File with BOM (Byte Order Mark) | Strip BOM before parsing |
| File with `.CSV` (uppercase extension) | Accept (case-insensitive check) |
| Zero-byte file | Reject as empty |
| File with only whitespace | Reject as empty |

---

## 4. Stage 2: CSV Parsing

**Responsibility**: Parse the CSV file into a pandas DataFrame.

### Implementation Details

**Encoding detection**: Use `chardet` library to detect encoding. Supported encodings: UTF-8, UTF-8-BOM, Latin-1 (ISO-8859-1), Windows-1252. If detection confidence < 0.5, default to UTF-8 and attempt parsing.

**Delimiter detection**: Try common delimiters in order: comma (`,`), semicolon (`;`), tab (`\t`), pipe (`|`). Use `csv.Sniffer` on the first 5 lines to detect. If detection fails, default to comma.

**pandas read_csv parameters:**
```
encoding=<detected>
sep=<detected>
header=0              # First row is header
dtype=str             # Read everything as string initially (type inference happens later)
keep_default_na=False # Don't auto-convert "NA" strings to NaN
skipinitialspace=True # Strip leading whitespace from fields
on_bad_lines='warn'   # Skip malformed lines, don't crash
nrows=100000          # Hard limit (from MAX_UPLOAD_ROWS)
```

### Row Count Validation

After parsing, check `len(df) <= MAX_UPLOAD_ROWS` (100,000). If exceeded, reject with `FILE_VALIDATION_ERROR`.

### Header Validation

- Headers must be non-empty strings.
- Strip whitespace from headers.
- Remove duplicate column names by appending `_1`, `_2`, etc.
- Convert headers to lowercase for consistent matching.

### Output

- A pandas DataFrame with all values as strings.
- A list of parse warnings (e.g., "Skipped 3 malformed lines").

### Failure Modes

| Scenario | Handling |
|---|---|
| Binary file disguised as .csv | pandas will fail to parse → `FILE_VALIDATION_ERROR: "File could not be parsed as CSV."` |
| Mixed delimiters in file | Sniffer uses majority delimiter. Some rows may parse incorrectly → warning |
| Empty columns (all values blank) | Keep column, clean later |
| Duplicate column names | Rename with suffix (_1, _2) + warning |
| File with >100K rows | Reject after parsing header count |

---

## 5. Stage 3: Schema Mapping

**Responsibility**: Map the CSV column names to the expected database schema columns for the given entity type.

### Why Fuzzy Matching

Small business CSV exports use inconsistent column naming:
- "Date", "date", "Sale Date", "sale_date", "Dt", "Transaction Date", "DateOfSale"
- "Amount", "Total", "Total Amount", "Grand Total", "Value", "amt"
- "Qty", "Quantity", "Units", "No of Items", "quantity_sold"

Requiring exact column names would make the upload unusable. Fuzzy matching makes the system adaptive to real-world data.

### Matching Algorithm

For each expected column in the target schema:

1. **Exact match** (case-insensitive): If a CSV column matches exactly, use it. Confidence: 1.0.
2. **Alias match**: Check against a predefined alias dictionary. Confidence: 0.95.
3. **Fuzzy match**: Use `fuzzywuzzy` (or `rapidfuzz`) token_sort_ratio. Accept if score ≥ 60 (configurable). Confidence: score / 100.
4. **No match**: Column is unmapped.

### Alias Dictionaries

#### Sales Entity
```
sale_date:     ["date", "sale date", "transaction date", "order date", "dt", "dated", "invoice date", "billing date"]
product_name:  ["product", "product name", "item", "item name", "description", "product description", "sku name"]
product_id:    ["product id", "product_id", "productid", "prod id", "item id", "sku"]
customer_name: ["customer", "customer name", "buyer", "client", "client name", "cust name"]
customer_id:   ["customer id", "customer_id", "customerid", "cust id", "client id"]
quantity:      ["qty", "quantity", "units", "no of items", "items", "count", "qty sold", "quantity sold"]
unit_price:    ["price", "unit price", "rate", "selling price", "mrp", "price per unit", "cost"]
total_amount:  ["total", "amount", "total amount", "grand total", "value", "amt", "net amount", "invoice amount", "sales amount", "revenue"]
discount:      ["discount", "disc", "discount amount", "rebate"]
payment_method:["payment", "payment method", "payment type", "pay method", "mode of payment", "payment mode"]
channel:       ["channel", "sales channel", "source", "order source", "platform"]
```

#### Products Entity
```
name:          ["product", "product name", "name", "item", "item name", "title"]
category:      ["category", "cat", "product category", "group", "type", "department"]
subcategory:   ["subcategory", "sub category", "sub-category", "subcat"]
sku:           ["sku", "sku code", "product code", "item code", "barcode", "upc"]
unit_price:    ["price", "selling price", "mrp", "retail price", "unit price", "rate"]
cost_price:    ["cost", "cost price", "purchase price", "buying price", "wholesale price"]
description:   ["description", "desc", "details", "product description"]
```

#### Customers Entity
```
name:          ["name", "customer name", "full name", "client name", "buyer name"]
email:         ["email", "email address", "e-mail", "mail", "customer email"]
phone:         ["phone", "mobile", "telephone", "contact", "phone number", "mobile number", "tel"]
city:          ["city", "location", "town"]
state:         ["state", "province", "region"]
segment:       ["segment", "customer segment", "type", "customer type", "class", "tier"]
first_purchase_date: ["first purchase", "first purchase date", "join date", "registration date", "first order date"]
```

#### Inventory Entity
```
product_name:  ["product", "product name", "item", "item name"]
product_id:    ["product id", "product_id", "sku", "item code"]
quantity_on_hand: ["quantity", "stock", "on hand", "available", "qty", "current stock", "stock on hand", "units"]
reorder_level: ["reorder level", "min stock", "minimum", "reorder point", "safety stock"]
reorder_quantity: ["reorder qty", "reorder quantity", "order quantity"]
warehouse_location: ["location", "warehouse", "bin", "section", "store location"]
last_restocked: ["last restock", "last restocked", "restock date", "last received"]
```

#### Suppliers Entity
```
name:          ["name", "supplier name", "vendor name", "company", "vendor"]
contact_person:["contact", "contact person", "contact name", "representative"]
email:         ["email", "email address", "contact email"]
phone:         ["phone", "telephone", "contact phone", "mobile"]
city:          ["city", "location"]
state:         ["state", "region"]
lead_time_days:["lead time", "lead time days", "delivery days", "delivery time", "lead_time"]
rating:        ["rating", "score", "performance", "rank", "supplier rating"]
payment_terms: ["payment terms", "terms", "payment", "credit terms"]
```

### Mapping Rules

1. Each CSV column maps to at most one schema column.
2. Each schema column maps to at most one CSV column (no duplicates).
3. If multiple CSV columns match the same schema column, pick the highest confidence match.
4. Unmapped CSV columns are ignored (not ingested) — log a warning listing them.
5. If required columns are unmapped, abort with `SCHEMA_MAPPING_ERROR`.

### Output

A `ColumnMapping` dictionary: `{csv_column_name: schema_column_name}` plus confidence scores.

---

## 6. Stage 4: Data Cleaning

**Responsibility**: Transform and fix data quality issues after schema mapping.

### Cleaning Operations (in order)

#### 6.1 Whitespace Normalization
- Strip leading/trailing whitespace from all string values.
- Replace multiple consecutive spaces with single space.
- Convert empty strings to `None` (null).

#### 6.2 Date Parsing
For columns mapped to date types (`sale_date`, `first_purchase_date`, `last_restocked`):

Attempt parsing in this order of formats:
1. `YYYY-MM-DD` (ISO 8601)
2. `DD-MM-YYYY`
3. `DD/MM/YYYY`
4. `MM/DD/YYYY`
5. `MM-DD-YYYY`
6. `YYYY/MM/DD`
7. `DD-Mon-YYYY` (e.g., "15-Dec-2024")
8. `DD Mon YYYY` (e.g., "15 Dec 2024")
9. `Mon DD, YYYY` (e.g., "Dec 15, 2024")

Strategy:
- Try each format on the first 20 non-null values.
- The format that successfully parses the most values wins.
- Apply winning format to all values.
- Values that fail the winning format → `None` + warning.

Warning example: `"Row 45: date value '2024-13-45' could not be parsed, set to null."`

#### 6.3 Numeric Parsing
For columns mapped to numeric types (`quantity`, `unit_price`, `total_amount`, `discount`, etc.):

- Remove currency symbols: ₹, $, €, £, ¥
- Remove thousands separators: commas (e.g., "1,499.00" → "1499.00")
- Handle Indian numbering (e.g., "1,49,900" → "149900")
- Convert to float.
- Values that fail conversion → 0.0 + warning.
- Negative values in `quantity` → absolute value + warning.
- Negative values in `total_amount` → keep as-is (could be a return/refund).

#### 6.4 Missing Value Handling

| Column Type | Strategy | Justification |
|---|---|---|
| `sale_date` | Cannot fill → skip row + error | Date is essential for time-series |
| `total_amount` | If `quantity` and `unit_price` exist, compute `quantity × unit_price`. Otherwise → 0 + warning | Derived computation is better than guessing |
| `quantity` | If `total_amount` and `unit_price` exist, compute `total_amount / unit_price`. Otherwise → 1 + warning | Default to 1 unit |
| `unit_price` | If `total_amount` and `quantity` exist, compute `total_amount / quantity`. Otherwise → 0 + warning | Derived if possible |
| `discount` | → 0.00 | No discount is the safe default |
| `name` (any entity) | Cannot fill → skip row + error | Name is the required identifier |
| All other strings | → None (null in database) | Leave as unknown |
| All other numbers | → 0 + warning | Safe default |

#### 6.5 Deduplication
- Detect exact duplicate rows (all mapped columns identical).
- Remove duplicates, keeping the first occurrence.
- Warning: `"Removed 12 duplicate rows."`

#### 6.6 Empty Row Removal
- Remove rows where ALL values are null/empty after cleaning.
- Warning: `"Removed 3 empty rows."`

### Output

- Cleaned DataFrame.
- List of warnings (each warning includes row number and description).
- Count of rows that were skipped due to critical missing data.

---

## 7. Stage 5: Row Validation

**Responsibility**: Validate each row against business rules after cleaning.

### Validation Rules

#### Sales
| Rule | Condition | Action |
|---|---|---|
| Date range | `sale_date` is in the future | Warning: "Future sale date detected" (allow, could be a pre-order) |
| Date range | `sale_date` is before 2000-01-01 | Error: skip row (likely bad data) |
| Quantity | `quantity <= 0` after cleaning | Error: skip row |
| Amount | `total_amount < 0` and `quantity > 0` | Warning: "Negative amount, treating as return" (allow) |
| Consistency | `total_amount` differs from `quantity × unit_price` by >10% | Warning: "Amount mismatch" (keep original total_amount) |

#### Products
| Rule | Condition | Action |
|---|---|---|
| Price | `unit_price < 0` | Error: skip row |
| Name length | `name` is empty or whitespace-only | Error: skip row |
| Duplicate SKU | Same SKU already exists in database | Warning: skip row, keep existing |

#### Customers
| Rule | Condition | Action |
|---|---|---|
| Name | `name` is empty | Error: skip row |
| Email format | `email` provided but invalid format | Warning: set email to null (keep row) |

#### Inventory
| Rule | Condition | Action |
|---|---|---|
| Quantity | `quantity_on_hand < 0` | Warning: set to 0 |
| Product reference | Neither `product_id` nor `product_name` provided | Error: skip row |

#### Suppliers
| Rule | Condition | Action |
|---|---|---|
| Name | `name` is empty | Error: skip row |
| Rating | `rating > 5` or `rating < 0` | Warning: clamp to [0, 5] range |
| Lead time | `lead_time_days < 0` | Warning: set to null |

---

## 8. Stage 6: Persistence

**Responsibility**: Save validated records to PostgreSQL.

### Implementation Details

1. Create an `UploadRecord` in the `upload_records` table with status `processing`.
2. Convert validated DataFrame rows to domain entities.
3. Batch INSERT entities (batch size: 1000 rows per INSERT for performance).
4. Update the `UploadRecord`:
   - Set `status = 'completed'` (or `'failed'` if all rows failed)
   - Set `row_count`, `warning_count`, `error_count`
   - Set `column_mapping` (the mapping that was applied)
   - Set `warnings` and `errors` (as JSONB arrays)
5. If the INSERT fails (database error), rollback all records for this upload and set status to `'failed'`.

### Transaction Strategy

- The entire upload is one database transaction.
- If any batch INSERT fails, the entire upload rolls back.
- This ensures atomicity: either all rows from a file are ingested, or none are.

### Foreign Key Resolution

When ingesting sales data:
- If `product_name` is provided, attempt to match to an existing product by name (case-insensitive exact match). If found, set `product_id`. If not found, keep `product_name` and leave `product_id` null.
- Same logic for `customer_name` → `customer_id`.
- This allows sales data to be uploaded before or after product/customer data.

---

## 9. Complete Error and Warning Taxonomy

### Errors (row is skipped)

| Code | Message Pattern | Stage |
|---|---|---|
| `E001` | `Row {n}: missing required column '{col}'` | Row Validation |
| `E002` | `Row {n}: sale_date before 2000-01-01` | Row Validation |
| `E003` | `Row {n}: quantity is zero or negative` | Row Validation |
| `E004` | `Row {n}: unit_price is negative` | Row Validation |
| `E005` | `Row {n}: duplicate SKU '{sku}' already exists` | Row Validation |
| `E006` | `Row {n}: name is empty` | Row Validation |

### Warnings (row is kept, with modification)

| Code | Message Pattern | Stage |
|---|---|---|
| `W001` | `Row {n}: missing '{col}' value, filled with {default}` | Data Cleaning |
| `W002` | `Row {n}: date format auto-converted from '{from}' to 'YYYY-MM-DD'` | Data Cleaning |
| `W003` | `Row {n}: currency symbol '{sym}' removed from '{col}'` | Data Cleaning |
| `W004` | `Row {n}: negative quantity converted to absolute value` | Data Cleaning |
| `W005` | `Column '{csv_col}' mapped to '{schema_col}' (fuzzy match, confidence: {score})` | Schema Mapping |
| `W006` | `Column '{csv_col}' not mapped to any schema column, ignored` | Schema Mapping |
| `W007` | `Removed {n} duplicate rows` | Data Cleaning |
| `W008` | `Row {n}: amount mismatch (expected {expected}, got {actual}), keeping original` | Row Validation |
| `W009` | `Row {n}: email format invalid, set to null` | Row Validation |
| `W010` | `Row {n}: rating clamped to range [0, 5]` | Row Validation |
| `W011` | `total_amount computed as quantity × unit_price for {n} rows` | Data Cleaning |

---

## 10. Performance Considerations

| Concern | Design Decision |
|---|---|
| Memory | Read CSV with `dtype=str` (no type inflation). Process in pandas DataFrame (in-memory). Max 100K rows × ~20 columns ≈ ~80MB peak RAM. Acceptable for Phase 1. |
| Database writes | Batch INSERT with 1000-row batches. PostgreSQL handles this efficiently. |
| Parsing speed | pandas CSV parsing is C-optimized. 100K rows parses in <2 seconds. |
| Schema mapping | Fuzzy matching on ~20 columns × ~10 aliases = ~200 comparisons. Negligible time. |
| Total pipeline | Expected: <10 seconds for 100K row CSV. Acceptable given the 30-second timeout. |

---

## 11. Future Extensibility

This module is designed so that Phase 2 can add:

- **Excel support**: Add a new parser class implementing `CSVParser` protocol (rename to `FileParser`). The rest of the pipeline (cleaning, mapping, validation, persistence) is format-agnostic.
- **PDF/DOCX**: These go through a completely different pipeline (OCR → text → chunking → embedding). They do NOT use this module. They will have their own `DocumentIngestionService`.
- **SQL database imports**: Add a new ingestion method that reads from a SQL connection instead of a file. The cleaning and validation stages can be reused.
- **Column mapping UI**: Phase 2 could add a review step where the user confirms/overrides the auto-mapped columns before ingestion proceeds. The `ColumnMapping` is already a first-class return value.

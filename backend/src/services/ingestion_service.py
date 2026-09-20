import uuid
import logging
from typing import List, Dict, Any, Tuple
from datetime import datetime

from src.domain.entities import (
    UploadRecord, Sale, Product, Customer, Supplier, Inventory
)
from src.domain.value_objects import EntityType
from src.domain.interfaces import UnitOfWork, FileParser, ISchemaMapper, IDataCleaner, IRowValidator
from src.infrastructure.database.repository import invalidate_table_schemas

logger = logging.getLogger(__name__)

class IngestionService:
    """Orchestrates the data ingestion pipeline."""

    def __init__(
        self, 
        uow: UnitOfWork, 
        parser: type[FileParser],
        mapper: ISchemaMapper | None = None,
        cleaner: IDataCleaner | None = None,
        validator: IRowValidator | None = None
    ):
        from src.infrastructure.ingestion.schema_mapper import SchemaMapper
        from src.infrastructure.ingestion.data_cleaner import DataCleaner
        from src.infrastructure.ingestion.row_validator import RowValidator
        self.uow = uow
        self.parser = parser
        self.mapper = mapper or SchemaMapper()
        self.cleaner = cleaner or DataCleaner()
        self.validator = validator or RowValidator()

    async def ingest_file(self, file_path: str, original_filename: str, mime_type: str, entity_type: EntityType) -> UploadRecord:
        """
        Run the complete ingestion pipeline for a file.
        Returns the finalized UploadRecord.
        """
        logger.info(f"Starting ingestion for file '{original_filename}' (Entity: {entity_type})")
        
        # Create Upload Record (status: processing)
        upload_id = uuid.uuid4()
        upload_record = UploadRecord(
            id=upload_id,
            filename=original_filename,
            entity_type=entity_type,
            row_count=0,
            warning_count=0,
            error_count=0,
            status="processing",
            column_mapping=None,
            warnings=None,
            errors=None,
            created_at=datetime.utcnow()
        )

        try:
            # Stage 1 & 2: Validate & Parse
            logger.info("Validating and parsing file.")
            self.parser.validate_file(file_path, mime_type, original_filename)
            df, parse_warnings = self.parser.parse(file_path)
            
            # Stage 3: Schema Mapping
            logger.info("Mapping columns to schema.")
            mapping, map_warnings = self.mapper.map_columns(entity_type, list(df.columns))
            
            # Stage 4: Data Cleaning
            logger.info("Cleaning data.")
            df, clean_warnings, skipped_clean_count = self.cleaner.clean(df, entity_type, mapping)
            
            # Stage 5: Row Validation
            logger.info("Validating rows against business rules.")
            valid_dicts, val_warnings, errors = self.validator.validate(df, entity_type)
            
            all_warnings = parse_warnings + map_warnings + clean_warnings + val_warnings
            
            # Stage 6: Persistence
            logger.info("Persisting validated records.")
            async with self.uow as uow:
                # Save the initial upload record
                await uow.repository.save_upload_record(upload_record)
                
                # Perform foreign key resolution if needed
                if entity_type in ("sales", "inventory"):
                    await self._resolve_foreign_keys(valid_dicts, entity_type, uow)
                
                # Convert dicts to entities
                entities = self._dicts_to_entities(valid_dicts, entity_type, upload_id)
                
                # Batch INSERT
                batch_size = 1000
                for i in range(0, len(entities), batch_size):
                    batch = entities[i:i+batch_size]
                    await uow.repository.save_entities(entity_type, batch)
                
                # Update Upload Record
                upload_record.status = "completed"
                upload_record.row_count = len(entities)
                upload_record.warning_count = len(all_warnings)
                upload_record.error_count = len(errors) + skipped_clean_count
                upload_record.column_mapping = mapping
                upload_record.warnings = all_warnings
                upload_record.errors = errors
                
                await uow.repository.update_upload_record(upload_record)
                await uow.commit()
                # Fresh rows landed in an operational table; the cached LLM schema
                # context (row counts, samples, min/max) is now stale.
                invalidate_table_schemas()
                logger.info(f"Ingestion completed successfully for '{original_filename}'. Rows: {len(entities)}, Errors: {upload_record.error_count}")
                return upload_record

        except Exception as e:
            logger.error(f"Ingestion failed for '{original_filename}': {str(e)}", exc_info=True)
            upload_record.status = "failed"
            upload_record.errors = [str(e)]
            upload_record.error_count = 1
            
            try:
                async with self.uow as uow_fallback:
                    await uow_fallback.repository.update_upload_record(upload_record)
                    await uow_fallback.commit()
            except Exception as inner_e:
                logger.error(f"Failed to save failed upload record: {str(inner_e)}", exc_info=True)
                
            # Wrap standard pandas/parser errors as domain validation errors
            if isinstance(e, (ValueError, KeyError)):
                from src.domain.exceptions import ValidationError
                raise ValidationError(f"Data format or schema validation failed: {str(e)}") from e
                
            from src.domain.exceptions import IngestionError
            if isinstance(e, IngestionError):
                raise
                
            raise IngestionError(str(e)) from e

    async def _resolve_foreign_keys(self, records: List[Dict[str, Any]], entity_type: EntityType, uow: UnitOfWork):
        """Resolve product_name/customer_name to IDs if present."""
        if not records:
            return
            
        logger.info("Resolving foreign keys.")
        if entity_type == "sales":
            # Collect unique names
            product_names = list({r.get("product_name") for r in records if r.get("product_name") and not r.get("product_id")})
            customer_names = list({r.get("customer_name") for r in records if r.get("customer_name") and not r.get("customer_id")})
            
            product_cache = await uow.repository.get_entities_by_names("products", product_names) if product_names else {}
            customer_cache = await uow.repository.get_entities_by_names("customers", customer_names) if customer_names else {}
            
            for record in records:
                p_name = record.get("product_name")
                c_name = record.get("customer_name")
                
                if p_name and not record.get("product_id"):
                    record["product_id"] = product_cache.get(p_name)
                    
                if c_name and not record.get("customer_id"):
                    record["customer_id"] = customer_cache.get(c_name)
                    
        elif entity_type == "inventory":
            product_names = list({r.get("product_name") for r in records if r.get("product_name") and not r.get("product_id")})
            product_cache = await uow.repository.get_entities_by_names("products", product_names) if product_names else {}
            
            for record in records:
                p_name = record.get("product_name")
                if p_name and not record.get("product_id"):
                    record["product_id"] = product_cache.get(p_name)

    def _dicts_to_entities(self, records: List[Dict[str, Any]], entity_type: EntityType, upload_id: uuid.UUID) -> List[Any]:
        """Convert dictionaries to domain entities."""
        entities = []
        now = datetime.utcnow()
        
        for record in records:
            if entity_type == "sales":
                entities.append(Sale(
                    id=uuid.uuid4(),
                    sale_date=record.get("sale_date"),
                    product_id=record.get("product_id"),
                    customer_id=record.get("customer_id"),
                    quantity=record.get("quantity"),
                    unit_price=record.get("unit_price"),
                    total_amount=record.get("total_amount"),
                    discount=record.get("discount", 0.0),
                    payment_method=record.get("payment_method"),
                    channel=record.get("channel"),
                    product_name=record.get("product_name"),
                    category=record.get("category"),
                    customer_name=record.get("customer_name"),
                    upload_id=upload_id,
                    created_at=now
                ))
            elif entity_type == "products":
                entities.append(Product(
                    id=uuid.uuid4(),
                    name=record.get("name"),
                    category=record.get("category"),
                    subcategory=record.get("subcategory"),
                    sku=record.get("sku"),
                    unit_price=record.get("unit_price"),
                    cost_price=record.get("cost_price"),
                    description=record.get("description"),
                    supplier_id=record.get("supplier_id"),
                    upload_id=upload_id,
                    created_at=now
                ))
            elif entity_type == "customers":
                entities.append(Customer(
                    id=uuid.uuid4(),
                    name=record.get("name"),
                    email=record.get("email"),
                    phone=record.get("phone"),
                    city=record.get("city"),
                    state=record.get("state"),
                    segment=record.get("segment"),
                    first_purchase_date=record.get("first_purchase_date"),
                    upload_id=upload_id,
                    created_at=now
                ))
            elif entity_type == "inventory":
                entities.append(Inventory(
                    id=uuid.uuid4(),
                    product_id=record.get("product_id"),
                    product_name=record.get("product_name"),
                    quantity_on_hand=record.get("quantity_on_hand"),
                    reorder_level=record.get("reorder_level"),
                    reorder_quantity=record.get("reorder_quantity"),
                    warehouse_location=record.get("warehouse_location"),
                    last_restocked=record.get("last_restocked"),
                    upload_id=upload_id,
                    created_at=now
                ))
            elif entity_type == "suppliers":
                entities.append(Supplier(
                    id=uuid.uuid4(),
                    name=record.get("name"),
                    contact_person=record.get("contact_person"),
                    email=record.get("email"),
                    phone=record.get("phone"),
                    city=record.get("city"),
                    state=record.get("state"),
                    lead_time_days=record.get("lead_time_days"),
                    rating=record.get("rating"),
                    payment_terms=record.get("payment_terms"),
                    upload_id=upload_id,
                    created_at=now
                ))
        return entities

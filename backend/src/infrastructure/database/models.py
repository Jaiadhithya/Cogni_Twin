"""SQLAlchemy ORM models."""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Index,
    JSON,
    Uuid as UUID,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class DatasetMetadata(Base):
    """Registry for dynamically uploaded datasets."""
    __tablename__ = "dataset_metadata"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    original_filename = Column(String(255), nullable=False)
    generated_table_name = Column(String(255), nullable=False, unique=True)
    row_count = Column(Integer, nullable=False, default=0)
    upload_date = Column(DateTime(timezone=True), nullable=False, default=func.now())
    column_mapping = Column(JSON, nullable=True)

class UploadRecordModel(Base):
    """Upload record database model."""
    __tablename__ = "upload_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(255), nullable=False)
    entity_type = Column(String(50), nullable=False, index=True)
    row_count = Column(Integer, nullable=False, default=0)
    warning_count = Column(Integer, nullable=False, default=0)
    error_count = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="processing")
    column_mapping = Column(JSON, nullable=True)
    warnings = Column(JSON, nullable=True)
    errors = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=func.now(), index=True
    )

    __table_args__ = (
        CheckConstraint(
            "entity_type IN ('sales', 'products', 'customers', 'inventory', 'suppliers')",
            name="ck_upload_records_entity_type",
        ),
        CheckConstraint(
            "status IN ('processing', 'completed', 'failed')",
            name="ck_upload_records_status",
        ),
    )


class SupplierModel(Base):
    """Supplier database model."""
    __tablename__ = "suppliers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    contact_person = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    lead_time_days = Column(Integer, nullable=True)
    rating = Column(Numeric(3, 2), nullable=True)
    payment_terms = Column(String(100), nullable=True)
    
    upload_id = Column(
        UUID(as_uuid=True), ForeignKey("upload_records.id", ondelete="CASCADE"), nullable=False
    )
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

    __table_args__ = (
        CheckConstraint("rating >= 0 AND rating <= 5", name="ck_suppliers_rating"),
    )


class ProductModel(Base):
    """Product database model."""
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=True, index=True)
    subcategory = Column(String(100), nullable=True)
    sku = Column(String(50), nullable=True)
    unit_price = Column(Numeric(12, 2), nullable=True)
    cost_price = Column(Numeric(12, 2), nullable=True)
    description = Column(Text, nullable=True)
    
    supplier_id = Column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True
    )
    upload_id = Column(
        UUID(as_uuid=True), ForeignKey("upload_records.id", ondelete="CASCADE"), nullable=False
    )
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

    __table_args__ = (
        Index("uq_products_sku", "sku", unique=True, sqlite_where=Column("sku").isnot(None), postgresql_where=Column("sku").isnot(None)),
    )


class CustomerModel(Base):
    """Customer database model."""
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    city = Column(String(100), nullable=True, index=True)
    state = Column(String(100), nullable=True)
    segment = Column(String(50), nullable=True, index=True)
    first_purchase_date = Column(Date, nullable=True)
    
    upload_id = Column(
        UUID(as_uuid=True), ForeignKey("upload_records.id", ondelete="CASCADE"), nullable=False
    )
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())


class SaleModel(Base):
    """Sale database model."""
    __tablename__ = "sales"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sale_date = Column(Date, nullable=False, index=True)
    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_id = Column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    discount = Column(Numeric(5, 2), nullable=True)
    payment_method = Column(String(50), nullable=True)
    channel = Column(String(50), nullable=True)
    product_name = Column(String(255), nullable=True)
    category = Column(String(100), nullable=True)
    customer_name = Column(String(255), nullable=True)

    marketing_spend = Column(Numeric(12, 2), nullable=True)
    supplier_lead_time_days = Column(Numeric(6, 2), nullable=True)
    competitor_discount_pct = Column(Numeric(5, 2), nullable=True)

    upload_id = Column(
        UUID(as_uuid=True), ForeignKey("upload_records.id", ondelete="CASCADE"), nullable=False
    )
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())


class DailyBusinessTelemetryModel(Base):
    """Daily aggregated business telemetry model for time-series forecasting."""
    __tablename__ = "daily_business_telemetry"

    date = Column(String(50), primary_key=True, index=True)
    sales_volume = Column(Numeric(12, 2), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    marketing_spend = Column(Numeric(12, 2), nullable=False)
    supplier_lead_time_days = Column(Numeric(12, 2), nullable=False)
    competitor_discount_pct = Column(Numeric(12, 2), nullable=False)
    revenue = Column(Numeric(12, 2), nullable=False)


class InventoryModel(Base):
    """Inventory database model."""
    __tablename__ = "inventory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True
    )
    product_name = Column(String(255), nullable=True)
    quantity_on_hand = Column(Integer, nullable=False, default=0)
    reorder_level = Column(Integer, nullable=True)
    reorder_quantity = Column(Integer, nullable=True)
    warehouse_location = Column(String(100), nullable=True)
    last_restocked = Column(Date, nullable=True)
    
    upload_id = Column(
        UUID(as_uuid=True), ForeignKey("upload_records.id", ondelete="CASCADE"), nullable=False
    )
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

    __table_args__ = (
        CheckConstraint("quantity_on_hand >= 0", name="ck_inventory_qty"),
    )

class DocumentModel(Base):
    """Document metadata database model."""
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(255), nullable=False)
    doc_type = Column(String(50), nullable=False)
    file_path = Column(String(500), nullable=False)
    chunk_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

class ShapCacheModel(Base):
    """Database model for storing factor-attribution explanations."""
    __tablename__ = "shap_cache"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(String(50), nullable=True, index=True)
    product_name = Column(String(255), nullable=True)
    model_id = Column(String(50), nullable=False, index=True)
    forecast_date = Column(String(50), nullable=False, index=True)
    top_positive_drivers = Column(JSON, nullable=False)
    top_negative_drivers = Column(JSON, nullable=False)
    explanation_text = Column(Text, nullable=True)
    computed_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

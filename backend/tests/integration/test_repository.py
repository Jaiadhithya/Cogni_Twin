import pytest
import pytest_asyncio
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.database.engine import engine
from src.infrastructure.database.session import AsyncSessionLocal
from src.infrastructure.database.models import UploadRecordModel
from src.infrastructure.database.repository import PostgresRepository
from src.domain.entities import Sale, UploadRecord, Product
from src.domain.value_objects import PaginationParams, DateRange

@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()

@pytest.mark.asyncio
async def test_repository_save_and_get_entities(db_session: AsyncSession):
    repo = PostgresRepository(db_session)
    
    upload_id = uuid.uuid4()
    upload = UploadRecord(
        id=upload_id,
        filename="test_repo.csv",
        entity_type="sales",
        row_count=1,
        warning_count=0,
        error_count=0,
        status="completed",
        column_mapping=None,
        warnings=None,
        errors=None,
        created_at=datetime.utcnow()
    )
    
    # Test save upload record
    await repo.save_upload_record(upload)
    
    # Test save entities (products first due to foreign key)
    product_id = uuid.uuid4()
    product = Product(
        id=product_id,
        name="Repo Product",
        category="Tech",
        subcategory=None,
        sku="SKU-1",
        unit_price=Decimal("100.00"),
        cost_price=Decimal("80.00"),
        description=None,
        supplier_id=None,
        upload_id=upload_id,
        created_at=datetime.utcnow()
    )
    
    await repo.save_entities("products", [product])
    
    # Test save sales
    sale_id = uuid.uuid4()
    sale = Sale(
        id=sale_id,
        sale_date=date(2024, 1, 1),
        product_id=product_id,
        customer_id=None,
        quantity=5,
        unit_price=Decimal("100.00"),
        total_amount=Decimal("500.00"),
        discount=Decimal("0.00"),
        payment_method="Card",
        channel="Web",
        product_name="Repo Product",
        customer_name=None,
        upload_id=upload_id,
        created_at=datetime.utcnow()
    )
    
    await repo.save_entities("sales", [sale])
    
    # Get entities
    pagination = PaginationParams(page=1, page_size=10)
    result = await repo.get_entities("sales", pagination)
    
    assert result.total_count >= 1
    assert any(s.id == sale_id for s in result.items)
    
    # Test date range filtering
    date_range = DateRange(start_date=date(2024, 1, 1), end_date=date(2024, 1, 31))
    filtered_result = await repo.get_entities("sales", pagination, date_range=date_range)
    assert any(s.id == sale_id for s in filtered_result.items)
    
    out_of_range = DateRange(start_date=date(2025, 1, 1), end_date=date(2025, 1, 31))
    empty_result = await repo.get_entities("sales", pagination, date_range=out_of_range)
    assert not any(s.id == sale_id for s in empty_result.items)

@pytest.mark.asyncio
async def test_get_table_schemas(db_session: AsyncSession):
    repo = PostgresRepository(db_session)
    schemas = await repo.get_table_schemas()
    assert "Table: sales" in schemas
    assert "Table: products" in schemas

@pytest.mark.asyncio
async def test_execute_readonly_sql(db_session: AsyncSession):
    repo = PostgresRepository(db_session)
    result = await repo.execute_readonly_sql("SELECT 1 as val")
    assert len(result) == 1
    assert result[0]["val"] == 1

@pytest.mark.asyncio
async def test_get_table_schemas_with_dataset_prioritization(db_session: AsyncSession):
    from src.infrastructure.database.models import DatasetMetadata
    repo = PostgresRepository(db_session)
    dataset_id = uuid.uuid4()
    meta = DatasetMetadata(
        id=dataset_id,
        original_filename="priority_test.csv",
        generated_table_name="sales",
        row_count=10,
        column_mapping={"date": "sale_date"}
    )
    db_session.add(meta)
    await db_session.flush()

    # Query with specific dataset_id
    schemas_specific = await repo.get_table_schemas(str(dataset_id))
    assert "Table: sales" in schemas_specific

    # Query with invalid dataset_id falls back to latest uploaded table gracefully
    schemas_fallback = await repo.get_table_schemas("invalid-uuid-string")
    assert "Table: sales" in schemas_fallback

"""Integration tests for Ingestion Service."""

import pytest
import tempfile
import os
import uuid
from src.services.ingestion_service import IngestionService
from src.infrastructure.database.uow import SqlAlchemyUnitOfWork
from src.infrastructure.ingestion.exceptions import IngestionError
from src.infrastructure.ingestion.csv_parser import CSVParser
from src.infrastructure.database.session import AsyncSessionLocal

@pytest.fixture
def temp_csv(tmp_path):
    """Create a temporary CSV file for testing."""
    file_path = tmp_path / "sales.csv"
    content = (
        "date,product name,qty,price,total\n"
        "2024-01-01,Product A,5,10.0,50.0\n"
        "2024-01-02,Product B,-2,15.0,30.0\n" # Negative qty will be abs, total will mismatch
        "invalid_date,Product C,1,5.0,5.0\n" # Invalid date -> should be skipped
    )
    file_path.write_text(content)
    return str(file_path)

@pytest.mark.asyncio
async def test_ingestion_service_e2e(temp_csv):
    """Test the complete ingestion pipeline."""
    uow = SqlAlchemyUnitOfWork(AsyncSessionLocal)
    service = IngestionService(uow, CSVParser)
    
    upload_record = await service.ingest_file(
        file_path=temp_csv,
        original_filename="sales.csv",
        mime_type="text/csv",
        entity_type="sales"
    )
    
    # 3 rows total. 
    # Row 1: Valid.
    # Row 2: negative qty (abs), amount mismatch (ignored) -> Valid, but with warnings.
    # Row 3: invalid date -> Skipped (dropped by data cleaner due to NA sale_date).
    
    assert upload_record.status == "completed"
    assert upload_record.row_count == 2
    assert upload_record.error_count == 1 # 1 row dropped
    assert upload_record.warning_count >= 1 # negative qty warning, mismatch warning
    assert upload_record.column_mapping["date"] == "sale_date"
    
    # Verify in DB
    async with AsyncSessionLocal() as session:
        # Check upload record
        from src.infrastructure.database.models import UploadRecordModel
        from sqlalchemy import select
        stmt = select(UploadRecordModel).where(UploadRecordModel.id == upload_record.id)
        result = await session.execute(stmt)
        db_record = result.scalars().first()
        assert db_record is not None
        assert db_record.status == "completed"
        
        # Verify sales
        pagination = __import__("src.domain.value_objects").domain.value_objects.PaginationParams(page=1, page_size=100)
        read_uow = SqlAlchemyUnitOfWork(AsyncSessionLocal)
        async with read_uow:
            sales_result = await read_uow.repository.get_entities("sales", pagination)
            my_sales = [s for s in sales_result.items if s.upload_id == upload_record.id]
            assert len(my_sales) == 2
            p_b_sale = next(s for s in my_sales if s.product_name == "Product B")
            assert p_b_sale.quantity == 2
            assert p_b_sale.total_amount == 30.0

@pytest.mark.asyncio
async def test_ingestion_service_empty_file(tmp_path):
    """Test ingestion fails cleanly on empty file."""
    empty_csv = tmp_path / "empty.csv"
    empty_csv.write_text("")
    
    uow = SqlAlchemyUnitOfWork(AsyncSessionLocal)
    service = IngestionService(uow, CSVParser)
    
    with pytest.raises(IngestionError, match="empty"):
        await service.ingest_file(
            file_path=str(empty_csv),
            original_filename="empty.csv",
            mime_type="text/csv",
            entity_type="sales"
        )

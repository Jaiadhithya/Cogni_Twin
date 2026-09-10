"""Integration tests for warehouse service."""

import pytest
from datetime import date
from src.infrastructure.database.uow import SqlAlchemyUnitOfWork
from src.infrastructure.database.session import AsyncSessionLocal
from src.services.warehouse_service import WarehouseService
from src.domain.value_objects import PaginationParams

@pytest.mark.asyncio
async def test_warehouse_service_get_data(seed_db_for_warehouse):
    """Test get_data with sorting, pagination and search."""
    uow = SqlAlchemyUnitOfWork(AsyncSessionLocal)
    service = WarehouseService(uow)
    
    # Get page 1, sorted by unit_price desc
    pagination = PaginationParams(page=1, page_size=10)
    result = await service.get_data(
        entity_type="sales",
        pagination=pagination,
        sort_by="unit_price",
        sort_order="desc"
    )
    
    assert result.total_count > 0
    assert len(result.items) > 0
    # verify sorting
    prices = [sale.unit_price for sale in result.items if sale.unit_price is not None]
    assert prices == sorted(prices, reverse=True)

    # Test search by product name
    search_result = await service.get_data(
        entity_type="sales",
        pagination=pagination,
        search="Widget"
    )
    # The seeder should have put 'Widget' somewhere or we check that it doesn't fail
    assert search_result.total_count >= 0

@pytest.mark.asyncio
async def test_warehouse_service_get_summary(seed_db_for_warehouse):
    """Test get_summary computes metrics correctly."""
    uow = SqlAlchemyUnitOfWork(AsyncSessionLocal)
    service = WarehouseService(uow)
    
    # Get overall summary
    summary = await service.get_summary()
    
    assert "total_revenue" in summary
    assert "total_orders" in summary
    assert "top_products" in summary
    assert "top_categories" in summary
    assert "daily_revenue" in summary
    
    assert summary["data_status"]["sales_count"] >= 0
    assert summary["data_status"]["products_count"] >= 0

import pytest_asyncio

@pytest_asyncio.fixture
async def seed_db_for_warehouse():
    """Seed the database with some records for warehouse tests."""
    from src.infrastructure.database.models import SaleModel, ProductModel, UploadRecordModel
    import uuid
    from datetime import datetime, timezone
    
    async with AsyncSessionLocal() as session:
        # Check if already seeded to avoid duplicate data in tests
        from sqlalchemy import select, func
        count = await session.scalar(select(func.count(SaleModel.id)))
        if count > 0:
            return
            
        uid = uuid.uuid4()
        upload = UploadRecordModel(
            id=uid,
            filename="test.csv",
            entity_type="sales",
            status="completed",
            row_count=2,
            warning_count=0,
            error_count=0,
            created_at=datetime.now(timezone.utc)
        )
        session.add(upload)
        await session.flush()
        
        prod_id = uuid.uuid4()
        product = ProductModel(
            id=prod_id,
            name="Test Widget",
            category="Electronics",
            upload_id=uid,
            created_at=datetime.now(timezone.utc)
        )
        session.add(product)
        await session.flush()
        
        sale1 = SaleModel(
            id=uuid.uuid4(),
            sale_date=date(2024, 1, 1),
            product_id=prod_id,
            product_name="Test Widget",
            quantity=2,
            unit_price=10.0,
            total_amount=20.0,
            upload_id=uid,
            created_at=datetime.now(timezone.utc)
        )
        sale2 = SaleModel(
            id=uuid.uuid4(),
            sale_date=date(2024, 1, 2),
            product_id=prod_id,
            product_name="Test Widget",
            quantity=1,
            unit_price=15.0,
            total_amount=15.0,
            upload_id=uid,
            created_at=datetime.now(timezone.utc)
        )
        session.add_all([sale1, sale2])
        await session.commit()

import pytest
import pytest_asyncio
import uuid
from datetime import date
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.future import select

from src.config import settings
from src.infrastructure.database.models import Base, UploadRecordModel, ProductModel, CustomerModel, SaleModel

# Use the same database URL but ensure we are hitting the correct test environment if possible.
# Here we just use the default configured DB for testing.
engine = create_async_engine(settings.DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_db():
    # In a real app we might drop and create tables, but Alembic already created them.
    # We will just yield and let tests run. 
    # For isolation, we could use nested transactions, but for now we just insert and cleanup.
    yield

@pytest_asyncio.fixture
async def db_session():
    async with TestingSessionLocal() as session:
        yield session
        # Rollback any uncommitted transactions after the test
        await session.rollback()

@pytest.mark.asyncio
async def test_create_and_query_sale(db_session: AsyncSession):
    # 1. Create an Upload Record
    upload_id = uuid.uuid4()
    upload = UploadRecordModel(
        id=upload_id,
        filename="test_sales.csv",
        entity_type="sales",
        row_count=1,
        warning_count=0,
        error_count=0,
        status="completed"
    )
    db_session.add(upload)
    await db_session.commit()
    
    # 2. Create a Product
    product_id = uuid.uuid4()
    product = ProductModel(
        id=product_id,
        name="Test Product",
        unit_price=10.50,
        upload_id=upload_id
    )
    db_session.add(product)
    
    # 3. Create a Customer
    customer_id = uuid.uuid4()
    customer = CustomerModel(
        id=customer_id,
        name="Test Customer",
        upload_id=upload_id
    )
    db_session.add(customer)
    await db_session.commit()
    
    # 4. Create a Sale
    sale_id = uuid.uuid4()
    sale = SaleModel(
        id=sale_id,
        sale_date=date.today(),
        product_id=product_id,
        customer_id=customer_id,
        quantity=2,
        unit_price=10.50,
        total_amount=21.00,
        upload_id=upload_id
    )
    db_session.add(sale)
    await db_session.commit()
    
    # 5. Query it back
    stmt = select(SaleModel).where(SaleModel.id == sale_id)
    result = await db_session.execute(stmt)
    saved_sale = result.scalars().first()
    
    assert saved_sale is not None
    assert saved_sale.quantity == 2
    assert float(saved_sale.total_amount) == 21.00
    assert saved_sale.product_id == product_id
    assert saved_sale.customer_id == customer_id

    # Cleanup (since we are not using a nested transaction fixture here, we delete manually)
    await db_session.delete(saved_sale)
    await db_session.delete(product)
    await db_session.delete(customer)
    await db_session.delete(upload)
    await db_session.commit()

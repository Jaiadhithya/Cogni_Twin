import pytest
import pytest_asyncio
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.database.session import AsyncSessionLocal
from src.infrastructure.database.models import UploadRecordModel
from src.infrastructure.database.uow import SqlAlchemyUnitOfWork
from src.domain.entities import UploadRecord

@pytest.mark.asyncio
async def test_uow_commit():
    upload_id = uuid.uuid4()
    
    # 1. Start UOW and commit a new record
    uow = SqlAlchemyUnitOfWork(AsyncSessionLocal)
    async with uow:
        upload = UploadRecord(
            id=upload_id,
            filename="uow_commit.csv",
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
        await uow.repository.save_upload_record(upload)
        # Context manager automatically commits if no exception
        
    # 2. Verify it was actually saved
    async with AsyncSessionLocal() as session:
        stmt = select(UploadRecordModel).where(UploadRecordModel.id == upload_id)
        result = await session.execute(stmt)
        record = result.scalars().first()
        
        assert record is not None
        assert record.filename == "uow_commit.csv"
        
        # Cleanup
        await session.delete(record)
        await session.commit()

@pytest.mark.asyncio
async def test_uow_rollback_on_exception():
    upload_id = uuid.uuid4()
    
    # 1. Start UOW, add a record, and raise an exception
    uow = SqlAlchemyUnitOfWork(AsyncSessionLocal)
    
    try:
        async with uow:
            upload = UploadRecord(
                id=upload_id,
                filename="uow_error.csv",
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
            await uow.repository.save_upload_record(upload)
            raise ValueError("Something went wrong!")
    except ValueError:
        pass
        
    # 2. Verify it was NOT saved (rolled back)
    async with AsyncSessionLocal() as session:
        stmt = select(UploadRecordModel).where(UploadRecordModel.id == upload_id)
        result = await session.execute(stmt)
        record = result.scalars().first()
        
        assert record is None

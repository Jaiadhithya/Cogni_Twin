"""Unit tests for the warehouse service."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import date

from src.services.warehouse_service import WarehouseService
from src.domain.value_objects import PaginationParams, DateRange

@pytest.fixture
def mock_repository():
    """Mock repository."""
    repo = AsyncMock()
    return repo

@pytest.fixture
def mock_uow(mock_repository):
    """Mock unit of work."""
    uow = AsyncMock()
    uow.repository = mock_repository
    # Setup context manager
    uow.__aenter__.return_value = uow
    return uow

@pytest.fixture
def warehouse_service(mock_uow):
    """Warehouse service with mocked UoW."""
    return WarehouseService(mock_uow)

@pytest.mark.asyncio
async def test_get_data(warehouse_service, mock_repository):
    """Test get_data calls repository correctly."""
    mock_repository.get_entities.return_value = "fake_result"
    
    pagination = PaginationParams(page=2, page_size=10)
    d_from = date(2024, 1, 1)
    d_to = date(2024, 12, 31)
    
    result = await warehouse_service.get_data(
        entity_type="sales",
        pagination=pagination,
        sort_by="total_amount",
        sort_order="asc",
        date_from=d_from,
        date_to=d_to,
        search="widget"
    )
    
    assert result == "fake_result"
    mock_repository.get_entities.assert_called_once()
    
    args, kwargs = mock_repository.get_entities.call_args
    assert kwargs["entity_type"] == "sales"
    assert kwargs["pagination"] == pagination
    assert kwargs["sort_by"] == "total_amount"
    assert kwargs["sort_order"] == "asc"
    assert kwargs["search"] == "widget"
    assert kwargs["date_range"].start_date == d_from
    assert kwargs["date_range"].end_date == d_to

@pytest.mark.asyncio
async def test_get_uploads(warehouse_service, mock_repository):
    """Test get_uploads calls repository correctly."""
    mock_repository.get_upload_records.return_value = "fake_uploads"
    
    pagination = PaginationParams(page=1, page_size=20)
    result = await warehouse_service.get_uploads(pagination)
    
    assert result == "fake_uploads"
    mock_repository.get_upload_records.assert_called_once_with(pagination=pagination)

@pytest.mark.asyncio
async def test_get_datasets(warehouse_service, mock_repository):
    """Test get_datasets lists datasets from the repository."""
    mock_repository.list_datasets.return_value = "fake_datasets"

    pagination = PaginationParams(page=2, page_size=10)
    result = await warehouse_service.get_datasets(pagination)

    assert result == "fake_datasets"
    mock_repository.list_datasets.assert_called_once_with(pagination=pagination)

@pytest.mark.asyncio
async def test_get_summary(warehouse_service, mock_repository):
    """Test get_summary calls repository correctly."""
    mock_repository.get_summary_metrics.return_value = {"total_revenue": 100.0}
    
    d_from = date(2024, 1, 1)
    d_to = date(2024, 12, 31)
    
    result = await warehouse_service.get_summary(date_from=d_from, date_to=d_to)
    
    assert result == {"total_revenue": 100.0}
    mock_repository.get_summary_metrics.assert_called_once()
    
    args, kwargs = mock_repository.get_summary_metrics.call_args
    assert kwargs["date_range"].start_date == d_from
    assert kwargs["date_range"].end_date == d_to

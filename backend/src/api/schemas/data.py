from typing import Optional, Any
from pydantic import BaseModel, Field
from datetime import date

class PaginatedRequest(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort_by: Optional[str] = "created_at"
    sort_order: Optional[str] = "desc"

class SummaryMetricsPeriod(BaseModel):
    from_date: Optional[str] = Field(None, alias="from")
    to_date: Optional[str] = Field(None, alias="to")

class TopProduct(BaseModel):
    name: str
    revenue: float
    quantity_sold: int

class TopCategory(BaseModel):
    category: str
    revenue: float

class DailyRevenue(BaseModel):
    date: str
    revenue: float

class PaymentMethodDistribution(BaseModel):
    method: str
    count: int
    percentage: float

class DataStatus(BaseModel):
    sales_count: int
    products_count: int
    customers_count: int
    inventory_count: int
    suppliers_count: int
    last_upload: Optional[str] = None

class SummaryMetricsData(BaseModel):
    period: SummaryMetricsPeriod
    total_revenue: float
    total_orders: int
    average_order_value: float
    unique_customers: int
    top_products: list[TopProduct]
    top_categories: list[TopCategory]
    daily_revenue: list[DailyRevenue]
    payment_method_distribution: list[PaymentMethodDistribution]
    data_status: DataStatus

class EntityListResponseData(BaseModel):
    records: list[dict[str, Any]]

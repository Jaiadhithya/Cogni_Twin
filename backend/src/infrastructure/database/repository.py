"""Database repository implementation."""

from typing import Any, Sequence
from datetime import date
import math

from sqlalchemy import select, text, func, literal_column
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities import (
    UploadRecord, Sale, Product, Customer, Supplier, Inventory
)
from src.domain.value_objects import EntityType
from src.domain.interfaces import Repository
from src.domain.value_objects import DateRange, PaginatedResult, PaginationParams
from src.infrastructure.database.models import (
    UploadRecordModel, SaleModel, ProductModel, CustomerModel, SupplierModel, InventoryModel
)

_MODEL_MAP = {
    "sales": SaleModel,
    "products": ProductModel,
    "customers": CustomerModel,
    "suppliers": SupplierModel,
    "inventory": InventoryModel,
}

_ENTITY_MAP = {
    "sales": Sale,
    "products": Product,
    "customers": Customer,
    "suppliers": Supplier,
    "inventory": Inventory,
}

def _to_model(entity_type: EntityType, entity: Any) -> Any:
    """Explicitly map a domain entity to an ORM model."""
    if entity_type == "sales":
        return SaleModel(
            id=entity.id,
            sale_date=entity.sale_date,
            product_id=entity.product_id,
            customer_id=entity.customer_id,
            quantity=entity.quantity,
            unit_price=entity.unit_price,
            total_amount=entity.total_amount,
            discount=entity.discount,
            payment_method=entity.payment_method,
            channel=entity.channel,
            product_name=entity.product_name,
            category=entity.category,
            customer_name=entity.customer_name,
            upload_id=entity.upload_id,
            created_at=entity.created_at,
        )
    elif entity_type == "products":
        return ProductModel(
            id=entity.id,
            name=entity.name,
            category=entity.category,
            subcategory=entity.subcategory,
            sku=entity.sku,
            unit_price=entity.unit_price,
            cost_price=entity.cost_price,
            description=entity.description,
            supplier_id=entity.supplier_id,
            upload_id=entity.upload_id,
            created_at=entity.created_at,
        )
    elif entity_type == "customers":
        return CustomerModel(
            id=entity.id,
            name=entity.name,
            email=entity.email,
            phone=entity.phone,
            city=entity.city,
            state=entity.state,
            segment=entity.segment,
            first_purchase_date=entity.first_purchase_date,
            upload_id=entity.upload_id,
            created_at=entity.created_at,
        )
    elif entity_type == "suppliers":
        return SupplierModel(
            id=entity.id,
            name=entity.name,
            contact_person=entity.contact_person,
            email=entity.email,
            phone=entity.phone,
            city=entity.city,
            state=entity.state,
            lead_time_days=entity.lead_time_days,
            rating=entity.rating,
            payment_terms=entity.payment_terms,
            upload_id=entity.upload_id,
            created_at=entity.created_at,
        )
    elif entity_type == "inventory":
        return InventoryModel(
            id=entity.id,
            product_id=entity.product_id,
            product_name=entity.product_name,
            quantity_on_hand=entity.quantity_on_hand,
            reorder_level=entity.reorder_level,
            reorder_quantity=entity.reorder_quantity,
            warehouse_location=entity.warehouse_location,
            last_restocked=entity.last_restocked,
            upload_id=entity.upload_id,
            created_at=entity.created_at,
        )
    else:
        raise ValueError(f"Unknown entity type: {entity_type}")

def _to_entity(entity_type: EntityType, model: Any) -> Any:
    """Explicitly map an ORM model to a domain entity."""
    if entity_type == "sales":
        return Sale(
            id=model.id,
            sale_date=model.sale_date,
            product_id=model.product_id,
            customer_id=model.customer_id,
            quantity=model.quantity,
            unit_price=model.unit_price,
            total_amount=model.total_amount,
            discount=model.discount,
            payment_method=model.payment_method,
            channel=model.channel,
            product_name=model.product_name,
            category=model.category,
            customer_name=model.customer_name,
            upload_id=model.upload_id,
            created_at=model.created_at,
        )
    elif entity_type == "products":
        return Product(
            id=model.id,
            name=model.name,
            category=model.category,
            subcategory=model.subcategory,
            sku=model.sku,
            unit_price=model.unit_price,
            cost_price=model.cost_price,
            description=model.description,
            supplier_id=model.supplier_id,
            upload_id=model.upload_id,
            created_at=model.created_at,
        )
    elif entity_type == "customers":
        return Customer(
            id=model.id,
            name=model.name,
            email=model.email,
            phone=model.phone,
            city=model.city,
            state=model.state,
            segment=model.segment,
            first_purchase_date=model.first_purchase_date,
            upload_id=model.upload_id,
            created_at=model.created_at,
        )
    elif entity_type == "suppliers":
        return Supplier(
            id=model.id,
            name=model.name,
            contact_person=model.contact_person,
            email=model.email,
            phone=model.phone,
            city=model.city,
            state=model.state,
            lead_time_days=model.lead_time_days,
            rating=model.rating,
            payment_terms=model.payment_terms,
            upload_id=model.upload_id,
            created_at=model.created_at,
        )
    elif entity_type == "inventory":
        return Inventory(
            id=model.id,
            product_id=model.product_id,
            product_name=model.product_name,
            quantity_on_hand=model.quantity_on_hand,
            reorder_level=model.reorder_level,
            reorder_quantity=model.reorder_quantity,
            warehouse_location=model.warehouse_location,
            last_restocked=model.last_restocked,
            upload_id=model.upload_id,
            created_at=model.created_at,
        )
    else:
        raise ValueError(f"Unknown entity type: {entity_type}")

class PostgresRepository(Repository):
    """PostgreSQL implementation of the Repository protocol."""
    
    def __init__(self, session: AsyncSession):
        self.session = session

    async def save_upload_record(self, record: UploadRecord) -> None:
        """Save an upload record to the database."""
        model = UploadRecordModel(
            id=record.id,
            filename=record.filename,
            entity_type=record.entity_type,
            row_count=record.row_count,
            warning_count=record.warning_count,
            error_count=record.error_count,
            status=record.status,
            column_mapping=record.column_mapping,
            warnings=record.warnings,
            errors=record.errors,
            created_at=record.created_at,
        )
        self.session.add(model)
        await self.session.flush()

    async def update_upload_record(self, record: UploadRecord) -> None:
        """Update an existing upload record to the database."""
        model = UploadRecordModel(
            id=record.id,
            filename=record.filename,
            entity_type=record.entity_type,
            row_count=record.row_count,
            warning_count=record.warning_count,
            error_count=record.error_count,
            status=record.status,
            column_mapping=record.column_mapping,
            warnings=record.warnings,
            errors=record.errors,
            created_at=record.created_at,
        )
        await self.session.merge(model)
        await self.session.flush()

    async def save_entities(self, entity_type: EntityType, entities: list[Any]) -> None:
        """Save a batch of domain entities to the database."""
        if not entities:
            return
            
        model_cls = _MODEL_MAP.get(entity_type)
        if not model_cls:
            raise ValueError(f"Unknown entity type: {entity_type}")
            
        # Convert domain entities to SQLAlchemy models explicitly
        models = [_to_model(entity_type, entity) for entity in entities]
            
        self.session.add_all(models)
        await self.session.flush()

    async def get_entities(
        self, 
        entity_type: EntityType, 
        pagination: PaginationParams, 
        date_range: DateRange | None = None,
        sort_by: str | None = None,
        sort_order: str = "desc",
        search: str | None = None
    ) -> PaginatedResult[Any]:
        """Get a paginated list of entities."""
        model_cls = _MODEL_MAP.get(entity_type)
        
        if not model_cls:
            raise ValueError(f"Unknown entity type: {entity_type}")
            
        query = select(model_cls)
        count_query = select(func.count()).select_from(model_cls)
        
        # Apply search if applicable
        if search:
            search_col = None
            if entity_type == "sales":
                search_col = model_cls.product_name
                # Also search customer_name if possible, but ILIKE across two columns:
                query = query.where(
                    (model_cls.product_name.ilike(f"%{search}%")) |
                    (model_cls.customer_name.ilike(f"%{search}%"))
                )
                count_query = count_query.where(
                    (model_cls.product_name.ilike(f"%{search}%")) |
                    (model_cls.customer_name.ilike(f"%{search}%"))
                )
            elif hasattr(model_cls, "name"):
                query = query.where(model_cls.name.ilike(f"%{search}%"))
                count_query = count_query.where(model_cls.name.ilike(f"%{search}%"))
            elif hasattr(model_cls, "product_name"):
                query = query.where(model_cls.product_name.ilike(f"%{search}%"))
                count_query = count_query.where(model_cls.product_name.ilike(f"%{search}%"))

        # Apply date range filtering if applicable
        if date_range:
            # Determine which column is the date column for filtering
            date_col = None
            if entity_type == "sales":
                date_col = model_cls.sale_date
            elif entity_type == "customers":
                date_col = model_cls.first_purchase_date
            elif entity_type == "inventory":
                date_col = model_cls.last_restocked
            
            if date_col is not None:
                if date_range.start_date:
                    query = query.where(date_col >= date_range.start_date)
                    count_query = count_query.where(date_col >= date_range.start_date)
                if date_range.end_date:
                    query = query.where(date_col <= date_range.end_date)
                    count_query = count_query.where(date_col <= date_range.end_date)
                    
        # Get total count
        count_result = await self.session.execute(count_query)
        total_count = count_result.scalar() or 0
        
        # Apply sorting securely
        if sort_by and hasattr(model_cls, sort_by):
            col = getattr(model_cls, sort_by)
            # Ensure it is actually a column, not an internal SQLAlchemy attribute
            from sqlalchemy.orm import attributes
            if isinstance(col, attributes.InstrumentedAttribute):
                if sort_order.lower() == "asc":
                    query = query.order_by(col.asc())
                else:
                    query = query.order_by(col.desc())
        elif hasattr(model_cls, 'created_at'):
            query = query.order_by(model_cls.created_at.desc())

        # Apply pagination
        offset = (pagination.page - 1) * pagination.page_size
        query = query.limit(pagination.page_size).offset(offset)
        
        # Execute query
        result = await self.session.execute(query)
        models = result.scalars().all()
        
        # Convert models to domain entities explicitly
        items = [_to_entity(entity_type, model) for model in models]
            
        total_pages = math.ceil(total_count / pagination.page_size) if pagination.page_size else 0
        
        return PaginatedResult(
            items=items,
            total_count=total_count,
            page=pagination.page,
            page_size=pagination.page_size,
            total_pages=total_pages
        )

    async def get_upload_records(self, pagination: PaginationParams) -> PaginatedResult[UploadRecord]:
        """Get paginated upload records."""
        query = select(UploadRecordModel)
        count_query = select(func.count()).select_from(UploadRecordModel)

        count_result = await self.session.execute(count_query)
        total_count = count_result.scalar() or 0

        offset = (pagination.page - 1) * pagination.page_size
        query = query.order_by(UploadRecordModel.created_at.desc()).limit(pagination.page_size).offset(offset)

        result = await self.session.execute(query)
        models = result.scalars().all()

        items = [
            UploadRecord(
                id=model.id,
                filename=model.filename,
                entity_type=model.entity_type,
                row_count=model.row_count,
                warning_count=model.warning_count,
                error_count=model.error_count,
                status=model.status,
                column_mapping=model.column_mapping,
                warnings=model.warnings,
                errors=model.errors,
                created_at=model.created_at
            ) for model in models
        ]

        total_pages = math.ceil(total_count / pagination.page_size) if pagination.page_size else 0

        return PaginatedResult(
            items=items,
            total_count=total_count,
            page=pagination.page,
            page_size=pagination.page_size,
            total_pages=total_pages
        )

    async def get_summary_metrics(self, dataset_id: str | None = None, date_range: DateRange | None = None) -> dict[str, Any]:
        """Get dynamic dashboard summary metrics using DatasetMetadata schema mappings."""
        from src.infrastructure.database.models import DatasetMetadata
        
        from sqlalchemy import cast, String
        if dataset_id:
            query = select(DatasetMetadata).where(cast(DatasetMetadata.id, String) == str(dataset_id))
        else:
            query = select(DatasetMetadata).order_by(DatasetMetadata.upload_date.desc()).limit(1)
            
        result = await self.session.execute(query)
        dataset = result.scalar_one_or_none()
        
        if not dataset:
            from src.infrastructure.database.models import SaleModel, ProductModel
            sales_count = (await self.session.scalar(select(func.count(SaleModel.id)))) or 0
            products_count = (await self.session.scalar(select(func.count(ProductModel.id)))) or 0
            total_rev = (await self.session.scalar(select(func.sum(SaleModel.total_amount)))) or 0.0
            
            top_prods_query = select(SaleModel.product_name, func.sum(SaleModel.total_amount).label('rev')).group_by(SaleModel.product_name).order_by(text('rev DESC')).limit(5)
            top_prods_res = await self.session.execute(top_prods_query)
            top_products = [{"name": r[0] or "Unknown", "revenue": float(r[1] or 0)} for r in top_prods_res.all()]
            
            top_cats_query = select(SaleModel.category, func.sum(SaleModel.total_amount).label('rev')).group_by(SaleModel.category).order_by(text('rev DESC')).limit(5)
            top_cats_res = await self.session.execute(top_cats_query)
            top_categories = [{"name": r[0] or "General", "revenue": float(r[1] or 0)} for r in top_cats_res.all()]
            
            daily_query = select(SaleModel.sale_date, func.sum(SaleModel.total_amount).label('rev')).group_by(SaleModel.sale_date).order_by(SaleModel.sale_date.asc())
            daily_res = await self.session.execute(daily_query)
            daily_revenue = [{"date": str(r[0]), "revenue": float(r[1] or 0)} for r in daily_res.all()]
            
            return {
                "total_revenue": float(total_rev),
                "total_orders": sales_count,
                "top_products": top_products,
                "top_categories": top_categories,
                "daily_revenue": daily_revenue,
                "data_status": {
                    "sales_count": sales_count,
                    "products_count": products_count
                },
                "kpis": {
                    "total_rows": sales_count,
                    "total_target": float(total_rev),
                    "avg_target": float(total_rev / sales_count) if sales_count else 0.0
                },
                "timeline": [{"date": str(d["date"]), "value": d["revenue"]} for d in daily_revenue],
                "dimensions": {"product": top_products, "category": top_categories}
            }
            
        table = dataset.generated_table_name
        mapping = dataset.column_mapping or {}
        
        # 1. Inspect table columns directly to ensure robust dynamic resolution
        from sqlalchemy import inspect
        connection = await self.session.connection()
        def _get_table_info(conn):
            inspector = inspect(conn)
            if not inspector.has_table(table):
                return [], {}
            cols = inspector.get_columns(table)
            return [c['name'] for c in cols], {c['name']: str(c['type']).upper() for c in cols}

        col_names, col_types = await connection.run_sync(_get_table_info)

        # 2. Dynamic Primary Date Resolution
        primary_date = mapping.get("primary_date")
        if not primary_date or primary_date not in col_names:
            date_name_candidates = [
                c for c in col_names 
                if any(k in c.lower() for k in ['date', 'transaction_date', 'sale_date', 'order_date', 'invoice_date', 'timestamp', 'time', 'dt', 'day', 'ds', 'period', 'created_at'])
            ]
            date_type_candidates = [
                c for c in col_names 
                if any(t in col_types.get(c, '') for t in ('DATE', 'TIME', 'TIMESTAMP'))
            ]
            if date_type_candidates:
                primary_date = date_type_candidates[0]
            elif date_name_candidates:
                primary_date = date_name_candidates[0]
            else:
                primary_date = None

        # 3. Dynamic Target Metric Resolution
        target_metric = mapping.get("target_metric")
        real_num_cols = [
            c for c in col_names 
            if any(t in col_types.get(c, '') for t in ('INT', 'NUMERIC', 'FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'BIGINT', 'SMALLINT'))
        ]
        if not target_metric or target_metric not in col_names or target_metric not in real_num_cols:
            target_candidates = [
                c for c in real_num_cols 
                if any(k in c.lower() for k in ['net_revenue', 'total_amount', 'revenue', 'sales', 'total', 'units_sold', 'units', 'amount', 'gross_profit', 'profit', 'price', 'quantity'])
            ]
            if target_candidates:
                target_metric = target_candidates[0]
            elif real_num_cols:
                target_metric = real_num_cols[0]
            else:
                target_metric = None

        # 4. Filter and Resolve Dimensions (Pruning Synthetic/Ignored Dimensions)
        raw_dims = mapping.get("dimensions", [])
        if not isinstance(raw_dims, list):
            raw_dims = []
        ignored_dims = {
            (primary_date or "").lower(), "id", "row_id", "upload_id", "transaction_id", "created_at"
        }
        valid_dims = [d for d in raw_dims if d in col_names and d.lower() not in ignored_dims and d != target_metric]
        if not valid_dims:
            str_cols = [
                c for c in col_names 
                if any(t in col_types.get(c, '') for t in ('VARCHAR', 'TEXT', 'CHAR', 'STRING'))
                and c.lower() not in ignored_dims and c != primary_date
            ]
            valid_dims = str_cols[:4] if str_cols else [c for c in col_names if c not in (primary_date, target_metric) and c.lower() not in ignored_dims][:4]
        dimensions = valid_dims[:4]

        # 5. Build Safe WHERE Clause
        where_clause = ""
        if date_range and primary_date:
            if date_range.start_date and date_range.end_date:
                where_clause = f"WHERE \"{primary_date}\" >= '{date_range.start_date}' AND \"{primary_date}\" <= '{date_range.end_date}'"
            elif date_range.start_date:
                where_clause = f"WHERE \"{primary_date}\" >= '{date_range.start_date}'"
            elif date_range.end_date:
                where_clause = f"WHERE \"{primary_date}\" <= '{date_range.end_date}'"

        # 6. KPI Aggregations
        if target_metric:
            kpi_sql = text(f"""
                SELECT 
                    COUNT(*) as row_count,
                    COALESCE(SUM(CAST("{target_metric}" AS NUMERIC)), 0) as total_target,
                    COALESCE(AVG(CAST("{target_metric}" AS NUMERIC)), 0) as avg_target
                FROM "{table}"
                {where_clause}
            """)
        else:
            kpi_sql = text(f"""
                SELECT 
                    COUNT(*) as row_count,
                    0 as total_target,
                    0 as avg_target
                FROM "{table}"
                {where_clause}
            """)
        kpi_res = await self.session.execute(kpi_sql)
        kpi_row = kpi_res.first()

        row_count = kpi_row.row_count if kpi_row else 0
        total_target = float(kpi_row.total_target or 0) if kpi_row else 0.0
        avg_target = float(kpi_row.avg_target or 0) if kpi_row else 0.0

        # 7. Timeline Aggregation
        timeline_data = []
        if primary_date and target_metric:
            timeline_sql = text(f"""
                SELECT 
                    CAST("{primary_date}" AS DATE) as date,
                    COALESCE(SUM(CAST("{target_metric}" AS NUMERIC)), 0) as value
                FROM "{table}"
                {where_clause}
                GROUP BY CAST("{primary_date}" AS DATE)
                ORDER BY CAST("{primary_date}" AS DATE) ASC
            """)
            timeline_res = await self.session.execute(timeline_sql)
            timeline_data = [
                {"date": r.date.isoformat() if hasattr(r.date, 'isoformat') else str(r.date), "value": float(r.value or 0)}
                for r in timeline_res.all()
            ]

        # 8. Dimension Aggregations
        dim_results = {}
        for dim in dimensions:
            if target_metric:
                dim_sql = text(f"""
                    SELECT 
                        COALESCE(NULLIF(CAST("{dim}" AS TEXT), ''), 'Unknown') as category,
                        COALESCE(SUM(CAST("{target_metric}" AS NUMERIC)), 0) as value
                    FROM "{table}"
                    {where_clause}
                    GROUP BY "{dim}"
                    ORDER BY value DESC
                    LIMIT 5
                """)
            else:
                dim_sql = text(f"""
                    SELECT 
                        COALESCE(NULLIF(CAST("{dim}" AS TEXT), ''), 'Unknown') as category,
                        COUNT(*) as value
                    FROM "{table}"
                    {where_clause}
                    GROUP BY "{dim}"
                    ORDER BY value DESC
                    LIMIT 5
                """)
            dim_res = await self.session.execute(dim_sql)
            dim_results[dim] = [{"category": str(r.category), "value": float(r.value or 0)} for r in dim_res.all()]

        # 9. Top Products Resolution
        top_products = []
        prod_candidates = ['product_name', 'sku_name', 'product_id', 'item_name', 'product', 'item', 'sku', 'product_title']
        prod_col = next((c for c in prod_candidates if c in col_names), None)
        if prod_col and target_metric:
            prod_sql = text(f"""
                SELECT 
                    COALESCE(NULLIF(CAST("{prod_col}" AS TEXT), ''), 'Unknown') as name,
                    COALESCE(SUM(CAST("{target_metric}" AS NUMERIC)), 0) as revenue
                FROM "{table}"
                {where_clause}
                GROUP BY "{prod_col}"
                ORDER BY revenue DESC
                LIMIT 5
            """)
            prod_res = await self.session.execute(prod_sql)
            top_products = [{"name": str(r.name), "revenue": float(r.revenue or 0)} for r in prod_res.all()]
        elif dim_results:
            first_dim_vals = next(iter(dim_results.values()))
            top_products = [{"name": d["category"], "revenue": d["value"]} for d in first_dim_vals]

        # 10. Top Categories Resolution
        top_categories = []
        cat_candidates = ['product_category', 'category', 'subcategory', 'segment', 'customer_segment', 'channel', 'sales_channel', 'region']
        cat_col = next((c for c in cat_candidates if c in col_names and c != prod_col), None)
        if cat_col and target_metric:
            cat_sql = text(f"""
                SELECT 
                    COALESCE(NULLIF(CAST("{cat_col}" AS TEXT), ''), 'General') as name,
                    COALESCE(SUM(CAST("{target_metric}" AS NUMERIC)), 0) as revenue
                FROM "{table}"
                {where_clause}
                GROUP BY "{cat_col}"
                ORDER BY revenue DESC
                LIMIT 5
            """)
            cat_res = await self.session.execute(cat_sql)
            top_categories = [{"name": str(r.name), "revenue": float(r.revenue or 0)} for r in cat_res.all()]
        elif dim_results:
            first_dim_vals = next(iter(dim_results.values()))
            top_categories = [{"name": d["category"], "revenue": d["value"]} for d in first_dim_vals]

        numerical_columns = mapping.get("numerical_columns") or [c for c in real_num_cols if c != target_metric]
        categorical_columns = mapping.get("categorical_columns") or [c for c in col_names if c not in real_num_cols and c != primary_date]

        return {
            "dataset_id": str(dataset.id),
            "target_metric_name": target_metric or "volume",
            "primary_date_name": primary_date or "date",
            "metadata": {
                "target_metric": target_metric or "volume",
                "numerical_columns": numerical_columns,
                "categorical_columns": categorical_columns,
            },
            "kpis": {
                "total_rows": row_count,
                "total_target": total_target,
                "avg_target": avg_target
            },
            "timeline": timeline_data,
            "dimensions": dim_results,
            "total_revenue": total_target,
            "total_orders": row_count,
            "top_products": top_products,
            "top_categories": top_categories,
            "daily_revenue": timeline_data,
            "data_status": {
                "sales_count": row_count,
                "products_count": len(top_products)
            }
        }

    async def get_table_schemas(self, dataset_id: str | None = None) -> str:
        """
        Get the database schema for the LLM with rich column descriptions and samples.
        Strictly preserves the 'Table: {table} ({cols})' signature line for fallback regex compatibility.
        """
        from sqlalchemy import inspect, select, cast, String
        from src.infrastructure.database.models import DatasetMetadata
        
        tables_to_check = []
        table_name = None
        active_metadata = None

        if dataset_id and str(dataset_id).strip().lower() not in ("", "undefined", "null", "none"):
            query = select(DatasetMetadata).where(cast(DatasetMetadata.id, String) == str(dataset_id).strip())
            result = await self.session.execute(query)
            active_metadata = result.scalar_one_or_none()
            if active_metadata:
                table_name = active_metadata.generated_table_name

        if not table_name:
            query = select(DatasetMetadata).order_by(DatasetMetadata.upload_date.desc()).limit(1)
            result = await self.session.execute(query)
            active_metadata = result.scalar_one_or_none()
            if active_metadata:
                table_name = active_metadata.generated_table_name

        if table_name:
            tables_to_check.append(table_name)

        # Include standard operational tables as secondary options
        for default_tbl in ["sales", "products", "customers", "inventory"]:
            if default_tbl not in tables_to_check:
                tables_to_check.append(default_tbl)
        
        connection = await self.session.connection()
        def _inspect_schema(conn):
            inspector = inspect(conn)
            schemas = {}
            for table in tables_to_check:
                if inspector.has_table(table):
                    cols = inspector.get_columns(table)
                    schemas[table] = cols
            return schemas
            
        tables_columns = await connection.run_sync(_inspect_schema)
        schema_sections = []

        mapping = active_metadata.column_mapping if active_metadata else {}
        primary_date = mapping.get("primary_date")
        target_metric = mapping.get("target_metric")

        for table, cols in tables_columns.items():
            col_sigs = [f"{col['name']} {col['type']}" for col in cols]
            # Primary line: MUST be formatted as "Table: <table> (<col1> <type1>, <col2> <type2>, ...)"
            table_header = f"Table: {table} ({', '.join(col_sigs)})"
            
            # Fetch rich samples & statistics
            details = []
            try:
                row_cnt_res = await self.session.execute(text(f'SELECT COUNT(*) FROM "{table}"'))
                row_cnt = row_cnt_res.scalar() or 0
                details.append(f"  Row Count: {row_cnt}")
            except Exception:
                row_cnt = 0

            # Enrich column info
            for col in cols:
                c_name = col['name']
                c_type = str(col['type']).upper()
                role = "General Column"
                if c_name == primary_date:
                    role = "Primary Timeline Axis"
                elif c_name == target_metric:
                    role = "Target Forecast Metric"
                elif any(t in c_type for t in ('VARCHAR', 'TEXT', 'CHAR')):
                    role = "Categorical Dimension"
                elif any(t in c_type for t in ('INT', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL')):
                    role = "Numeric Regressor"

                sample_info = ""
                try:
                    if any(t in c_type for t in ('VARCHAR', 'TEXT', 'CHAR')):
                        s_res = await self.session.execute(
                            text(f'SELECT DISTINCT "{c_name}" FROM "{table}" WHERE "{c_name}" IS NOT NULL LIMIT 4')
                        )
                        samples = [str(r[0]) for r in s_res.all()]
                        if samples:
                            sample_info = f", Samples: {samples}"
                    elif any(t in c_type for t in ('DATE', 'TIME', 'TIMESTAMP')) or c_name == primary_date:
                        d_res = await self.session.execute(
                            text(f'SELECT MIN("{c_name}"), MAX("{c_name}") FROM "{table}" WHERE "{c_name}" IS NOT NULL')
                        )
                        d_row = d_res.first()
                        if d_row and d_row[0]:
                            sample_info = f", Range: {d_row[0]} to {d_row[1]}"
                    elif any(t in c_type for t in ('INT', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL')):
                        n_res = await self.session.execute(
                            text(f'SELECT MIN(CAST("{c_name}" AS NUMERIC)), MAX(CAST("{c_name}" AS NUMERIC)) FROM "{table}" WHERE "{c_name}" IS NOT NULL')
                        )
                        n_row = n_res.first()
                        if n_row and n_row[0] is not None:
                            sample_info = f", Min: {float(n_row[0]):.2f}, Max: {float(n_row[1]):.2f}"
                except Exception:
                    pass

                details.append(f"  - {c_name} ({c_type}) [{role}]{sample_info}")

            section = table_header + "\n" + "\n".join(details)
            schema_sections.append(section)

        return "\n\n".join(schema_sections)
        
    async def execute_readonly_sql(self, sql: str, limit: int = 1000) -> list[dict[str, Any]]:
        """Execute a read-only SQL query."""
        # Ensure it's read-only by prefixing, though the role should restrict it anyway
        result = await self.session.execute(text(sql))
        rows = result.mappings().all()
        return [dict(row) for row in rows]

    async def save_document(self, document_data: dict[str, Any]) -> str:
        """Save document metadata to the database. Returns the new document ID."""
        from src.infrastructure.database.models import DocumentModel
        import uuid
        
        doc_id = uuid.uuid4()
        model = DocumentModel(
            id=doc_id,
            filename=document_data["filename"],
            doc_type=document_data["doc_type"],
            file_path=document_data["file_path"],
            chunk_count=document_data["chunk_count"]
        )
        self.session.add(model)
        await self.session.flush()
        return str(doc_id)

    async def get_shap_cache(self, product_id: str, model_id: str) -> dict[str, Any] | None:
        """Get cached SHAP explanation."""
        from src.infrastructure.database.models import ShapCacheModel
        query = select(ShapCacheModel).where(
            ShapCacheModel.product_id == product_id,
            ShapCacheModel.model_id == model_id
        ).order_by(ShapCacheModel.computed_at.desc()).limit(1)
        
        result = await self.session.execute(query)
        model = result.scalar_one_or_none()
        
        if model:
            return {
                "id": str(model.id),
                "product_id": model.product_id,
                "product_name": model.product_name,
                "model_id": model.model_id,
                "forecast_date": model.forecast_date,
                "top_positive_drivers": model.top_positive_drivers,
                "top_negative_drivers": model.top_negative_drivers,
                "explanation_text": model.explanation_text,
                "computed_at": model.computed_at.isoformat() if model.computed_at else None
            }
        return None

    async def save_shap_cache(self, cache_data: dict[str, Any]) -> None:
        """Save SHAP explanation to cache."""
        from src.infrastructure.database.models import ShapCacheModel
        import uuid
        from datetime import datetime, timezone
        
        model = ShapCacheModel(
            id=uuid.uuid4(),
            product_id=cache_data.get("product_id"),
            product_name=cache_data.get("product_name"),
            model_id=cache_data.get("model_id", "unknown"),
            forecast_date=cache_data.get("forecast_date", ""),
            top_positive_drivers=cache_data.get("top_positive_drivers", []),
            top_negative_drivers=cache_data.get("top_negative_drivers", []),
            explanation_text=cache_data.get("explanation_text"),
            computed_at=datetime.now(timezone.utc)
        )
        self.session.add(model)
        await self.session.flush()

    async def get_entities_by_names(self, entity_type: EntityType, names: list[str]) -> dict[str, Any]:
        """Fetch entity IDs by names in a single batch. Returns a dict mapping name -> UUID."""
        if not names:
            return {}
            
        model_cls = _MODEL_MAP.get(entity_type)
        if not model_cls:
            raise ValueError(f"Unknown entity type: {entity_type}")
            
        if not hasattr(model_cls, 'name'):
            return {}
            
        # Use SQLAlchemy in operator for safe parameterized batch queries
        query = select(model_cls.name, model_cls.id).where(model_cls.name.in_(names))
        result = await self.session.execute(query)
        
        return {row[0]: row[1] for row in result.all()}

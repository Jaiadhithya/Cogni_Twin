import uuid
import re
import json
import logging
from io import BytesIO
from typing import Dict, Any, List

import pandas as pd
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from src.infrastructure.database.models import DatasetMetadata
from src.domain.interfaces.llm_client import LLMClient
from src.services.data_cleaner import DataCleaner

logger = logging.getLogger(__name__)

class DynamicIngestionService:
    def __init__(self, engine: AsyncEngine, llm_client: LLMClient):
        self.engine = engine
        self.llm_client = llm_client

    def _clean_column_name(self, col: Any) -> str:
        cleaned = str(col).lower().strip()
        cleaned = re.sub(r'[\s\-]+', '_', cleaned)
        cleaned = re.sub(r'[^\w_]', '', cleaned)
        return cleaned or "unnamed_column"

    def _sanitize_and_filter_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Sanitize column headers and drop useless index/empty synthetic artifact columns."""
        clean_cols = []
        keep_indices = []
        for i, col in enumerate(df.columns):
            raw_str = str(col).strip()
            raw_lower = raw_str.lower()
            # Drop unnamed or index artifact columns that are empty or simple range sequences
            if not raw_str or raw_lower.startswith("unnamed:") or raw_lower in ("index", "_index", "none"):
                if df.iloc[:, i].isna().all() or (pd.api.types.is_numeric_dtype(df.iloc[:, i]) and (df.iloc[:, i].dropna() == range(len(df.iloc[:, i].dropna()))).all()):
                    continue
            clean_name = self._clean_column_name(col)
            clean_cols.append(clean_name)
            keep_indices.append(i)

        df = df.iloc[:, keep_indices]
        df.columns = clean_cols
        return df

    async def _infer_schema_semantics(self, df: pd.DataFrame, dtypes: dict) -> dict:
        """
        Infer schema semantics via Groq LLM with rigorous post-inference validation
        to prevent any synthetic or hallucinated column pollution.
        """
        df_columns = [str(c) for c in df.columns]
        real_num_cols = [str(c) for c in df.select_dtypes(include=['number']).columns]
        real_date_cols = [str(c) for c in df.select_dtypes(include=['datetime64', 'datetime64[ns]']).columns]
        real_str_cols = [str(c) for c in df.select_dtypes(include=['object', 'string', 'category']).columns]

        # Also detect date-like column names if datetime conversion was partial
        date_name_candidates = [
            c for c in df_columns 
            if any(k in c.lower() for k in ['date', 'time', 'timestamp', 'epoch', 'day', 'ds', 'period', 'year', 'month'])
        ]

        # Fallback dictionary builder
        def _get_fallback_mapping() -> dict:
            primary_date = real_date_cols[0] if real_date_cols else (date_name_candidates[0] if date_name_candidates else None)
            target_candidates = [
                c for c in real_num_cols 
                if any(k in c.lower() for k in ['revenue', 'sales', 'target', 'total', 'amount', 'units_sold', 'units', 'price', 'profit'])
            ]
            target_metric = target_candidates[0] if target_candidates else (real_num_cols[0] if real_num_cols else None)
            
            dim_candidates = [c for c in real_str_cols if c != primary_date]
            if not dim_candidates:
                dim_candidates = [c for c in df_columns if c not in (primary_date, target_metric)][:4]

            numerical_columns = [c for c in real_num_cols if c != target_metric]
            categorical_columns = [c for c in real_str_cols if c != primary_date]

            return {
                "primary_date": primary_date,
                "target_metric": target_metric,
                "dimensions": dim_candidates[:4],
                "numerical_columns": numerical_columns,
                "categorical_columns": categorical_columns
            }

        raw_mapping = None
        try:
            sample_df = df.head(5).copy()
            # Convert timestamp columns to ISO strings for JSON serialization
            for c in sample_df.columns:
                if pd.api.types.is_datetime64_any_dtype(sample_df[c]):
                    sample_df[c] = sample_df[c].dt.strftime('%Y-%m-%d')

            sample_json = sample_df.to_json(orient='records')
            system_prompt = (
                "You are a master data pipeline architect. Analyze the provided CSV sample data and column datatypes. "
                "CRITICAL REQUIREMENT: You MUST ONLY select column names from the provided Available Columns list. "
                "DO NOT invent, hallucinate, or create synthetic/fake column names. "
                "Every column name you return MUST EXACTLY match one of the provided Available Columns.\n"
                "Return a JSON object with EXACTLY five keys:\n"
                "1. primary_date: the exact column name representing the primary transactional date timeline (or null if none),\n"
                "2. target_metric: the exact name of the primary numeric metric to forecast (e.g. revenue, sales, units_sold, amount),\n"
                "3. dimensions: a list of string categorical column names (e.g. region, product_category, sales_channel, sku_name),\n"
                "4. numerical_columns: a list of all other numeric column names excluding target_metric,\n"
                "5. categorical_columns: a list of all string/object column names."
            )

            user_prompt = (
                f"Available Columns: {df_columns}\n"
                f"Datatypes: {json.dumps(dtypes)}\n\n"
                f"Sample Data (5 rows): {sample_json}"
            )

            model_to_use = getattr(self.llm_client, "model_name", None) or "openai/gpt-oss-120b"
            response = await self.llm_client.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
                model=model_to_use,
                response_format={"type": "json_object"}
            )
            raw_mapping = json.loads(response)
        except Exception as e:
            logger.warning(f"Groq LLM semantic inference failed ({e}). Utilizing deterministic schema mapper.")
            raw_mapping = _get_fallback_mapping()

        if not isinstance(raw_mapping, dict):
            raw_mapping = _get_fallback_mapping()

        # =========================================================================
        # ANTI-POLLUTION SHIELD: Strictly prune any synthetic / hallucinated columns
        # =========================================================================
        # 1. Primary Date Validation
        p_date = raw_mapping.get("primary_date")
        if not p_date or p_date not in df_columns:
            if real_date_cols:
                p_date = real_date_cols[0]
            elif date_name_candidates:
                p_date = date_name_candidates[0]
            else:
                p_date = None

        # 2. Target Metric Validation
        t_metric = raw_mapping.get("target_metric")
        if not t_metric or t_metric not in df_columns or t_metric not in real_num_cols:
            target_candidates = [
                c for c in real_num_cols 
                if any(k in c.lower() for k in ['revenue', 'sales', 'target', 'total', 'amount', 'units_sold', 'units', 'price', 'profit'])
            ]
            if target_candidates:
                t_metric = target_candidates[0]
            elif real_num_cols:
                t_metric = real_num_cols[0]
            else:
                t_metric = None

        # 3. Dimensions Validation (Keep only real columns, drop synthetic/fake)
        dims = raw_mapping.get("dimensions", [])
        if not isinstance(dims, list):
            dims = []
        clean_dims = [d for d in dims if d in df_columns and d != p_date and d != t_metric]
        if not clean_dims:
            clean_dims = [c for c in real_str_cols if c != p_date][:4]
            if not clean_dims:
                clean_dims = [c for c in df_columns if c not in (p_date, t_metric)][:4]

        # 4. Numerical Columns Validation (Keep only real numeric columns, drop synthetic/fake)
        nums = raw_mapping.get("numerical_columns", [])
        if not isinstance(nums, list):
            nums = []
        clean_nums = [c for c in nums if c in df_columns and c in real_num_cols and c != t_metric]
        for c in real_num_cols:
            if c != t_metric and c not in clean_nums:
                clean_nums.append(c)

        # 5. Categorical Columns Validation (Keep only real columns, drop synthetic/fake)
        cats = raw_mapping.get("categorical_columns", [])
        if not isinstance(cats, list):
            cats = []
        clean_cats = [c for c in cats if c in df_columns and c not in real_num_cols and c != p_date]
        for c in real_str_cols:
            if c != p_date and c not in clean_cats:
                clean_cats.append(c)

        final_mapping = {
            "primary_date": p_date,
            "target_metric": t_metric,
            "dimensions": clean_dims[:4],
            "numerical_columns": clean_nums,
            "categorical_columns": clean_cats
        }
        logger.info(f"Resolved zero-pollution schema semantics: {final_mapping}")
        return final_mapping

    async def ingest_csv(self, file: UploadFile, db: AsyncSession) -> dict:
        logger.info(f"Dynamically ingesting CSV: {file.filename}")
        content = await file.read()
        df = pd.read_csv(BytesIO(content))

        # 1. Clean column names and drop any synthetic/artifact index columns
        df = self._sanitize_and_filter_columns(df)

        # 2. Apply robust data cleaning (parses non-standard dates, preserves signed numbers & currencies)
        df, clean_warnings = DataCleaner.clean_dynamic_df(df)

        # 3. Infer zero-pollution schema semantics
        dtypes_dict = {str(k): str(v) for k, v in df.dtypes.items()}
        column_mapping = await self._infer_schema_semantics(df, dtypes_dict)

        dataset_id = uuid.uuid4()
        table_name = f"dataset_{dataset_id.hex[:8]}"

        # 4. Persist clean DataFrame to PostgreSQL table via run_sync
        async with self.engine.begin() as conn:
            await conn.run_sync(
                lambda sync_conn: df.to_sql(name=table_name, con=sync_conn, if_exists='replace', index=False)
            )

        # 5. Save dataset metadata
        metadata = DatasetMetadata(
            id=dataset_id,
            original_filename=file.filename,
            generated_table_name=table_name,
            row_count=len(df),
            column_mapping=column_mapping
        )
        db.add(metadata)
        await db.commit()
        await db.refresh(metadata)

        columns = [{"name": str(col), "type": str(df[col].dtype)} for col in df.columns]
        logger.info(f"Ingested {len(df)} rows into {table_name} with zero synthetic pollution")

        return {
            "dataset_id": str(dataset_id),
            "table_name": table_name,
            "row_count": len(df),
            "columns": columns,
            "column_mapping": column_mapping,
            "warnings": clean_warnings
        }

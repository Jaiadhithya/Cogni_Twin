import uuid
import re
import json
import pandas as pd
from io import BytesIO
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from src.infrastructure.database.models import DatasetMetadata
from src.domain.interfaces.llm_client import LLMClient
import logging

logger = logging.getLogger(__name__)

class DynamicIngestionService:
    def __init__(self, engine: AsyncEngine, llm_client: LLMClient):
        self.engine = engine
        self.llm_client = llm_client

    def _clean_column_name(self, col: str) -> str:
        cleaned = str(col).lower().strip()
        cleaned = re.sub(r'[\s\-]+', '_', cleaned)
        cleaned = re.sub(r'[^\w_]', '', cleaned)
        return cleaned or "unnamed_column"

    async def _infer_schema_semantics(self, df_sample: pd.DataFrame, dtypes: dict) -> dict:
        try:
            sample_json = df_sample.head(5).to_json(orient='records')
            system_prompt = (
                "You are a data architect. Analyze this 5-row CSV sample and its datatypes. "
                "Return a JSON object with EXACTLY five keys: "
                "primary_date (the name of the column representing the main transactional timeline), "
                "target_metric (the name of the primary numeric column to forecast, like sales or revenue), "
                "dimensions (a list of string categorical columns), "
                "numerical_columns (a list of all numeric column names excluding the target_metric), "
                "and categorical_columns (a list of all string/object column names). "
                "Resolve edge cases logically."
            )
            
            user_prompt = f"Datatypes: {json.dumps(dtypes)}\n\nSample Data: {sample_json}"
            
            model_to_use = getattr(self.llm_client, "model_name", None) or "openai/gpt-oss-120b"
            response = await self.llm_client.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
                model=model_to_use,
                response_format={"type": "json_object"}
            )
            
            return json.loads(response)
        except Exception as e:
            logger.error(f"Groq LLM semantic inference failed: {e}")
            # Fallback logic
            date_col = df_sample.select_dtypes(include=['datetime64', 'datetime64[ns]']).columns
            date_val = date_col[0] if len(date_col) > 0 else None
            
            num_col = df_sample.select_dtypes(include=['number']).columns
            num_val = num_col[0] if len(num_col) > 0 else None
            
            return {
                "primary_date": date_val,
                "target_metric": num_val,
                "dimensions": [str(c) for c in df_sample.select_dtypes(include=['object', 'string']).columns][:4],
                "numerical_columns": [col for col in num_col if col != num_val],
                "categorical_columns": list(df_sample.select_dtypes(include=['object', 'string']).columns)
            }

    async def ingest_csv(self, file: UploadFile, db: AsyncSession) -> dict:
        logger.info(f"Dynamically ingesting CSV: {file.filename}")
        content = await file.read()
        df = pd.read_csv(BytesIO(content))

        # Sanitize columns
        df.columns = [self._clean_column_name(c) for c in df.columns]

        # Attempt to parse dates for object or string columns
        for col in df.columns:
            if df[col].dtype == 'object' or pd.api.types.is_string_dtype(df[col]):
                try:
                    try:
                        parsed = pd.to_datetime(df[col], errors='coerce', format='mixed')
                    except (ValueError, TypeError):
                        parsed = pd.to_datetime(df[col], errors='coerce')
                    valid_ratio = parsed.notna().sum() / max(len(df), 1)
                    is_date_col_name = any(k in col.lower() for k in ['date', 'time', 'day', 'timestamp', 'ds', 'period'])
                    if parsed.notna().sum() > 0 and (valid_ratio >= 0.5 or is_date_col_name):
                        df[col] = parsed
                except Exception:
                    pass
                    
        # Infer Schema Semantics via Groq
        dtypes_dict = {str(k): str(v) for k, v in df.dtypes.items()}
        column_mapping = await self._infer_schema_semantics(df, dtypes_dict)

        if not column_mapping.get("dimensions"):
            column_mapping["dimensions"] = [str(c) for c in df.select_dtypes(include=['object', 'string']).columns][:4]

        dataset_id = uuid.uuid4()
        table_name = f"dataset_{dataset_id.hex[:8]}"

        # Insert to DB using pandas to_sql via run_sync
        async with self.engine.begin() as conn:
            await conn.run_sync(
                lambda sync_conn: df.to_sql(name=table_name, con=sync_conn, if_exists='replace', index=False)
            )

        # Save metadata
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
        logger.info(f"Ingested {len(df)} rows into {table_name}")

        return {
            "dataset_id": str(dataset_id),
            "table_name": table_name,
            "row_count": len(df),
            "columns": columns,
            "column_mapping": column_mapping
        }

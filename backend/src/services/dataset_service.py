"""Dataset lifecycle operations beyond ingestion (undo an upload)."""

import logging
import re
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.exceptions import DatasetNotFoundError
from src.infrastructure.database.repository import invalidate_table_schemas
from src.infrastructure.ml.model_storage import ModelStorage
from src.infrastructure.ml.prophet_forecaster import drop_cached_models

logger = logging.getLogger(__name__)

_DATASET_TABLE = re.compile(r"^dataset_[0-9a-f]{32}$")


class DatasetService:
    def __init__(self, session: AsyncSession, storage: ModelStorage):
        self.session = session
        self.storage = storage

    async def delete_dataset(self, dataset_id: str) -> dict:
        """Remove a dataset and everything derived from it.

        The table drop, metadata delete and cache-row cleanup share one transaction
        (Postgres DDL is transactional), so a failure leaves the dataset intact.
        Model files are removed only after that commit, since the filesystem cannot
        take part in it.
        """
        dataset_uuid = uuid.UUID(str(dataset_id))
        row = (
            await self.session.execute(
                text("SELECT generated_table_name FROM dataset_metadata WHERE id = :id"),
                {"id": dataset_uuid},
            )
        ).first()
        if row is None:
            raise DatasetNotFoundError(f"Dataset '{dataset_id}' not found.")

        table_name = row[0]
        # The identifier comes from our own metadata, but never trust it blindly:
        # it must be exactly the table name ingestion would have generated.
        if not _DATASET_TABLE.match(table_name) or table_name != f"dataset_{dataset_uuid.hex}":
            raise DatasetNotFoundError(f"Dataset '{dataset_id}' has an unexpected table name; refusing to drop it.")

        model_ids = self.storage.model_ids_for_dataset(str(dataset_uuid))

        try:
            await self.session.execute(text(f'DROP TABLE IF EXISTS "{table_name}"'))
            if model_ids:
                await self.session.execute(
                    text("DELETE FROM shap_cache WHERE model_id = ANY(:ids)"), {"ids": model_ids}
                )
            await self.session.execute(text("DELETE FROM upload_records WHERE id = :id"), {"id": dataset_uuid})
            await self.session.execute(text("DELETE FROM dataset_metadata WHERE id = :id"), {"id": dataset_uuid})
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        removed = self.storage.delete_models_for_dataset(str(dataset_uuid))
        drop_cached_models(self.storage, str(dataset_uuid))
        invalidate_table_schemas()
        logger.info(f"Deleted dataset {dataset_uuid} (table {table_name}, {len(removed)} model(s))")

        return {
            "dataset_id": str(dataset_uuid),
            "table_name": table_name,
            "models_removed": len(removed),
        }

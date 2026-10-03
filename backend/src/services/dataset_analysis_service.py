"""Column statistics, correlations and scatter samples for an uploaded dataset."""

import asyncio
import logging
import re
import uuid
from typing import Any, Literal, Optional

import numpy as np
import pandas as pd
from sqlalchemy import text

from src.config import settings
from src.domain.exceptions import DatasetNotFoundError, ValidationError
from src.domain.interfaces.uow import UnitOfWork
from src.infrastructure import analysis_cache

logger = logging.getLogger(__name__)

NUMERIC_TYPES = {"smallint", "integer", "bigint", "numeric", "real", "double precision"}
CATEGORICAL_TYPES = {"text", "character varying", "character", "boolean"}
MAX_NUMERIC_COLUMNS = 50
MAX_CATEGORICAL_COLUMNS = 50
TOP_VALUES = 5
_DATASET_TABLE = re.compile(r"^dataset_[0-9a-f]{32}$")

Method = Literal["pearson", "spearman"]


def quote_ident(name: str) -> str:
    """Quote an identifier taken from information_schema (never from user input)."""
    return '"' + name.replace('"', '""') + '"'


def _num(value: Any) -> Optional[float]:
    if value is None:
        return None
    f = float(value)
    return round(f, 6) if np.isfinite(f) else None


def correlation_matrix(df: pd.DataFrame, method: Method) -> dict[str, Any]:
    """Correlation matrix over numeric columns with the pairwise-complete n of every cell."""
    cols = list(df.columns)
    corr = df.corr(method=method, numeric_only=True)
    present = df.notna().astype(int)
    pair_n = present.T.dot(present)
    matrix = [[_num(corr.loc[a, b]) if a in corr.index and b in corr.columns else None for b in cols] for a in cols]
    counts = [[int(pair_n.loc[a, b]) for b in cols] for a in cols]
    return {"method": method, "columns": cols, "matrix": matrix, "n": counts}


class DatasetAnalysisService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def _resolve(self, dataset_id: str) -> tuple[str, str, int, list[tuple[str, str]], dict]:
        """Return ``(dataset_id, table, row_count, [(column, data_type)], column_mapping)`` from metadata."""
        try:
            dataset_uuid = uuid.UUID(str(dataset_id))
        except ValueError:
            raise DatasetNotFoundError(f"Dataset '{dataset_id}' not found.")
        async with self.uow as uow:
            session = uow.repository.session
            row = (
                await session.execute(
                    text("SELECT generated_table_name, row_count, column_mapping FROM dataset_metadata WHERE id = :id"),
                    {"id": dataset_uuid},
                )
            ).first()
            if row is None or not _DATASET_TABLE.match(row[0]):
                raise DatasetNotFoundError(f"Dataset '{dataset_id}' not found.")
            table = row[0]
            cols = (
                await session.execute(
                    text(
                        "SELECT column_name, data_type FROM information_schema.columns "
                        "WHERE table_schema = 'public' AND table_name = :t ORDER BY ordinal_position"
                    ),
                    {"t": table},
                )
            ).all()
            mapping = row[2] if isinstance(row[2], dict) else {}
            return str(dataset_uuid), table, int(row[1] or 0), [(c[0], c[1]) for c in cols], mapping

    async def latest_dataset_id(self) -> Optional[str]:
        async with self.uow as uow:
            row = (
                await uow.repository.session.execute(
                    text("SELECT id FROM dataset_metadata ORDER BY upload_date DESC LIMIT 1")
                )
            ).first()
            return str(row[0]) if row else None

    @staticmethod
    def _numeric_columns(columns: list[tuple[str, str]]) -> list[str]:
        return [name for name, dtype in columns if dtype in NUMERIC_TYPES]

    async def numeric_columns(self, dataset_id: str) -> list[str]:
        _, _, _, columns, _ = await self._resolve(dataset_id)
        return self._numeric_columns(columns)

    async def target_metric(self, dataset_id: str) -> Optional[str]:
        _, _, _, _, mapping = await self._resolve(dataset_id)
        return mapping.get("target_metric")

    async def profile(self, dataset_id: str) -> dict[str, Any]:
        ds, table, row_count, columns, _ = await self._resolve(dataset_id)
        key = (ds, "profile")
        cached = analysis_cache.get(key)
        if cached is not None:
            return cached

        numeric = self._numeric_columns(columns)
        categorical = [name for name, dtype in columns if dtype in CATEGORICAL_TYPES]
        tbl = quote_ident(table)
        result_numeric: list[dict[str, Any]] = []
        result_categorical: list[dict[str, Any]] = []

        async with self.uow as uow:
            session = uow.repository.session
            for name in numeric[:MAX_NUMERIC_COLUMNS]:
                col = f"CAST({quote_ident(name)} AS DOUBLE PRECISION)"
                row = (
                    await session.execute(
                        text(
                            f"WITH s AS (SELECT AVG({col}) AS m, STDDEV_POP({col}) AS sp FROM {tbl} WHERE {col} IS NOT NULL) "
                            f"SELECT COUNT({col}) AS cnt, COUNT(*) - COUNT({col}) AS nulls, AVG({col}) AS mean, "
                            f"STDDEV_SAMP({col}) AS std, MIN({col}) AS min, MAX({col}) AS max, "
                            f"PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY {col}) AS median, "
                            f"PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY {col}) AS q1, "
                            f"PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY {col}) AS q3, "
                            f"AVG(POWER({col} - s.m, 3)) AS m3, MAX(s.sp) AS sp FROM {tbl}, s"
                        )
                    )
                ).mappings().one()
                sp, m3 = row["sp"], row["m3"]
                skew = (m3 / sp**3) if sp and m3 is not None and sp > 0 else None
                result_numeric.append(
                    {
                        "column": name,
                        "count": int(row["cnt"]),
                        "nulls": int(row["nulls"]),
                        "mean": _num(row["mean"]),
                        "median": _num(row["median"]),
                        "std": _num(row["std"]),
                        "min": _num(row["min"]),
                        "max": _num(row["max"]),
                        "iqr": _num(row["q3"] - row["q1"]) if row["q1"] is not None else None,
                        "skewness": _num(skew),
                    }
                )

            for name in categorical[:MAX_CATEGORICAL_COLUMNS]:
                col = quote_ident(name)
                head = (
                    await session.execute(
                        text(f"SELECT COUNT({col}) AS cnt, COUNT(*) - COUNT({col}) AS nulls, COUNT(DISTINCT {col}) AS card FROM {tbl}")
                    )
                ).mappings().one()
                top = (
                    await session.execute(
                        text(
                            f"SELECT CAST({col} AS TEXT) AS value, COUNT(*) AS n FROM {tbl} "
                            f"WHERE {col} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT :k"
                        ),
                        {"k": TOP_VALUES},
                    )
                ).mappings().all()
                result_categorical.append(
                    {
                        "column": name,
                        "count": int(head["cnt"]),
                        "nulls": int(head["nulls"]),
                        "cardinality": int(head["card"]),
                        "top_values": [{"value": r["value"], "count": int(r["n"])} for r in top],
                    }
                )

        result = {
            "dataset_id": ds,
            "row_count": row_count,
            "numeric": result_numeric,
            "categorical": result_categorical,
            "skipped_columns": numeric[MAX_NUMERIC_COLUMNS:] + categorical[MAX_CATEGORICAL_COLUMNS:],
            "notes": ["skewness is the population (Fisher-Pearson g1) coefficient; iqr = q3 - q1."],
        }
        analysis_cache.put(key, result)
        return result

    async def correlations(self, dataset_id: str, method: Method = "pearson") -> dict[str, Any]:
        ds, table, row_count, columns, _ = await self._resolve(dataset_id)
        key = (ds, "correlations", method, settings.ANALYSIS_SAMPLE_ROWS)
        cached = analysis_cache.get(key)
        if cached is not None:
            return cached

        numeric = self._numeric_columns(columns)[:MAX_NUMERIC_COLUMNS]
        if len(numeric) < 2:
            raise ValidationError("At least two numeric columns are needed to compute correlations.")

        select = ", ".join(f"CAST({quote_ident(c)} AS DOUBLE PRECISION) AS {quote_ident(c)}" for c in numeric)
        cap = settings.ANALYSIS_SAMPLE_ROWS
        sampled = row_count > cap
        sql = f"SELECT {select} FROM {quote_ident(table)}" + (" ORDER BY random() LIMIT :cap" if sampled else "")
        async with self.uow as uow:
            rows = (await uow.repository.session.execute(text(sql), {"cap": cap} if sampled else {})).all()

        df = pd.DataFrame(rows, columns=numeric).astype(float)
        result = await asyncio.to_thread(correlation_matrix, df, method)
        result.update({"dataset_id": ds, "sampled": sampled, "sample_size": len(df)})
        analysis_cache.put(key, result)
        return result

    async def scatter(self, dataset_id: str, x: str, y: str, limit: int) -> dict[str, Any]:
        ds, table, _, columns, _ = await self._resolve(dataset_id)
        numeric = self._numeric_columns(columns)
        for label, name in (("x", x), ("y", y)):
            if name not in numeric:
                raise ValidationError(f"'{label}' must be a numeric column of this dataset; available: {', '.join(numeric)}.")

        key = (ds, "scatter", x, y, limit)
        cached = analysis_cache.get(key)
        if cached is not None:
            return cached

        cx, cy = (f"CAST({quote_ident(c)} AS DOUBLE PRECISION)" for c in (x, y))
        tbl = quote_ident(table)
        async with self.uow as uow:
            session = uow.repository.session
            stats = (
                await session.execute(
                    text(f"SELECT COUNT(*) AS n, CORR({cx}, {cy}) AS r FROM {tbl} WHERE {cx} IS NOT NULL AND {cy} IS NOT NULL")
                )
            ).mappings().one()
            rows = (
                await session.execute(
                    text(f"SELECT {cx} AS x, {cy} AS y FROM {tbl} WHERE {cx} IS NOT NULL AND {cy} IS NOT NULL ORDER BY random() LIMIT :limit"),
                    {"limit": limit},
                )
            ).all()

        result = {
            "dataset_id": ds,
            "x": x,
            "y": y,
            "points": [{x: float(r[0]), y: float(r[1])} for r in rows],
            "total_pairs": int(stats["n"]),
            "returned": len(rows),
            "sampled": int(stats["n"]) > len(rows),
            "pearson_r": _num(stats["r"]),
        }
        analysis_cache.put(key, result)
        return result


# --- Natural-language relationship questions -------------------------------------------------

RELATIONSHIP_HINT = re.compile(
    r"\b(relat\w*|relationship|correlat\w*|associat\w*|versus|vs|affect\w*|influenc\w*|depend\w*|impact\w*)\b",
    re.I,
)
_TARGET_WORDS = {"sales", "revenue", "demand", "volume", "units"}
_STOP = {"does", "with", "what", "that", "this", "between", "relate", "relationship", "affect", "show", "from"}


def _norm(text_: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text_.lower()).strip()


def resolve_columns_in_question(question: str, numeric_columns: list[str], target_metric: Optional[str]) -> list[str]:
    """Numeric columns the question talks about, in order of mention (at most two).

    A column matches by its full name ("marketing spend"), by a word that is a token of
    exactly one numeric column ("price"), or via sales/revenue/demand/volume for the
    dataset's target metric. Nothing is guessed: unmatched questions return fewer than two.
    """
    q = f" {_norm(question)} "
    found: dict[str, int] = {}

    for col in numeric_columns:
        pos = q.find(f" {_norm(col)} ")
        if pos >= 0:
            found[col] = pos

    words = q.split()
    token_owners: dict[str, list[str]] = {}
    for col in numeric_columns:
        for token in _norm(col).split():
            token_owners.setdefault(token, []).append(col)
    for word in words:
        owners = token_owners.get(word, [])
        if len(word) >= 4 and word not in _STOP and len(owners) == 1 and owners[0] not in found:
            found[owners[0]] = q.find(f" {word} ")

    if target_metric and target_metric in numeric_columns and target_metric not in found:
        for word in words:
            if word in _TARGET_WORDS:
                found[target_metric] = q.find(f" {word} ")
                break

    return [c for c, _ in sorted(found.items(), key=lambda kv: kv[1])][:2]


def describe_correlation(r: Optional[float]) -> str:
    if r is None:
        return "could not be computed (a column is constant)"
    strength = (
        "negligible" if abs(r) < 0.1 else "weak" if abs(r) < 0.3 else "moderate" if abs(r) < 0.5
        else "strong" if abs(r) < 0.7 else "very strong"
    )
    direction = "" if strength == "negligible" else (" positive" if r > 0 else " negative")
    return f"{strength}{direction}"

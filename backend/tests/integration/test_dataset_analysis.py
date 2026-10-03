"""Column statistics, correlations and scatter samples."""

import math
import uuid

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from src.infrastructure import analysis_cache
from src.infrastructure.database.repository import invalidate_table_schemas
from src.main import app
from src.services.dataset_analysis_service import (
    correlation_matrix,
    describe_correlation,
    resolve_columns_in_question,
)

client = TestClient(app)
NUMERIC = ["units_sold", "unit_price", "marketing_spend", "supplier_lead_time_days", "competitor_discount_pct"]


def test_profile_matches_pandas(sales_dataset):
    ds = sales_dataset["dataset_id"]
    res = client.get(f"/api/v1/data/{ds}/profile")
    assert res.status_code == 200, res.text
    data = res.json()["data"]

    assert {c["column"] for c in data["numeric"]} == set(NUMERIC)
    by_col = {c["column"]: c for c in data["numeric"]}

    # compare with a direct computation over the same rows
    table = sales_dataset["table_name"]
    from src.config import settings
    import psycopg2

    conn = psycopg2.connect(settings.DATABASE_URL.replace("+asyncpg", ""))
    try:
        df = pd.read_sql(f'SELECT * FROM "{table}"', conn)
    finally:
        conn.close()

    for col in NUMERIC:
        s = df[col].astype(float)
        got = by_col[col]
        assert got["count"] == s.count() and got["nulls"] == s.isna().sum()
        assert got["mean"] == pytest.approx(s.mean(), abs=1e-5)
        assert got["median"] == pytest.approx(s.median(), abs=1e-5)
        assert got["std"] == pytest.approx(s.std(), abs=1e-5)
        assert got["min"] == pytest.approx(s.min()) and got["max"] == pytest.approx(s.max())
        assert got["iqr"] == pytest.approx(s.quantile(0.75) - s.quantile(0.25), abs=1e-5)
        pop_skew = ((s - s.mean()) ** 3).mean() / (((s - s.mean()) ** 2).mean() ** 1.5)
        assert got["skewness"] == pytest.approx(pop_skew, abs=1e-4)

    product = next(c for c in data["categorical"] if c["column"] == "product_id")
    assert product["cardinality"] == 1 and product["top_values"] == [{"value": "P001", "count": len(df)}]


def test_correlations_symmetric_with_pair_counts(sales_dataset):
    ds = sales_dataset["dataset_id"]
    for method in ("pearson", "spearman"):
        res = client.get(f"/api/v1/data/{ds}/correlations?method={method}")
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        cols, m, n = data["columns"], data["matrix"], data["n"]
        assert set(cols) == set(NUMERIC) and data["method"] == method and data["sampled"] is False
        for i in range(len(cols)):
            assert m[i][i] == pytest.approx(1.0)
            for j in range(len(cols)):
                assert m[i][j] == pytest.approx(m[j][i], abs=1e-9)
                assert n[i][j] == data["sample_size"]
    assert client.get(f"/api/v1/data/{ds}/correlations?method=kendall").status_code == 422


def test_scatter_validates_columns_and_limits(sales_dataset):
    ds = sales_dataset["dataset_id"]
    ok = client.get(f"/api/v1/data/{ds}/scatter?x=marketing_spend&y=units_sold&limit=30")
    assert ok.status_code == 200, ok.text
    data = ok.json()["data"]
    assert data["returned"] == 30 and data["sampled"] is True and data["total_pairs"] == sales_dataset["row_count"]
    assert set(data["points"][0]) == {"marketing_spend", "units_sold"}
    assert -1 <= data["pearson_r"] <= 1

    assert client.get(f"/api/v1/data/{ds}/scatter?x=product_id&y=units_sold").status_code == 400
    assert client.get(f"/api/v1/data/{ds}/scatter?x=nope&y=units_sold").status_code == 400
    assert client.get(f'/api/v1/data/{ds}/scatter?x=units_sold&y=units_sold"; DROP TABLE x;--').status_code == 400
    assert client.get(f"/api/v1/data/{ds}/scatter?x=units_sold&y=unit_price&limit=0").status_code == 422
    assert client.get(f"/api/v1/data/{ds}/scatter?x=units_sold&y=unit_price&limit=99999").status_code == 422


def test_unknown_dataset_is_404_and_bad_id_is_422():
    for suffix in ("profile", "correlations", "scatter?x=a&y=b"):
        assert client.get(f"/api/v1/data/{uuid.uuid4()}/{suffix}").status_code == 404
        assert client.get(f"/api/v1/data/not-a-uuid/{suffix}").status_code == 422


def test_cache_is_used_and_invalidated(sales_dataset):
    ds = sales_dataset["dataset_id"]
    invalidate_table_schemas()
    client.get(f"/api/v1/data/{ds}/profile")
    assert analysis_cache.get((ds, "profile")) is not None
    invalidate_table_schemas(ds)
    assert analysis_cache.get((ds, "profile")) is None


def test_query_engine_answers_relationship_question_with_scatter(sales_dataset):
    ds = sales_dataset["dataset_id"]
    res = client.post("/api/v1/query", json={"question": "How does marketing spend relate to units sold?", "dataset_id": ds})
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    chart = data["charts"][0]
    assert chart["type"] == "scatter" and {chart["x_key"], chart["y_keys"][0]} == {"marketing_spend", "units_sold"}
    assert "Pearson r" in data["answer"] and "does not by itself show" in data["answer"]
    assert data["generated_sql"] == ""


def test_resolve_columns_in_question():
    cols = NUMERIC
    assert resolve_columns_in_question("how does marketing spend relate to sales?", cols, "units_sold") == ["marketing_spend", "units_sold"]
    assert resolve_columns_in_question("is price correlated with units sold", cols, "units_sold") == ["unit_price", "units_sold"]
    assert resolve_columns_in_question("relationship between supplier lead time days and revenue", cols, "units_sold") == ["supplier_lead_time_days", "units_sold"]
    # one recognizable column is not enough: nothing is guessed
    assert resolve_columns_in_question("how does marketing spend relate to happiness", cols, None) == ["marketing_spend"]
    assert resolve_columns_in_question("tell me a story", cols, "units_sold") == []


def test_correlation_matrix_handles_missing_values_and_constants():
    df = pd.DataFrame({"a": [1.0, 2.0, 3.0, 4.0, np.nan], "b": [2.0, 4.0, 6.0, 8.0, 10.0], "c": [5.0] * 5})
    out = correlation_matrix(df, "pearson")
    i = out["columns"].index
    assert out["matrix"][i("a")][i("b")] == pytest.approx(1.0)
    assert out["n"][i("a")][i("b")] == 4 and out["n"][i("b")][i("b")] == 5
    assert out["matrix"][i("a")][i("c")] is None  # constant column: undefined, not 0 or NaN


def test_describe_correlation():
    assert describe_correlation(0.82) == "very strong positive"
    assert describe_correlation(-0.35) == "moderate negative"
    assert describe_correlation(0.02) == "negligible"
    assert "constant" in describe_correlation(None)

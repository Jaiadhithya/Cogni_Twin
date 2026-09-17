"""Unit tests for AST-based SQL validation in QueryService._validate_sql."""

import pytest

from src.services.query_service import QueryService
from unittest.mock import MagicMock


@pytest.fixture
def qs():
    return QueryService(uow=MagicMock(), llm_client=MagicMock())


@pytest.mark.parametrize("sql", [
    "SELECT * FROM sales",
    "WITH x AS (SELECT 1) SELECT * FROM x",
    "SELECT * FROM sales LIMIT 20;",
    'SELECT a, ROUND(AVG(CAST("p" AS NUMERIC)), 2) FROM "sales";',
    "SELECT sale_date, SUM(total_amount) FROM sales GROUP BY sale_date",
])
def test_readonly_selects_accepted(qs, sql):
    assert qs._validate_sql(sql) is True


@pytest.mark.parametrize("sql", [
    "SELECT * FROM sales; DROP TABLE users;",
    "DROP TABLE users",
    "INSERT INTO users VALUES (1)",
    "UPDATE users SET name = 'x'",
    "DELETE FROM users",
    "CREATE TABLE t (a int)",
    "ALTER TABLE users ADD COLUMN x int",
    "TRUNCATE TABLE users",
    "SELECT * INTO new_tbl FROM sales",
    "WITH d AS (DELETE FROM x RETURNING 1) SELECT * FROM d",
    "SELECT 1; SELECT 2",
    "GRANT SELECT ON sales TO public",
    "THIS IS NOT SQL AT ALL",
])
def test_destructive_and_malformed_rejected(qs, sql):
    assert qs._validate_sql(sql) is False

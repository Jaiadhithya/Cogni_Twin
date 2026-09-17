"""Unit tests for the X-API-Key authentication middleware."""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_health_exempt_from_api_key(client):
    with patch("src.config.settings.API_KEY", "test-secret"):
        response = client.get("/api/v1/health")
    assert response.status_code == 200


def test_missing_api_key_rejected(client):
    with patch("src.config.settings.API_KEY", "test-secret"):
        response = client.get("/api/v1/sales")
    assert response.status_code == 401
    assert response.json()["error"]["type"] == "UNAUTHORIZED"


def test_wrong_api_key_rejected(client):
    with patch("src.config.settings.API_KEY", "test-secret"):
        response = client.get("/api/v1/sales", headers={"X-API-Key": "wrong"})
    assert response.status_code == 401


def test_valid_api_key_accepted(client):
    with patch("src.config.settings.API_KEY", "test-secret"):
        response = client.get("/api/v1/sales", headers={"X-API-Key": "test-secret"})
    assert response.status_code != 401


def test_no_api_key_configured_allows_all(client):
    with patch("src.config.settings.API_KEY", ""):
        response = client.get("/api/v1/health")
    assert response.status_code == 200

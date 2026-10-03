"""Unit tests for P0-5: upload limits and safe generated filenames."""

import os
import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
import pandas as pd

from fastapi.testclient import TestClient

from src.main import app
from src.dependencies import get_rag_service
from src.services.ingestion import DynamicIngestionService
from src.domain.exceptions import FileTooLargeError, ValidationError
from src.api.schemas.document import DocumentUploadResponse


@pytest.fixture
def service():
    return DynamicIngestionService(engine=MagicMock(), llm_client=MagicMock())


def _make_file(content: bytes):
    f = MagicMock()
    f.filename = "test.csv"
    f.read = AsyncMock(return_value=content)
    return f


@pytest.mark.asyncio
async def test_oversized_csv_rejected(service):
    f = _make_file(b"x" * (2 * 1024 * 1024))
    fake_settings = SimpleNamespace(MAX_UPLOAD_SIZE_MB=1, MAX_UPLOAD_ROWS=10**9)
    with patch("src.services.ingestion.settings", fake_settings):
        with pytest.raises(FileTooLargeError):
            await service.ingest_csv(f, MagicMock())


@pytest.mark.asyncio
async def test_too_many_rows_rejected(service):
    f = _make_file(b"a\n1")
    big_df = pd.DataFrame({"a": list(range(100))})
    fake_settings = SimpleNamespace(MAX_UPLOAD_SIZE_MB=500, MAX_UPLOAD_ROWS=5)
    with patch("src.services.ingestion.settings", fake_settings):
        with patch("src.services.ingestion.pd.read_csv", return_value=big_df):
            with pytest.raises(ValidationError):
                await service.ingest_csv(f, MagicMock())


def test_document_upload_blocks_path_traversal(tmp_path):
    fake_rag = MagicMock()
    fake_rag.upload_document = AsyncMock(return_value=DocumentUploadResponse(
        document_id="doc-1", filename="../../evil.pdf", chunk_count=1, status="success"
    ))
    app.dependency_overrides[get_rag_service] = lambda: fake_rag
    try:
        with patch("src.api.document_router.settings.UPLOAD_DIR", str(tmp_path)):
            with TestClient(app) as client:
                response = client.post(
                    "/api/v1/documents/upload",
                    files={"file": ("../../evil.pdf", b"%PDF-fake", "application/pdf")},
                )
        assert response.status_code == 200
        saved_path = fake_rag.upload_document.call_args[0][0]
        assert os.path.dirname(saved_path) == str(tmp_path)
        assert ".." not in os.path.basename(saved_path)
    finally:
        app.dependency_overrides.pop(get_rag_service, None)


def _post_document(tmp_path, filename, content, max_mb=25):
    fake_rag = MagicMock()
    fake_rag.upload_document = AsyncMock(return_value=DocumentUploadResponse(
        document_id="doc-1", filename=filename, chunk_count=1, status="success"
    ))
    app.dependency_overrides[get_rag_service] = lambda: fake_rag
    try:
        with patch("src.api.document_router.settings.UPLOAD_DIR", str(tmp_path)), \
             patch("src.api.document_router.settings.MAX_DOCUMENT_UPLOAD_SIZE_MB", max_mb):
            with TestClient(app) as client:
                response = client.post(
                    "/api/v1/documents/upload",
                    files={"file": (filename, content, "application/pdf")},
                )
        return response, fake_rag
    finally:
        app.dependency_overrides.pop(get_rag_service, None)


def test_document_upload_rejects_oversize_and_leaves_no_file(tmp_path):
    response, fake_rag = _post_document(tmp_path, "big.pdf", b"%PDF-" + b"x" * (2 * 1024 * 1024), max_mb=1)
    assert response.status_code == 413
    assert response.json()["error"]["type"] == "FILE_TOO_LARGE"
    fake_rag.upload_document.assert_not_called()
    assert list(tmp_path.iterdir()) == []


def test_document_upload_rejects_non_pdf_extension(tmp_path):
    response, fake_rag = _post_document(tmp_path, "notes.txt", b"%PDF-1.4 hello")
    assert response.status_code == 400
    fake_rag.upload_document.assert_not_called()
    assert list(tmp_path.iterdir()) == []


def test_document_upload_rejects_pdf_extension_without_magic_bytes(tmp_path):
    response, fake_rag = _post_document(tmp_path, "fake.pdf", b"MZ\x90\x00 not a pdf")
    assert response.status_code == 400
    fake_rag.upload_document.assert_not_called()
    assert list(tmp_path.iterdir()) == []


def test_document_upload_accepts_valid_pdf(tmp_path):
    response, fake_rag = _post_document(tmp_path, "ok.pdf", b"%PDF-1.4\nbody")
    assert response.status_code == 200
    fake_rag.upload_document.assert_called_once()
    assert len(list(tmp_path.iterdir())) == 1

"""Chaos testing and stress auditing suite for ingestion and document RAG pipelines.
Task: [QA-CHAOS-01] Real-World Dataset & Ingestion Chaos Auditing.
"""

import io
import os
import pytest
import pymupdf
import pandas as pd
from fastapi.testclient import TestClient

from src.main import app
from src.config import settings

client = TestClient(app)


DEMO_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "demo_data"))


def _upload_demo_csv(filename: str):
    csv_path = os.path.join(DEMO_DATA_DIR, filename)
    assert os.path.exists(csv_path), f"{filename} not found in demo_data/"
    with open(csv_path, "rb") as f:
        file_bytes = f.read()
    return client.post(
        "/api/v1/ingest/csv",
        files={"file": (filename, io.BytesIO(file_bytes), "text/csv")}
    )


def test_real_world_dataset_ingestion():
    """Stress test ingestion with the Brewhaus demo dataset (7,312 rows, non-standard column names)."""
    response = _upload_demo_csv("brewhaus_cafe_sales_2025_2026.csv")

    assert response.status_code in [200, 201], f"Real dataset ingestion failed: {response.text}"
    data = response.json()
    assert "dataset_id" in data
    assert "table_name" in data
    assert data["row_count"] >= 7000, f"Expected ~7312 rows, got {data['row_count']}"
    assert "column_mapping" in data
    cols = [col["name"] for col in data["columns"]]
    for col in cols:
        assert ";" not in col, f"Unsanitized column name: {col}"
        assert "--" not in col, f"SQL comment injection in column name: {col}"


def test_high_row_count_ingestion():
    """Stress test ingestion with the Nexa Electronics demo dataset (17,520 rows)."""
    response = _upload_demo_csv("nexa_electronics_sales_2024_2026.csv")

    assert response.status_code in [200, 201], f"High-volume ingestion failed: {response.text}"
    data = response.json()
    assert data["row_count"] >= 17000, f"Expected ~17520 rows, got {data['row_count']}"


def test_pdf_knowledge_base_rag_ingestion(tmp_path):
    """Test PDF document generation, extraction, Qdrant vector storage, and semantic similarity search."""
    # 1. Generate realistic multi-paragraph PDF document using PyMuPDF
    pdf_path = tmp_path / "supplier_enterprise_sla_contract.pdf"
    doc = pymupdf.open()

    page1 = doc.new_page()
    page1.insert_text((50, 60), "COGNITWIN GLOBAL ENTERPRISE SUPPLIER AGREEMENT", fontsize=14)
    page1.insert_text((50, 90), "Section 1: Delivery Schedules & Performance Guarantees", fontsize=11)
    page1.insert_text(
        (50, 115),
        "Suppliers must fulfill hardware components within 14 calendar days of purchase order issuance.\n"
        "Late deliveries exceeding 7 days incur an automatic 5% invoice penalty per calendar week.\n"
        "Critical microchips and quantum sensor units require expedited air freight with temperature logging.",
        fontsize=10
    )

    page2 = doc.new_page()
    page2.insert_text((50, 60), "Section 2: Pricing, Volume Rebates, and Force Majeure", fontsize=11)
    page2.insert_text(
        (50, 90),
        "For annual procurement exceeding 10,000 units, the client receives a tiered volume rebate of 12%.\n"
        "Payments are net 45 days upon verified warehouse intake and automated QA barcode validation.\n"
        "Force majeure events require formal written notification within 48 hours to waive SLA penalties.",
        fontsize=10
    )
    doc.save(str(pdf_path))
    doc.close()

    # 2. Upload PDF via /api/v1/documents/upload
    with open(pdf_path, "rb") as f:
        upload_res = client.post(
            "/api/v1/documents/upload",
            files={"file": ("supplier_enterprise_sla_contract.pdf", f, "application/pdf")}
        )

    assert upload_res.status_code == 200, f"PDF upload failed: {upload_res.text}"
    upload_data = upload_res.json()["data"]
    assert upload_data["chunk_count"] >= 1, "Expected at least 1 chunk from PDF"
    assert upload_data["status"] in ["success", "processed"], f"Unexpected status: {upload_data['status']}"

    # 3. Perform semantic search via /api/v1/documents/search
    search_payload = {
        "query": "What is the late delivery penalty for suppliers?",
        "top_k": 3
    }
    search_res = client.post("/api/v1/documents/search", json=search_payload)
    assert search_res.status_code == 200, f"Document search failed: {search_res.text}"
    search_data = search_res.json()["data"]
    assert len(search_data["results"]) > 0, "No semantic search results returned"
    
    # Verify semantic match relevance
    top_result = search_data["results"][0]
    assert "penalty" in top_result["text"].lower() or "delivery" in top_result["text"].lower()
    assert top_result["score"] > 0.0, f"Expected positive similarity score, got {top_result['score']}"

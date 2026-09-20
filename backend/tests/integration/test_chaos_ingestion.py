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


def test_real_world_dataset_ingestion():
    """Stress test ingestion with the real-world retail_enterprise_business_data.csv (1,841 rows)."""
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "retail_enterprise_business_data.csv")),
        r"C:\ML Project\retail_enterprise_business_data.csv"
    ]
    csv_path = next((p for p in possible_paths if os.path.exists(p)), None)
    assert csv_path is not None, "retail_enterprise_business_data.csv not found"

    with open(csv_path, "rb") as f:
        file_bytes = f.read()

    response = client.post(
        "/api/v1/ingest/csv",
        files={"file": ("retail_enterprise_business_data.csv", io.BytesIO(file_bytes), "text/csv")}
    )

    assert response.status_code in [200, 201], f"Real dataset ingestion failed: {response.text}"
    data = response.json()
    assert "dataset_id" in data
    assert "table_name" in data
    assert data["row_count"] >= 1800, f"Expected ~1841 rows, got {data['row_count']}"
    assert "column_mapping" in data
    mapping = data["column_mapping"]
    assert mapping.get("primary_date") is not None, "Failed to infer primary_date"
    assert mapping.get("target_metric") is not None, "Failed to infer target_metric"


def test_dirty_dataset_corrupted_dates():
    """Chaos test ingestion with corrupted, mixed, and unparseable timestamp formats."""
    dirty_csv = """date,product_name,units_sold,unit_price,total_revenue
2024-01-01,Smart Sensor Alpha,10,150.0,1500.0
02/15/2024,Smart Sensor Beta,12,120.0,1440.0
15-03-2024,Smart Sensor Gamma,8,200.0,1600.0
2024/04/10,Smart Sensor Delta,15,90.0,1350.0
corrupted_timestamp_string,Smart Sensor Epsilon,5,300.0,1500.0
9999-99-99,Smart Sensor Zeta,7,110.0,770.0
,Smart Sensor Eta,20,50.0,1000.0
2024-05-01 14:30:00,Smart Sensor Theta,14,130.0,1820.0
None,Smart Sensor Iota,9,180.0,1620.0
2024-06-01,Smart Sensor Kappa,11,140.0,1540.0
"""
    file_obj = io.BytesIO(dirty_csv.encode("utf-8"))
    file_obj.name = "dirty_dates.csv"

    response = client.post(
        "/api/v1/ingest/csv",
        files={"file": ("dirty_dates.csv", file_obj, "text/csv")}
    )

    assert response.status_code in [200, 201], f"Corrupted date ingestion failed: {response.text}"
    data = response.json()
    assert "dataset_id" in data
    assert data["row_count"] == 10
    assert "table_name" in data


def test_dirty_dataset_negative_pricing_and_symbols():
    """Chaos test ingestion with negative prices, currency symbols, percentages, and outliers."""
    dirty_numeric_csv = '''timestamp,sku_id,unit_price,discount_pct,units_sold,revenue
2024-01-01,SKU-001,-150.50,10%,-5,752.50
2024-01-02,SKU-002,"$1,250.00",5.5%,15,18750.00
2024-01-03,SKU-003,€450.00,0%,8,3600.00
2024-01-04,SKU-004,999999999.99,50%,1,500000000.00
2024-01-05,SKU-005,NaN,None,12,NaN
2024-01-06,SKU-006,200.0,15%,#N/A,3000.00
2024-01-07,SKU-007,0.0,0%,0,0.0
2024-01-08,SKU-008,125.75,2.5%,10,1257.50
'''
    file_obj = io.BytesIO(dirty_numeric_csv.encode("utf-8"))
    file_obj.name = "dirty_numerics.csv"

    response = client.post(
        "/api/v1/ingest/csv",
        files={"file": ("dirty_numerics.csv", file_obj, "text/csv")}
    )

    assert response.status_code in [200, 201], f"Dirty numeric ingestion failed: {response.text}"
    data = response.json()
    assert "dataset_id" in data
    assert data["row_count"] == 8


def test_dirty_dataset_edge_case_headers_and_injection():
    """Chaos test ingestion with dirty header strings, unicode, and SQL injection probes."""
    headers_csv = """Date (Transaction YYYY-MM-DD),Product Name # / SKU,Price ($/Unit),Units Sold [Qty],Total Revenue; DROP TABLE sales;--
2024-01-01,Industrial Robot Core,5400.00,2,10800.00
2024-01-02,AI Accelerator Blade,1250.00,10,12500.00
2024-01-03,Optical Quantum Coupler,3200.00,4,12800.00
2024-01-04,Edge Neural Gateway,850.00,15,12750.00
2024-01-05,Cryo Thermal Probe,4100.00,3,12300.00
"""
    file_obj = io.BytesIO(headers_csv.encode("utf-8"))
    file_obj.name = "dirty_headers.csv"

    response = client.post(
        "/api/v1/ingest/csv",
        files={"file": ("dirty_headers.csv", file_obj, "text/csv")}
    )

    assert response.status_code in [200, 201], f"Dirty headers ingestion failed: {response.text}"
    data = response.json()
    assert "table_name" in data
    cols = [col["name"] for col in data["columns"]]
    for col in cols:
        assert ";" not in col, f"Unsanitized column name: {col}"
        assert "--" not in col, f"SQL comment injection in column name: {col}"


def test_high_row_count_ingestion():
    """Stress test ingestion with complex_dataset.csv (5,000+ rows)."""
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "complex_dataset.csv")),
        r"C:\ML Project\complex_dataset.csv"
    ]
    csv_path = next((p for p in possible_paths if os.path.exists(p)), None)
    assert csv_path is not None, "complex_dataset.csv not found"

    with open(csv_path, "rb") as f:
        file_bytes = f.read()

    response = client.post(
        "/api/v1/ingest/csv",
        files={"file": ("complex_dataset.csv", io.BytesIO(file_bytes), "text/csv")}
    )

    assert response.status_code in [200, 201], f"High-volume ingestion failed: {response.text}"
    data = response.json()
    assert data["row_count"] >= 5000, f"Expected 5000+ rows, got {data['row_count']}"


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

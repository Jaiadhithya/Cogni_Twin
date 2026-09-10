import httpx
import asyncio
import os
import json

API_BASE = "http://127.0.0.1:8000/api/v1"
UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")

async def run_tests():
    report = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test 1: Upload bad_sales.csv
        bad_csv_path = os.path.join(UPLOADS_DIR, "bad_sales.csv")
        with open(bad_csv_path, "rb") as f:
            files = {"file": ("bad_sales.csv", f, "text/csv")}
            print("Executing Test 1: Upload bad_sales.csv...")
            resp = await client.post(f"{API_BASE}/upload/sales", files=files)
            report.append({
                "test": "POST /api/v1/upload/sales with bad_sales.csv",
                "expected": "HTTP 400 Validation Error (or 422)",
                "status_code": resp.status_code,
                "response": resp.json()
            })
            
        # Test 2: Upload good_sales.csv
        good_csv_path = os.path.join(UPLOADS_DIR, "good_sales.csv")
        with open(good_csv_path, "rb") as f:
            files = {"file": ("good_sales.csv", f, "text/csv")}
            print("Executing Test 2: Upload good_sales.csv...")
            resp = await client.post(f"{API_BASE}/upload/sales", files=files)
            report.append({
                "test": "POST /api/v1/upload/sales with good_sales.csv",
                "expected": "HTTP 200 or 201 Created",
                "status_code": resp.status_code,
                "response": resp.json()
            })
            
            if resp.status_code >= 400:
                print("Failed to upload good_sales.csv. Halting tests.")
                return report
                
        # Test 3: Drop the sales table
        await asyncio.sleep(15)
        print("Executing Test 3: Drop the sales table...")
        resp = await client.post(f"{API_BASE}/query", json={"question": "Drop the sales table"})
        report.append({
            "test": "POST /api/v1/query with {'question': 'Drop the sales table'}",
            "expected": "HTTP 422 Unsafe Query Blocked (or 400 Validation Error)",
            "status_code": resp.status_code,
            "response": resp.json()
        })
        
        # Test 4: What are my top 5 products?
        await asyncio.sleep(15)
        print("Executing Test 4: What are my top 5 products? (LLM Query)...")
        resp = await client.post(f"{API_BASE}/query", json={"question": "What are my top 5 products by total revenue?"})
        report.append({
            "test": "POST /api/v1/query with {'question': 'What are my top 5 products by total revenue?'}",
            "expected": "HTTP 200 Live LLM Response with SQL and formatting",
            "status_code": resp.status_code,
            "response": resp.json()
        })
        
        # Test 5: Forecast train
        print("Executing Test 5: Forecast train...")
        resp = await client.post(f"{API_BASE}/forecast/train", json={"granularity": "daily"})
        report.append({
            "test": "POST /api/v1/forecast/train with {'granularity': 'daily'}",
            "expected": "HTTP 200 or 202 Model Trained",
            "status_code": resp.status_code,
            "response": resp.json()
        })

    with open("test_report.json", "w") as f:
        json.dump(report, f, indent=2)
    print("Tests completed. Report saved to test_report.json")

if __name__ == "__main__":
    asyncio.run(run_tests())

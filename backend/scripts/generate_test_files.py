import os
import pandas as pd
from datetime import datetime, timedelta
import random
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch

# Ensure directory exists
ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'test_artifacts')
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

# 1. Generate PDF
def generate_pdf():
    pdf_path = os.path.join(ARTIFACTS_DIR, 'Supplier_Contract_Q4.pdf')
    c = canvas.Canvas(pdf_path, pagesize=letter)
    width, height = letter
    
    # Page 1
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1 * inch, height - 1 * inch, "Supplier Contract - Q4 2026")
    
    c.setFont("Helvetica", 12)
    c.drawString(1 * inch, height - 1.5 * inch, "This contract outlines the terms between CogniTwin and Alpha Hardware Supplies.")
    c.drawString(1 * inch, height - 2 * inch, "Hardware Inventory: Alpha Hardware agrees to supply 50,000 laptop units.")
    
    c.setFont("Helvetica-Bold", 14)
    c.drawString(1 * inch, height - 3 * inch, "Terms and Conditions")
    
    c.setFont("Helvetica", 12)
    c.drawString(1 * inch, height - 3.5 * inch, "1. Lead Times: All orders must be fulfilled within a standard 10-day window.")
    
    c.setFont("Helvetica-Oblique", 12)
    c.drawString(1 * inch, height - 4 * inch, "SLA Penalty Clause: If laptop component delivery exceeds a 15-day lead time, a 5% revenue penalty is applied. In Q4, global supplier shortages caused severe delays.")
    
    c.showPage()
    
    # Page 2
    c.setFont("Helvetica", 12)
    c.drawString(1 * inch, height - 1 * inch, "2. Payments: Payments are net 30 days.")
    c.drawString(1 * inch, height - 1.5 * inch, "3. Liability: Alpha Hardware is not liable for indirect damages.")
    
    c.save()
    print(f"Created: {pdf_path}")

# 2. Generate CSV
def generate_csv():
    csv_path = os.path.join(ARTIFACTS_DIR, 'laptop_sales_historical.csv')
    
    # Generate 365 days of data ending today
    end_date = datetime.now()
    start_date = end_date - timedelta(days=364)
    
    dates = [start_date + timedelta(days=i) for i in range(365)]
    
    data = []
    for d in dates:
        # Base volume
        base_volume = random.randint(100, 150)
        
        # 40% drop in October, November, December
        if d.month in [10, 11, 12]:
            volume = int(base_volume * 0.6)
        else:
            volume = base_volume
            
        revenue = volume * 1200.50 # Assume $1200.50 per laptop
        
        data.append({
            'sale_date': d.strftime("%Y-%m-%d"),
            'product_name': 'Laptop',
            'quantity': volume,
            'unit_price': 1200.50,
            'total_amount': round(revenue, 2)
        })
        
    df = pd.DataFrame(data)
    df.to_csv(csv_path, index=False)
    print(f"Created: {csv_path}")

if __name__ == "__main__":
    generate_pdf()
    generate_csv()

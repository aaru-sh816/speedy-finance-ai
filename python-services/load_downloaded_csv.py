
import os
import csv
from bulk_deals_database import BulkDealsDatabase

def load_downloaded_csv():
    # Path to the downloaded CSV
    csv_path = r"D:/SPEEDY FINANCE/CascadeProjects/windsurf-project/speedy-finance-ai/python-services/Bulk_19Dec_to_28Dec2025.csv"
    
    if not os.path.exists(csv_path):
        print(f"CSV file not found: {csv_path}")
        return
    
    db = BulkDealsDatabase()
    print(f"Loading deals from {os.path.basename(csv_path)}")
    
    deals = []
    with open(csv_path, 'r', encoding='utf-8', errors='ignore') as f:
        # Skip potential headers or empty lines at the beginning
        lines = f.readlines()
        header_index = -1
        for i, line in enumerate(lines):
            if 'Deal Date' in line and 'Security Code' in line:
                header_index = i
                break
        
        if header_index == -1:
            print("Could not find header row in CSV")
            return

        # Re-read from header row
        f.seek(0)
        for _ in range(header_index):
            f.readline()
            
        reader = csv.DictReader(f)
        for row in reader:
            try:
                # Normalize CSV columns to standard format
                deal_type = row.get('Deal Type', '').strip().upper()
                side = 'BUY' if deal_type in ['BUY', 'B', 'P', 'P '] else 'SELL'
                
                # Check for empty rows
                if not row.get('Deal Date') or not row.get('Security Code'):
                    continue

                deal = {
                    'date': row.get('Deal Date', '').strip(),
                    'scripCode': row.get('Security Code', '').strip(),
                    'securityName': row.get('Company', '').strip(),
                    'clientName': row.get('Client Name', '').strip(),
                    'side': side,
                    'quantity': BulkDealsDatabase._parse_number(row.get('Quantity', 0)),
                    'price': BulkDealsDatabase._parse_float(row.get('Price', 0)),
                    'type': 'bulk',
                    'exchange': 'BSE',
                    'remarks': row.get('Remarks', '').strip(),
                }
                deals.append(deal)
            except Exception as e:
                print(f"Error parsing row: {e}")
                continue
    
    print(f"Found {len(deals)} deals in CSV. Adding to database...")
    added = db.add_deals(deals)
    print(f"Successfully added {added} new deals.")
    print(f"New total deals: {db.metadata['total_deals']}")
    print(f"New date range: {db.metadata['date_range']['start']} to {db.metadata['date_range']['end']}")

if __name__ == '__main__':
    load_downloaded_csv()

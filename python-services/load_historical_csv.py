"""
Load Historical Bulk Deals CSV Files into JSON Database
Processes ~190K bulk deals from 2012 to present
"""

import os
import json
import csv
from datetime import datetime
from typing import List, Dict

# Paths
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data', 'bulk-deals')
DATABASE_FILE = os.path.join(DATA_DIR, 'bulk_deals_database.json')
METADATA_FILE = os.path.join(DATA_DIR, 'database_metadata.json')

# CSV files to load (update paths as needed)
CSV_FILES = [
    r"d:\SPEEDY FINANCE\CascadeProjects\windsurf-project\Bulk_18Dec2025 (3).csv",  # 2012-2017
    r"d:\SPEEDY FINANCE\CascadeProjects\windsurf-project\Bulk_18Dec2025 (4).csv",  # 2017-2022
    r"d:\SPEEDY FINANCE\CascadeProjects\windsurf-project\Bulk_18Dec2025 (5).csv",  # 2022-present
]

def parse_date(date_str: str) -> str:
    """Convert DD/MM/YYYY to YYYY-MM-DD format"""
    try:
        if '/' in date_str:
            parts = date_str.split('/')
            if len(parts) == 3:
                day, month, year = parts
                return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        return date_str
    except:
        return date_str

def parse_number(value: str) -> int:
    """Parse number from string"""
    try:
        return int(str(value).replace(',', '').replace(' ', ''))
    except:
        return 0

def parse_float(value: str) -> float:
    """Parse float from string"""
    try:
        return float(str(value).replace(',', '').replace(' ', ''))
    except:
        return 0.0

def load_csv_file(csv_path: str) -> List[Dict]:
    """Load deals from a single CSV file"""
    deals = []
    
    if not os.path.exists(csv_path):
        print(f"❌ File not found: {csv_path}")
        return deals
    
    print(f"📖 Loading: {os.path.basename(csv_path)}")
    
    with open(csv_path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                # Map CSV columns to standard format
                deal_type = row.get('Deal Type', '').upper()
                side = 'BUY' if deal_type in ['P', 'BUY', 'B'] else 'SELL'
                
                deal = {
                    'date': parse_date(row.get('Deal Date', '')),
                    'scripCode': row.get('Security Code', ''),
                    'securityName': row.get('Company', ''),
                    'clientName': row.get('Client Name', ''),
                    'side': side,
                    'quantity': parse_number(row.get('Quantity', 0)),
                    'price': parse_float(row.get('Price', 0)),
                    'type': 'bulk',
                    'exchange': 'BSE',
                }
                deals.append(deal)
            except Exception as e:
                continue
    
    print(f"   ✅ Loaded {len(deals):,} deals")
    return deals

def main():
    """Load all CSV files and create JSON database"""
    print("🚀 Loading Historical Bulk Deals Database")
    print("=" * 50)
    
    # Create data directory
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # Load all CSV files
    all_deals = []
    for csv_file in CSV_FILES:
        deals = load_csv_file(csv_file)
        all_deals.extend(deals)
    
    print(f"\n📊 Total deals loaded: {len(all_deals):,}")
    
    # Deduplicate by unique key
    print("🔄 Deduplicating deals...")
    deals_map = {}
    for deal in all_deals:
        key = f"{deal['date']}|{deal['scripCode']}|{deal['clientName']}|{deal['side']}"
        deals_map[key] = deal
    
    unique_deals = list(deals_map.values())
    print(f"   ✅ Unique deals: {len(unique_deals):,}")
    
    # Sort by date (newest first)
    unique_deals.sort(key=lambda x: x['date'], reverse=True)
    
    # Create database structure
    database = {
        "deals": unique_deals,
        "by_date": {}
    }
    
    # Index by date
    for i, deal in enumerate(unique_deals):
        date_key = deal['date']
        if date_key not in database['by_date']:
            database['by_date'][date_key] = []
        database['by_date'][date_key].append(i)
    
    # Calculate metadata
    dates = [d['date'] for d in unique_deals if d.get('date')]
    nse_count = sum(1 for d in unique_deals if d.get('exchange') == 'NSE')
    bse_count = sum(1 for d in unique_deals if d.get('exchange') == 'BSE')
    
    metadata = {
        "last_updated": datetime.now().isoformat(),
        "total_deals": len(unique_deals),
        "date_range": {
            "start": min(dates) if dates else None,
            "end": max(dates) if dates else None
        },
        "exchanges": {"NSE": nse_count, "BSE": bse_count},
        "unique_dates": len(database['by_date']),
        "source_files": [os.path.basename(f) for f in CSV_FILES]
    }
    
    # Save database
    print(f"\n💾 Saving database to: {DATABASE_FILE}")
    with open(DATABASE_FILE, 'w', encoding='utf-8') as f:
        json.dump(database, f, indent=None)  # No indent for smaller file size
    
    # Save metadata
    with open(METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    
    # Get file size
    file_size = os.path.getsize(DATABASE_FILE) / (1024 * 1024)
    
    print("\n" + "=" * 50)
    print("✅ Database created successfully!")
    print(f"   📁 File size: {file_size:.2f} MB")
    print(f"   📊 Total deals: {metadata['total_deals']:,}")
    print(f"   📅 Date range: {metadata['date_range']['start']} to {metadata['date_range']['end']}")
    print(f"   🗓️  Unique dates: {metadata['unique_dates']:,}")
    print(f"   🏢 NSE deals: {metadata['exchanges']['NSE']:,}")
    print(f"   🏢 BSE deals: {metadata['exchanges']['BSE']:,}")

if __name__ == '__main__':
    main()

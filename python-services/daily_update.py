"""
Daily Bulk Deals Database Updater
Run this script daily at 6:02 PM IST to fetch latest deals
Can be scheduled via Windows Task Scheduler or cron
"""

import os
import json
import requests
from datetime import datetime, timedelta
from typing import List, Dict

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data', 'bulk-deals')
DATABASE_FILE = os.path.join(DATA_DIR, 'bulk_deals_database.json')
METADATA_FILE = os.path.join(DATA_DIR, 'database_metadata.json')

def parse_number(value) -> int:
    try:
        return int(str(value).replace(',', '').replace(' ', ''))
    except:
        return 0

def parse_float(value) -> float:
    try:
        return float(str(value).replace(',', '').replace(' ', ''))
    except:
        return 0.0

def fetch_nse_bulk_deals() -> List[Dict]:
    """Fetch today's bulk deals from NSE"""
    try:
        session = requests.Session()
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
        }
        
        # Get cookies first
        session.get('https://www.nseindia.com/', headers=headers, timeout=10)
        
        # Fetch bulk deals
        response = session.get(
            'https://www.nseindia.com/api/snapshot-capital-market-largedeal',
            headers={**headers, 'Referer': 'https://www.nseindia.com/market-data/bulk-deal'},
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            deals = []
            
            for deal in data.get('BULK_DEALS_DATA', []):
                side = (deal.get('buySell') or '').upper()
                deals.append({
                    'date': deal.get('date', ''),
                    'scripCode': deal.get('symbol', ''),
                    'securityName': deal.get('name', ''),
                    'clientName': deal.get('clientName', ''),
                    'side': 'BUY' if side in ['BUY', 'B'] else 'SELL',
                    'quantity': parse_number(deal.get('qty', 0)),
                    'price': parse_float(deal.get('watp', 0)),
                    'type': 'bulk',
                    'exchange': 'NSE',
                })
            
            for deal in data.get('BLOCK_DEALS_DATA', []):
                side = (deal.get('buySell') or '').upper()
                deals.append({
                    'date': deal.get('date', ''),
                    'scripCode': deal.get('symbol', ''),
                    'securityName': deal.get('name', ''),
                    'clientName': deal.get('clientName', ''),
                    'side': 'BUY' if side in ['BUY', 'B'] else 'SELL',
                    'quantity': parse_number(deal.get('qty', 0)),
                    'price': parse_float(deal.get('watp', 0)),
                    'type': 'block',
                    'exchange': 'NSE',
                })
            
            return deals
        return []
    except Exception as e:
        print(f"❌ Error fetching NSE deals: {e}")
        return []

def load_database() -> Dict:
    """Load existing database"""
    if os.path.exists(DATABASE_FILE):
        try:
            with open(DATABASE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {"deals": [], "by_date": {}}

def save_database(database: Dict, added_count: int):
    """Save database and update metadata"""
    # Save database
    with open(DATABASE_FILE, 'w', encoding='utf-8') as f:
        json.dump(database, f)
    
    # Update metadata
    deals = database['deals']
    dates = [d['date'] for d in deals if d.get('date')]
    nse_count = sum(1 for d in deals if d.get('exchange') == 'NSE')
    bse_count = sum(1 for d in deals if d.get('exchange') == 'BSE')
    
    metadata = {
        "last_updated": datetime.now().isoformat(),
        "total_deals": len(deals),
        "date_range": {
            "start": min(dates) if dates else None,
            "end": max(dates) if dates else None
        },
        "exchanges": {"NSE": nse_count, "BSE": bse_count},
        "unique_dates": len(database['by_date']),
        "last_update_added": added_count
    }
    
    with open(METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    
    return metadata

def update_database():
    """Main update function"""
    print(f"\n{'='*50}")
    print(f"🕕 Daily Update - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*50}")
    
    # Load existing database
    database = load_database()
    existing_count = len(database['deals'])
    print(f"📊 Existing deals: {existing_count:,}")
    
    # Fetch new deals from NSE
    print("📥 Fetching from NSE...")
    nse_deals = fetch_nse_bulk_deals()
    print(f"   Found {len(nse_deals)} deals from NSE")
    
    # Create set of existing keys for deduplication
    existing_keys = set(
        f"{d['date']}|{d['scripCode']}|{d['clientName']}|{d['side']}|{d['exchange']}"
        for d in database['deals']
    )
    
    # Add new deals
    added = 0
    for deal in nse_deals:
        key = f"{deal['date']}|{deal['scripCode']}|{deal['clientName']}|{deal['side']}|{deal['exchange']}"
        if key not in existing_keys:
            database['deals'].append(deal)
            
            # Index by date
            date_key = deal['date']
            if date_key not in database['by_date']:
                database['by_date'][date_key] = []
            database['by_date'][date_key].append(len(database['deals']) - 1)
            
            existing_keys.add(key)
            added += 1
    
    if added > 0:
        print(f"✅ Added {added} new deals")
        metadata = save_database(database, added)
        print(f"💾 Saved! Total: {metadata['total_deals']:,} deals")
        print(f"📅 Range: {metadata['date_range']['start']} to {metadata['date_range']['end']}")
    else:
        print("ℹ️  No new deals to add")
    
    print(f"{'='*50}\n")
    return added

if __name__ == '__main__':
    update_database()

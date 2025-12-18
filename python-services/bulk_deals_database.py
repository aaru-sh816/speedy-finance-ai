"""
Bulk Deals Historical Database Manager
Downloads and maintains 2 years of historical bulk deals data
Scheduled to update daily at 6:02 PM IST
"""

import os
import json
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import time
import schedule
import threading
import re

# Database file path
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data', 'bulk-deals')
DATABASE_FILE = os.path.join(DATA_DIR, 'bulk_deals_database.json')
METADATA_FILE = os.path.join(DATA_DIR, 'database_metadata.json')

class BulkDealsDatabase:
    """Manages historical bulk deals database"""
    
    def __init__(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        self.database = self._load_database()
        self.metadata = self._load_metadata()
        self._normalize_existing_records()

    def _normalize_existing_records(self):
        deals = self.database.get('deals', [])
        if not deals:
            return

        changed = False
        by_date: Dict[str, List[int]] = {}
        for i, d in enumerate(deals):
            date_norm = self._normalize_date(d.get('date') or d.get('deal_date') or '')
            if date_norm and d.get('date') != date_norm:
                d['date'] = date_norm
                changed = True

            ex = str(d.get('exchange', '')).upper() or d.get('exchange', '')
            if ex and d.get('exchange') != ex:
                d['exchange'] = ex
                changed = True

            side = str(d.get('side', '')).upper() or d.get('side', '')
            if side and d.get('side') != side:
                d['side'] = side
                changed = True

            k = d.get('date') or ''
            if k:
                by_date.setdefault(k, []).append(i)

        if changed:
            self.database['by_date'] = by_date
            self._update_metadata()
            self._save_database()
    
    def _load_database(self) -> Dict[str, Any]:
        """Load existing database or create empty one"""
        if os.path.exists(DATABASE_FILE):
            try:
                with open(DATABASE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return {"deals": [], "by_date": {}}

    @staticmethod
    def _normalize_date(date_value: Any) -> str:
        s = str(date_value or "").strip()
        if not s:
            return ""

        if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
            return s

        # Try common formats seen in NSE/BSE files
        for fmt in (
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%d-%b-%Y",
            "%d-%B-%Y",
            "%Y/%m/%d",
            "%Y-%m-%d",
        ):
            try:
                return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
            except Exception:
                pass

        # Fallback: handle D/M/YYYY variants
        m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", s)
        if m:
            dd, mm, yyyy = m.group(1), m.group(2), m.group(3)
            try:
                return datetime(int(yyyy), int(mm), int(dd)).strftime("%Y-%m-%d")
            except Exception:
                return s

        return s
    
    def _load_metadata(self) -> Dict:
        """Load metadata about database"""
        if os.path.exists(METADATA_FILE):
            try:
                with open(METADATA_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return {
            "last_updated": None,
            "total_deals": 0,
            "date_range": {"start": None, "end": None},
            "exchanges": {"NSE": 0, "BSE": 0}
        }
    
    def _save_database(self):
        """Save database to file"""
        with open(DATABASE_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.database, f, indent=2, default=str)
        
        with open(METADATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.metadata, f, indent=2, default=str)
    
    def fetch_nse_bulk_deals(self) -> List[Dict]:
        """Fetch recent bulk deals from NSE"""
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
                
                # Process bulk deals
                for deal in data.get('BULK_DEALS_DATA', []):
                    deals.append(self._normalize_nse_deal(deal, 'bulk'))
                
                # Process block deals
                for deal in data.get('BLOCK_DEALS_DATA', []):
                    deals.append(self._normalize_nse_deal(deal, 'block'))
                
                return deals
            
            return []
        except Exception as e:
            print(f"Error fetching NSE deals: {e}")
            return []
    
    def _normalize_nse_deal(self, deal: Dict, deal_type: str) -> Dict:
        """Normalize NSE deal to standard format"""
        side = (deal.get('buySell') or '').upper()
        return {
            'date': self._normalize_date(deal.get('date', '')),
            'scripCode': deal.get('symbol', ''),
            'securityName': deal.get('name', ''),
            'clientName': deal.get('clientName', ''),
            'side': 'BUY' if side in ['BUY', 'B'] else 'SELL',
            'quantity': self._parse_number(deal.get('qty', 0)),
            'price': self._parse_float(deal.get('watp', 0)),
            'type': deal_type,
            'exchange': 'NSE',
            'remarks': deal.get('remarks', ''),
        }
    
    def add_deals(self, deals: List[Dict]):
        """Add deals to database, avoiding duplicates"""
        added = 0
        existing_keys = set(
            f"{self._normalize_date(d.get('date'))}|{d.get('scripCode','')}|{d.get('clientName','')}|{d.get('side','')}|{d.get('exchange','')}"
            for d in self.database.get('deals', [])
        )

        for deal in deals:
            date_norm = self._normalize_date(deal.get('date'))
            deal['date'] = date_norm
            deal['exchange'] = str(deal.get('exchange', '')).upper() or deal.get('exchange', '')
            deal['side'] = str(deal.get('side', '')).upper() or deal.get('side', '')

            key = f"{date_norm}|{deal.get('scripCode','')}|{deal.get('clientName','')}|{deal.get('side','')}|{deal.get('exchange','')}"
            if key in existing_keys:
                continue

            self.database['deals'].append(deal)
            existing_keys.add(key)

            date_key = date_norm
            if date_key not in self.database['by_date']:
                self.database['by_date'][date_key] = []
            self.database['by_date'][date_key].append(len(self.database['deals']) - 1)

            added += 1
        
        if added > 0:
            self._update_metadata()
            self._save_database()
            print(f"✅ Added {added} new deals to database")
        
        return added
    
    def _update_metadata(self):
        """Update database metadata"""
        deals = self.database['deals']
        if not deals:
            return

        dates = [self._normalize_date(d.get('date')) for d in deals if d.get('date')]
        dates = [d for d in dates if d]
        nse_count = sum(1 for d in deals if d.get('exchange') == 'NSE')
        bse_count = sum(1 for d in deals if d.get('exchange') == 'BSE')
        
        self.metadata = {
            "last_updated": datetime.now().isoformat(),
            "total_deals": len(deals),
            "date_range": {
                "start": min(dates) if dates else None,
                "end": max(dates) if dates else None
            },
            "exchanges": {"NSE": nse_count, "BSE": bse_count},
            "unique_dates": len(self.database['by_date'])
        }
    
    def get_deals_by_date_range(self, start_date: str, end_date: str) -> List[Dict]:
        """Get deals within a date range"""
        start_norm = self._normalize_date(start_date)
        end_norm = self._normalize_date(end_date)
        result = []
        for deal in self.database['deals']:
            deal_date = self._normalize_date(deal.get('date', ''))
            if start_norm <= deal_date <= end_norm:
                result.append(deal)
        return result
    
    def get_all_deals(self) -> List[Dict]:
        """Get all deals"""
        return self.database['deals']
    
    def update_daily(self):
        """Daily update task - fetches latest deals"""
        print(f"\n🔄 Running daily update at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        try:
            # Fetch from NSE
            nse_deals = self.fetch_nse_bulk_deals()
            print(f"📥 Fetched {len(nse_deals)} deals from NSE")
            
            # Add to database
            added = self.add_deals(nse_deals)
            
            print(f"📊 Database now has {self.metadata['total_deals']} total deals")
            print(f"📅 Date range: {self.metadata['date_range']['start']} to {self.metadata['date_range']['end']}")
            
            return added
        except Exception as e:
            print(f"❌ Error during daily update: {e}")
            return 0
    
    @staticmethod
    def _parse_number(value) -> int:
        try:
            return int(str(value).replace(',', '').replace(' ', ''))
        except:
            return 0
    
    @staticmethod
    def _parse_float(value) -> float:
        try:
            return float(str(value).replace(',', '').replace(' ', ''))
        except:
            return 0.0


def load_historical_csv(csv_path: str, db: BulkDealsDatabase):
    """Load historical bulk deals from CSV file"""
    import csv
    
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        return 0
    
    deals = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Normalize CSV columns to standard format
            deal = {
                'date': row.get('Deal Date', row.get('date', row.get('DATE', ''))),
                'scripCode': row.get('Security Code', row.get('Symbol', row.get('SYMBOL', ''))),
                'securityName': row.get('Company', row.get('Security Name', row.get('SECURITY', ''))),
                'clientName': row.get('Client Name', row.get('CLIENT_NAME', '')),
                'side': 'BUY' if row.get('Deal Type', row.get('BUY/SELL', '')).upper() in ['BUY', 'B', 'P'] else 'SELL',
                'quantity': BulkDealsDatabase._parse_number(row.get('Quantity', row.get('QTY', 0))),
                'price': BulkDealsDatabase._parse_float(row.get('Price', row.get('PRICE', 0))),
                'type': 'bulk',
                'exchange': row.get('Exchange', 'BSE'),
                'remarks': row.get('Remarks', ''),
            }
            deals.append(deal)
    
    added = db.add_deals(deals)
    print(f"📥 Loaded {added} deals from CSV")
    return added


def run_scheduler():
    """Run the scheduler in background"""
    while True:
        schedule.run_pending()
        time.sleep(60)


def start_daily_scheduler(db: BulkDealsDatabase):
    """Start the daily scheduler at 6:02 PM IST"""
    # Schedule daily update at 6:02 PM
    schedule.every().day.at("18:02").do(db.update_daily)
    
    # Run scheduler in background thread
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    
    print("⏰ Daily scheduler started - will update at 6:02 PM IST daily")


def initialize_database():
    """Initialize database with historical data and start scheduler"""
    db = BulkDealsDatabase()
    
    print("🚀 Initializing Bulk Deals Database")
    print(f"📁 Database location: {DATABASE_FILE}")
    
    # Check if we need to load initial data
    if db.metadata['total_deals'] == 0:
        print("📭 Database is empty, fetching initial data...")
        
        # Try to load from CSV if exists
        csv_files = [
            os.path.join(DATA_DIR, 'historical_bulk_deals.csv'),
            os.path.join(DATA_DIR, 'bulk_deals_history.csv'),
        ]
        
        for csv_file in csv_files:
            if os.path.exists(csv_file):
                load_historical_csv(csv_file, db)
                break
        
        # Fetch current data from NSE
        db.update_daily()
    else:
        print(f"📊 Database has {db.metadata['total_deals']} deals")
        print(f"📅 Date range: {db.metadata['date_range']['start']} to {db.metadata['date_range']['end']}")
    
    # Start daily scheduler
    start_daily_scheduler(db)
    
    return db


# Flask API endpoints for the database
def create_database_api(app, db: BulkDealsDatabase):
    """Add database API endpoints to Flask app"""
    from flask import jsonify, request
    
    @app.route('/api/bulk-deals/database', methods=['GET'])
    def get_database_deals():
        """Get deals from database with optional date filtering"""
        start_date = request.args.get('start')
        end_date = request.args.get('end')
        
        if start_date and end_date:
            deals = db.get_deals_by_date_range(start_date, end_date)
        else:
            deals = db.get_all_deals()
        
        return jsonify({
            'success': True,
            'count': len(deals),
            'data': deals,
            'metadata': db.metadata
        })
    
    @app.route('/api/bulk-deals/database/metadata', methods=['GET'])
    def get_database_metadata():
        """Get database metadata"""
        return jsonify({
            'success': True,
            'metadata': db.metadata
        })
    
    @app.route('/api/bulk-deals/database/update', methods=['POST'])
    def trigger_update():
        """Manually trigger database update"""
        added = db.update_daily()
        return jsonify({
            'success': True,
            'added': added,
            'metadata': db.metadata
        })
    
    # Lock to prevent concurrent scraping
    _scraping_lock = {'active': False, 'last_fetch': None}
    
    @app.route('/api/bulk-deals/database/fetch-today', methods=['POST'])
    def fetch_today_deals():
        """Smart fetch for today's deals - checks if needed, fetches BSE via CSV download ONCE"""
        from datetime import datetime
        today = datetime.now().strftime('%Y-%m-%d')
        now = datetime.now()
        
        # Check if we already have today's data
        existing = db.get_deals_by_date_range(today, today)
        bse_existing = [d for d in existing if d.get('exchange') == 'BSE']
        
        if len(bse_existing) > 0:
            return jsonify({
                'success': True,
                'message': f'Today\'s BSE data already exists ({len(bse_existing)} deals)',
                'count': len(bse_existing),
                'fetched': False
            })
        
        # Prevent concurrent scraping - check if already scraping
        if _scraping_lock['active']:
            return jsonify({
                'success': True,
                'message': 'Scraping already in progress, please wait...',
                'count': 0,
                'fetched': False,
                'in_progress': True
            })
        
        # Prevent repeated scraping within 5 minutes
        if _scraping_lock['last_fetch']:
            time_since = (now - _scraping_lock['last_fetch']).total_seconds()
            if time_since < 300:  # 5 minutes
                return jsonify({
                    'success': True,
                    'message': f'Recently fetched {int(time_since)}s ago, check database',
                    'count': 0,
                    'fetched': False
                })
        
        # Set lock and fetch
        _scraping_lock['active'] = True
        _scraping_lock['last_fetch'] = now
        
        try:
            from bulk_deals_scraper import BulkDealsScraper
            scraper = BulkDealsScraper()
            
            # Only fetch today - yesterday should already be in database from 6:02 PM update
            total_added = 0
            try:
                print(f"🔄 Fetching BSE bulk deals for {today}...")
                deals = scraper.scrape_bse_bulk_deals(today)
                if deals:
                    # Normalize deals format
                    normalized = []
                    for d in deals:
                        normalized.append({
                            'date': d.get('date', d.get('deal_date', today)),
                            'scripCode': d.get('scrip_code', d.get('scripCode', '')),
                            'securityName': d.get('security_name', d.get('securityName', '')),
                            'clientName': d.get('client_name', d.get('clientName', '')),
                            'side': 'BUY' if str(d.get('deal_type', d.get('type', ''))).upper() in ['BUY', 'B', 'P'] else 'SELL',
                            'quantity': d.get('quantity', 0),
                            'price': d.get('trade_price', d.get('price', 0)),
                            'type': 'bulk',
                            'exchange': 'BSE'
                        })
                    total_added = db.add_deals(normalized)
                    print(f"✅ Added {total_added} BSE deals for {today}")
            except Exception as e:
                print(f"⚠️ Failed to fetch BSE deals for {today}: {e}")
            
            return jsonify({
                'success': True,
                'message': f'Added {total_added} BSE deals for today',
                'added': total_added,
                'fetched': True,
                'metadata': db.metadata
            })
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e),
                'message': 'Failed to fetch today\'s BSE deals'
            }), 500
        finally:
            _scraping_lock['active'] = False


if __name__ == '__main__':
    # Initialize and test
    db = initialize_database()
    
    print("\n📊 Database Summary:")
    print(f"   Total deals: {db.metadata['total_deals']}")
    print(f"   Date range: {db.metadata['date_range']}")
    print(f"   Exchanges: {db.metadata['exchanges']}")
    
    # Keep running for scheduler
    print("\n⏳ Running scheduler (Ctrl+C to stop)...")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n👋 Shutting down...")

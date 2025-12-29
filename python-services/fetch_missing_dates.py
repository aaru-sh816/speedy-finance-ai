"""
Fetch missing bulk deals data for specific date ranges from BSE
Uses Selenium to download CSV from BSE website
"""

import os
import sys
import csv
import json
import tempfile
import shutil
import time
from datetime import datetime, timedelta

def fetch_bse_bulk_deals_range(start_date: str, end_date: str, output_dir: str = None):
    """
    Fetch BSE bulk deals for a date range and save to CSV
    
    Args:
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        output_dir: Directory to save CSV (defaults to bulk_deals_downloads)
    """
    try:
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.webdriver.chrome.service import Service
        from selenium.webdriver.chrome.options import Options
        from webdriver_manager.chrome import ChromeDriverManager
    except ImportError:
        print("Selenium not installed. Run: pip install selenium webdriver-manager")
        return None
    
    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(__file__), 'bulk_deals_downloads')
    os.makedirs(output_dir, exist_ok=True)
    
    start_obj = datetime.strptime(start_date, '%Y-%m-%d')
    end_obj = datetime.strptime(end_date, '%Y-%m-%d')
    start_bse = start_obj.strftime('%d/%m/%Y')
    end_bse = end_obj.strftime('%d/%m/%Y')
    
    print(f"[*] Fetching BSE bulk deals from {start_date} to {end_date}...")
    
    chrome_options = Options()
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1200,800')
    
    # Use a fixed download directory that's easy to access
    download_dir = os.path.join(os.path.dirname(__file__), 'bulk_deals_downloads')
    os.makedirs(download_dir, exist_ok=True)
    temp_dir = download_dir
    prefs = {
        'download.default_directory': temp_dir,
        'download.prompt_for_download': False,
        'download.directory_upgrade': True,
        'safebrowsing.enabled': True
    }
    chrome_options.add_experimental_option('prefs', prefs)
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    try:
        url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"
        driver.get(url)
        
        wait = WebDriverWait(driver, 30)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".hasDatepicker")))
        time.sleep(3)
        
        # Set FROM date using jQuery datepicker
        print(f"  Setting FROM date: {start_bse}")
        driver.execute_script(f"""
            var fromDateField = document.getElementById('ContentPlaceHolder1_txtFromDt');
            if (fromDateField) {{
                $(fromDateField).datepicker('setDate', '{start_bse}');
                fromDateField.value = '{start_bse}';
            }}
        """)
        time.sleep(1)
        
        # Set TO date
        print(f"  Setting TO date: {end_bse}")
        driver.execute_script(f"""
            var toDateField = document.getElementById('ContentPlaceHolder1_txtToDt');
            if (toDateField) {{
                $(toDateField).datepicker('setDate', '{end_bse}');
                toDateField.value = '{end_bse}';
            }}
        """)
        time.sleep(1)
        
        # Submit form
        print("  Submitting form...")
        driver.execute_script("document.getElementById('ContentPlaceHolder1_btnSubmit').click();")
        
        # Wait for results
        time.sleep(8)
        
        # Check if results loaded
        try:
            body_text = driver.find_element(By.TAG_NAME, "body").text
            if 'Period' in body_text or 'Records' in body_text:
                print("  [OK] Results loaded")
        except:
            pass
        
        # Click download button
        print("  Downloading CSV...")
        try:
            download_btn = driver.find_element(By.ID, "ContentPlaceHolder1_btnDownload")
            download_btn.click()
            time.sleep(8)  # Wait for download
        except Exception as e:
            print(f"  [ERROR] Download button not found: {e}")
            driver.quit()
            return None
        
        # Find downloaded CSV
        csv_files = [f for f in os.listdir(temp_dir) if f.endswith('.csv')]
        
        if csv_files:
            src_path = os.path.join(temp_dir, csv_files[0])
            dest_filename = f"Bulk_{start_date}_to_{end_date}.csv"
            dest_path = os.path.join(output_dir, dest_filename)
            
            shutil.copy(src_path, dest_path)
            print(f"  [OK] Saved to: {dest_path}")
            
            # Count records
            with open(dest_path, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                count = sum(1 for _ in reader) - 1  # Minus header
            print(f"  [INFO] Total records: {count}")
            
            shutil.rmtree(temp_dir, ignore_errors=True)
            return dest_path
        else:
            print("  [ERROR] No CSV file downloaded")
            return None
            
    finally:
        driver.quit()


def load_csv_to_database(csv_path: str, database_path: str = None):
    """
    Load a CSV file into the bulk deals database
    
    Args:
        csv_path: Path to CSV file
        database_path: Path to database JSON (defaults to standard location)
    """
    if database_path is None:
        database_path = os.path.join(os.path.dirname(__file__), 'data', 'bulk-deals', 'bulk_deals_database.json')
    
    if not os.path.exists(csv_path):
        print(f"[ERROR] CSV file not found: {csv_path}")
        return 0
    
    # Load existing database
    if os.path.exists(database_path):
        with open(database_path, 'r', encoding='utf-8') as f:
            database = json.load(f)
    else:
        database = {'deals': [], 'by_date': {}}
    
    # Create set of existing deal keys for deduplication
    existing_keys = set()
    for deal in database.get('deals', []):
        key = f"{deal.get('date')}|{deal.get('scripCode')}|{deal.get('clientName')}|{deal.get('side')}|{deal.get('exchange')}"
        existing_keys.add(key)
    
    # Parse CSV
    added = 0
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Parse deal date
            deal_date = row.get('Deal Date', '').strip()
            if '/' in deal_date:
                try:
                    parts = deal_date.split('/')
                    deal_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                except:
                    pass
            
            deal_type = row.get('Deal Type', '').strip().upper()
            side = 'BUY' if deal_type in ['BUY', 'B', 'P'] else 'SELL'
            
            deal = {
                'date': deal_date,
                'scripCode': row.get('Security Code', '').strip(),
                'securityName': row.get('Company', '').strip(),
                'clientName': row.get('Client Name', '').strip(),
                'side': side,
                'quantity': parse_number(row.get('Quantity', '0')),
                'price': parse_float(row.get('Price', '0')),
                'type': 'bulk',
                'exchange': 'BSE'
            }
            
            # Check for duplicates
            key = f"{deal['date']}|{deal['scripCode']}|{deal['clientName']}|{deal['side']}|{deal['exchange']}"
            if key in existing_keys:
                continue
            
            database['deals'].append(deal)
            existing_keys.add(key)
            
            # Update by_date index
            if deal_date not in database['by_date']:
                database['by_date'][deal_date] = []
            database['by_date'][deal_date].append(len(database['deals']) - 1)
            
            added += 1
    
    # Save database
    if added > 0:
        with open(database_path, 'w', encoding='utf-8') as f:
            json.dump(database, f, indent=2, default=str)
        
        # Update metadata
        update_metadata(database_path)
        print(f"[OK] Added {added} new deals to database")
    else:
        print("[INFO] No new deals to add (all already in database)")
    
    return added


def update_metadata(database_path: str):
    """Update metadata file after database changes"""
    metadata_path = database_path.replace('bulk_deals_database.json', 'database_metadata.json')
    
    with open(database_path, 'r', encoding='utf-8') as f:
        database = json.load(f)
    
    deals = database.get('deals', [])
    dates = [d.get('date') for d in deals if d.get('date')]
    
    metadata = {
        "last_updated": datetime.now().isoformat(),
        "total_deals": len(deals),
        "date_range": {
            "start": min(dates) if dates else None,
            "end": max(dates) if dates else None
        },
        "exchanges": {
            "NSE": sum(1 for d in deals if d.get('exchange') == 'NSE'),
            "BSE": sum(1 for d in deals if d.get('exchange') == 'BSE')
        },
        "unique_dates": len(database.get('by_date', {}))
    }
    
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, default=str)


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


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage:")
        print("  Fetch data:  python fetch_missing_dates.py fetch 2025-12-19 2025-12-28")
        print("  Load CSV:    python fetch_missing_dates.py load path/to/file.csv")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == 'fetch':
        if len(sys.argv) < 4:
            print("Usage: python fetch_missing_dates.py fetch START_DATE END_DATE")
            sys.exit(1)
        start_date = sys.argv[2]
        end_date = sys.argv[3]
        csv_path = fetch_bse_bulk_deals_range(start_date, end_date)
        if csv_path:
            print(f"\n[*] Loading into database...")
            load_csv_to_database(csv_path)
    
    elif command == 'load':
        if len(sys.argv) < 3:
            print("Usage: python fetch_missing_dates.py load CSV_PATH")
            sys.exit(1)
        csv_path = sys.argv[2]
        load_csv_to_database(csv_path)
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

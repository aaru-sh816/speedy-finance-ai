"""
Automatic Bulk Deals Scheduler
Downloads bulk deals CSV daily at 6:02 PM IST
"""

import schedule
import time
from datetime import datetime, timedelta
import logging
from bulk_deals_scraper import scrape_bulk_deals
import os
import json

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Data directory for storing bulk deals
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data', 'bulk-deals')
os.makedirs(DATA_DIR, exist_ok=True)

def download_bulk_deals():
    """Download and save today's bulk deals"""
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        logger.info(f"Starting bulk deals download for {today}")
        
        # Scrape bulk deals for today
        deals = scrape_bulk_deals(today)
        
        if not deals:
            logger.warning(f"No bulk deals found for {today}")
            return
        
        # Save to JSON file
        filename = os.path.join(DATA_DIR, f'bulk_deals_{today}.json')
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump({
                'date': today,
                'count': len(deals),
                'downloaded_at': datetime.now().isoformat(),
                'deals': deals
            }, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Successfully downloaded {len(deals)} bulk deals for {today}")
        logger.info(f"Saved to: {filename}")
        
        # Also update latest.json for quick access
        latest_file = os.path.join(DATA_DIR, 'latest.json')
        with open(latest_file, 'w', encoding='utf-8') as f:
            json.dump({
                'date': today,
                'count': len(deals),
                'downloaded_at': datetime.now().isoformat(),
                'deals': deals
            }, f, indent=2, ensure_ascii=False)
        
    except Exception as e:
        logger.error(f"❌ Error downloading bulk deals: {e}", exc_info=True)

def run_scheduler():
    """Run the scheduler"""
    logger.info("🚀 Bulk Deals Scheduler Started")
    logger.info("📅 Scheduled time: 6:02 PM IST daily")
    
    # Schedule the job for 6:02 PM every day
    schedule.every().day.at("18:02").do(download_bulk_deals)
    
    # Also run immediately on startup if today's data doesn't exist
    today = datetime.now().strftime('%Y-%m-%d')
    today_file = os.path.join(DATA_DIR, f'bulk_deals_{today}.json')
    if not os.path.exists(today_file):
        logger.info("Today's bulk deals not found, downloading now...")
        download_bulk_deals()
    else:
        logger.info(f"Today's bulk deals already downloaded: {today_file}")
    
    # Run the scheduler loop
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute

if __name__ == "__main__":
    run_scheduler()

"""Backfill historical bulk deals data.

This script downloads and caches bulk deals JSON files for a date range
so that the Speedy Finance UI can filter and sort locally without
re-running expensive scraping logic on every request.

Usage (from python-services directory):

    python bulk_deals_backfill.py --days 730

This will fetch combined BSE+NSE bulk deals for the last ~2 years and
store them under data/bulk-deals/bulk_deals_YYYY-MM-DD.json
"""

import argparse
import json
import logging
import os
import time
from datetime import datetime, timedelta

from bulk_deals_scraper import BulkDealsScraper

DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "bulk-deals")
os.makedirs(DATA_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def save_day(scraper: BulkDealsScraper, date_str: str, exchange: str = "both") -> None:
  """Download and cache bulk deals for a single date if not already cached."""
  file_path = os.path.join(DATA_DIR, f"bulk_deals_{date_str}.json")
  if os.path.exists(file_path):
    logger.info("Skipping %s (already cached)", date_str)
    return

  logger.info("Fetching bulk deals for %s (exchange=%s)", date_str, exchange)

  if exchange == "bse":
    deals = scraper.scrape_bse_bulk_deals(date_str)
  elif exchange == "nse":
    deals = scraper.scrape_nse_bulk_deals(date_str)
  else:
    deals = scraper.get_combined_bulk_deals(date_str)

  payload = {
    "date": date_str,
    "count": len(deals),
    "downloaded_at": datetime.now().isoformat(),
    "deals": deals,
  }

  with open(file_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

  logger.info("Saved %d deals for %s", len(deals), date_str)


def main() -> None:
  parser = argparse.ArgumentParser(description="Backfill historical bulk deals cache")
  parser.add_argument(
    "--days",
    type=int,
    default=730,
    help="Number of days to backfill (default: 730 ~ 2 years)",
  )
  parser.add_argument(
    "--end-date",
    type=str,
    default=datetime.now().strftime("%Y-%m-%d"),
    help="End date in YYYY-MM-DD (default: today)",
  )
  parser.add_argument(
    "--exchange",
    type=str,
    choices=["bse", "nse", "both"],
    default="both",
    help="Which exchange to backfill (default: both)",
  )
  parser.add_argument(
    "--delay",
    type=float,
    default=1.5,
    help="Delay in seconds between days to avoid overloading upstream sites",
  )

  args = parser.parse_args()

  try:
    end = datetime.strptime(args.end_date, "%Y-%m-%d")
  except ValueError:
    raise SystemExit("Invalid --end-date, expected YYYY-MM-DD")

  if args.days <= 0:
    raise SystemExit("--days must be positive")

  start = end - timedelta(days=args.days - 1)

  logger.info("Starting bulk deals backfill from %s to %s (%d days)", start.date(), end.date(), args.days)

  scraper = BulkDealsScraper()

  current = start
  while current <= end:
    date_str = current.strftime("%Y-%m-%d")
    try:
      save_day(scraper, date_str, args.exchange)
    except Exception as exc:  # noqa: BLE001
      logger.error("Error processing %s: %s", date_str, exc)
    time.sleep(max(args.delay, 0))
    current += timedelta(days=1)

  logger.info("Backfill complete")


if __name__ == "__main__":  # pragma: no cover
  main()

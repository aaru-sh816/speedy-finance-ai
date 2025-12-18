from bulk_deals_scraper import BulkDealsScraper
from datetime import datetime

scraper = BulkDealsScraper()

print("="*80)
print("Testing Bulk Deals for December 12, 2025")
print("="*80 + "\n")

deals_12 = scraper.scrape_bse_bulk_deals('2025-12-12')
print(f"✅ Found {len(deals_12)} bulk deals for 12/12/2025\n")

if deals_12:
    print("Top 10 deals on Dec 12:")
    print("-" * 80)
    for i, deal in enumerate(deals_12[:10], 1):
        print(f"{i}. {deal['security_name'][:25]:25} | {deal['client_name'][:30]:30} | {deal['deal_type']} | {deal['quantity']:>10,} @ ₹{deal['trade_price']:>8.2f}")
else:
    print("⚠️ No deals found for Dec 12")

print("\n" + "="*80)
print("Testing Bulk Deals for December 13, 2025")
print("="*80 + "\n")

deals_13 = scraper.scrape_bse_bulk_deals('2025-12-13')
print(f"✅ Found {len(deals_13)} bulk deals for 13/12/2025\n")

if deals_13:
    print("Top 10 deals on Dec 13:")
    print("-" * 80)
    for i, deal in enumerate(deals_13[:10], 1):
        print(f"{i}. {deal['security_name'][:25]:25} | {deal['client_name'][:30]:30} | {deal['deal_type']} | {deal['quantity']:>10,} @ ₹{deal['trade_price']:>8.2f}")
else:
    print("⚠️ No deals found for Dec 13")

print("\n" + "="*80)
print("Testing Bulk Deals for December 16, 2025 (known working date)")
print("="*80 + "\n")

deals_16 = scraper.scrape_bse_bulk_deals('2025-12-16')
print(f"✅ Found {len(deals_16)} bulk deals for 16/12/2025")

# Check actual dates in the returned data
if deals_16:
    unique_dates = set(deal['deal_date'] for deal in deals_16)
    print(f"Actual dates in response: {unique_dates}")

print("\n" + "="*80)
print("SUMMARY")
print("="*80)
print(f"Dec 12: {len(deals_12)} deals")
print(f"Dec 13: {len(deals_13)} deals")
print(f"Dec 16: {len(deals_16)} deals")
print("\nNote: All dates may return same data (latest trading day) if date filtering not working")

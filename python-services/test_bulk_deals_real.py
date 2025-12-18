from bulk_deals_scraper import BulkDealsScraper
from datetime import datetime

scraper = BulkDealsScraper()

# Test with the date from the screenshot: 16/12/2025
test_date = '2025-12-16'
print(f"Testing bulk deals for {test_date}...\n")

deals = scraper.scrape_bse_bulk_deals(test_date)

print(f"✅ Found {len(deals)} bulk deals\n")

if deals:
    print("Top 10 bulk deals:")
    print("-" * 100)
    for i, deal in enumerate(deals[:10], 1):
        print(f"{i}. {deal['security_name']}")
        print(f"   Client: {deal['client_name']}")
        print(f"   Type: {deal['deal_type']}")
        print(f"   Quantity: {deal['quantity']:,}")
        print(f"   Price: ₹{deal['trade_price']:.2f}")
        print(f"   Scrip Code: {deal['scrip_code']}")
        print()
else:
    print("⚠️ No deals found. This might be an issue with the scraper.")

from bulk_deals_scraper import BulkDealsScraper

scraper = BulkDealsScraper()

print("Testing bulk deals for 15/12/2025...\n")
deals = scraper.scrape_bse_bulk_deals('2025-12-15')

print(f"✅ Found {len(deals)} bulk deals\n")

if deals:
    print("Top 5 deals:")
    for i, deal in enumerate(deals[:5], 1):
        print(f"{i}. {deal['security_name']}")
        print(f"   Client: {deal['client_name']}")
        print(f"   Type: {deal['deal_type']}, Qty: {deal['quantity']:,}")
        print()
else:
    print("No deals found for this date.")

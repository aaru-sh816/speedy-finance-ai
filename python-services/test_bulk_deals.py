import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:5000"

def test_bulk_deals():
    print("🔍 Testing Bulk Deals Endpoints\n")
    
    # Test 1: Today's bulk deals
    today = datetime.now().strftime('%Y-%m-%d')
    print(f"1. Testing bulk deals for {today}...")
    response = requests.get(f"{BASE_URL}/api/bulk-deals?date={today}")
    result = response.json()
    print(f"   ✅ Status: {result['success']}, Count: {result['count']}")
    
    # Test 2: Yesterday's bulk deals
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    print(f"\n2. Testing bulk deals for {yesterday}...")
    response = requests.get(f"{BASE_URL}/api/bulk-deals?date={yesterday}")
    result = response.json()
    print(f"   ✅ Status: {result['success']}, Count: {result['count']}")
    
    if result['count'] > 0:
        print(f"\n   Sample bulk deal:")
        deal = result['data'][0]
        print(f"   Company: {deal['security_name']}")
        print(f"   Client: {deal['client_name']}")
        print(f"   Type: {deal['deal_type']}")
        print(f"   Quantity: {deal['quantity']:,}")
        print(f"   Price: ₹{deal['trade_price']:.2f}")
    
    # Test 3: Last week's data
    week_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    print(f"\n3. Testing bulk deals for {week_ago}...")
    response = requests.get(f"{BASE_URL}/api/bulk-deals?date={week_ago}")
    result = response.json()
    print(f"   ✅ Status: {result['success']}, Count: {result['count']}")
    
    # Test 4: Company-specific bulk deals (Reliance)
    print(f"\n4. Testing company bulk deals for RELIANCE (500325)...")
    response = requests.get(f"{BASE_URL}/api/bulk-deals/company/500325?days=30")
    result = response.json()
    print(f"   ✅ Status: {result['success']}, Count: {result['count']}")
    
    print(f"\n✅ All bulk deals tests completed!")

if __name__ == '__main__':
    test_bulk_deals()

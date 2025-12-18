import requests
from datetime import datetime
import json

date_str = '2025-12-16'
date_obj = datetime.strptime(date_str, '%Y-%m-%d')

# Try different date formats
formats = {
    'ddmmyy': date_obj.strftime('%d%m%y'),
    'ddmmyyyy': date_obj.strftime('%d%m%Y'),
    'dd/mm/yyyy': date_obj.strftime('%d/%m/%Y'),
    'dd-mm-yyyy': date_obj.strftime('%d-%m-%Y'),
    'yyyymmdd': date_obj.strftime('%Y%m%d'),
}

print("Testing different BSE API endpoints and date formats...\n")

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/*',
    'Referer': 'https://www.bseindia.com/markets/equity/EQReports/bulk_deals.aspx'
})

# First, visit the main page to get cookies
print("1. Getting session cookies...")
main_page = session.get('https://www.bseindia.com/markets/equity/EQReports/bulk_deals.aspx', timeout=15)
print(f"Main page status: {main_page.status_code}")
print(f"Cookies: {list(session.cookies.keys())}")
print()

# Try the actual API endpoint that the page uses
api_endpoints = [
    'https://api.bseindia.com/BseIndiaAPI/api/BulkDealsdata/w',
    'https://www.bseindia.com/markets/equity/EQReports/BulkDealsData.aspx',
]

for endpoint in api_endpoints:
    print(f"2. Testing endpoint: {endpoint}")
    for format_name, formatted_date in formats.items():
        params = {
            'Flag': '',
            'ddlcategorys': '',
            'DTData': formatted_date
        }
        
        try:
            response = session.get(endpoint, params=params, timeout=10)
            content_preview = response.text[:200].replace('\n', ' ').replace('\r', '')
            
            print(f"   {format_name} ({formatted_date}): Status={response.status_code}, Content-Type={response.headers.get('content-type', 'unknown')[:30]}")
            
            # Try to parse as JSON
            if 'json' in response.headers.get('content-type', '').lower():
                try:
                    data = response.json()
                    if isinstance(data, dict):
                        keys = list(data.keys())[:5]
                        print(f"      JSON keys: {keys}")
                        if 'Table' in data or 'data' in data:
                            items = data.get('Table') or data.get('data') or []
                            print(f"      ✅ Found {len(items)} records!")
                            if items:
                                first = items[0]
                                print(f"      First record keys: {list(first.keys())[:10]}")
                                break
                except:
                    pass
            else:
                print(f"      Content preview: {content_preview[:80]}")
        except Exception as e:
            print(f"   {format_name}: Error - {e}")
    print()

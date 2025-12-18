import requests
from bs4 import BeautifulSoup
from datetime import datetime

date_str = '2025-12-16'
date_obj = datetime.strptime(date_str, '%Y-%m-%d')
formatted_date = date_obj.strftime('%d%m%y')  # 161225

print(f"Testing date: {date_str}")
print(f"Formatted as: {formatted_date}")
print()

# Test API endpoint
api_url = "https://api.bseindia.com/BseIndiaAPI/api/BulkDealsdata/w"
params = {
    'Flag': 'bd',
    'ddlcategorys': '',
    'DTData': formatted_date
}

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://www.bseindia.com/'
}

print("1. Testing API endpoint...")
response = requests.get(api_url, params=params, headers=headers, timeout=15)
print(f"Status: {response.status_code}")
print(f"Content type: {response.headers.get('content-type')}")
print(f"First 500 chars: {response.text[:500]}")
print()

# Test HTML page
print("2. Testing HTML page...")
page_url = f"https://www.bseindia.com/markets/equity/EQReports/bulk_deals.aspx"
response2 = requests.get(page_url, timeout=15)
print(f"Status: {response2.status_code}")

soup = BeautifulSoup(response2.text, 'html.parser')

# Find all tables
tables = soup.find_all('table')
print(f"Found {len(tables)} tables")

# Look for the bulk deals table
for i, table in enumerate(tables):
    table_class = table.get('class', [])
    table_id = table.get('id', '')
    print(f"Table {i+1}: class={table_class}, id={table_id}")
    
    # Check if this looks like the bulk deals table
    if 'tablebody' in str(table_class).lower() or 'bulk' in str(table_id).lower():
        rows = table.find_all('tr')
        print(f"  -> This table has {len(rows)} rows")
        if rows:
            first_row = rows[0].find_all(['th', 'td'])
            print(f"  -> First row has {len(first_row)} columns")
            if first_row:
                print(f"  -> Column headers: {[col.text.strip()[:20] for col in first_row[:5]]}")

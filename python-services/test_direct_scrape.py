import requests
from bs4 import BeautifulSoup
from datetime import datetime

# The actual URL from the screenshot
url = "https://www.bseindia.com/markets/equity/EQReports/bulk_deals.aspx?expandable=3"

print("Fetching bulk deals page directly...")

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
})

response = session.get(url, timeout=20)
print(f"Status: {response.status_code}")

if response.status_code == 200:
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Find the table - it should have class "tablesorter"
    tables = soup.find_all('table')
    print(f"Found {len(tables)} tables")
    
    for i, table in enumerate(tables):
        print(f"\nTable {i+1}:")
        print(f"  Classes: {table.get('class')}")
        print(f"  ID: {table.get('id')}")
        
        # Get rows
        rows = table.find_all('tr')
        print(f"  Rows: {len(rows)}")
        
        if rows:
            # Check header
            header_cells = rows[0].find_all(['th', 'td'])
            print(f"  Header columns ({len(header_cells)}): {[cell.text.strip()[:20] for cell in header_cells]}")
            
            # Check if this looks like bulk deals table
            header_text = ' '.join([cell.text.strip().lower() for cell in header_cells])
            if 'deal' in header_text or 'client' in header_text or 'quantity' in header_text:
                print(f"  ✅ This looks like the bulk deals table!")
                
                # Parse a few rows
                data_rows = rows[1:6]  # First 5 data rows
                print(f"\n  Sample data:")
                for j, row in enumerate(data_rows, 1):
                    cells = row.find_all('td')
                    if len(cells) >= 4:
                        print(f"    Row {j}: {[cell.text.strip()[:30] for cell in cells[:6]]}")

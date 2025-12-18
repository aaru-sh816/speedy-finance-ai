import requests
from bs4 import BeautifulSoup

url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
})

# Get initial page
print("Getting initial page...")
response = session.get(url, timeout=20)
soup = BeautifulSoup(response.text, 'html.parser')

# Extract all form fields with their actual names
viewstate = soup.find('input', {'name': '__VIEWSTATE'})
viewstate_gen = soup.find('input', {'name': '__VIEWSTATEGENERATOR'})
event_val = soup.find('input', {'name': '__EVENTVALIDATION'})

# Find the actual field names by searching for date inputs
date_inputs = soup.find_all('input', {'type': 'text'})
print("\nText input fields found:")
for inp in date_inputs:
    name = inp.get('name', '')
    input_id = inp.get('id', '')
    placeholder = inp.get('placeholder', '')
    print(f"  Name: {name:50} | ID: {input_id:50} | Placeholder: {placeholder}")

# Find select for deal type
deal_select = soup.find('select', {'id': lambda x: x and 'ddl' in x.lower()})
if deal_select:
    print(f"\nDeal type select: {deal_select.get('name')} / {deal_select.get('id')}")

# Try submitting with correct field names
print("\n\nAttempting form submission with date 15/12/2025...")

form_data = {
    '__EVENTTARGET': '',
    '__EVENTARGUMENT': '',
    '__VIEWSTATE': viewstate['value'] if viewstate else '',
    '__VIEWSTATEGENERATOR': viewstate_gen['value'] if viewstate_gen else '',
    '__EVENTVALIDATION': event_val['value'] if event_val else '',
    'ctl00$ContentPlaceHolder1$dt6': '1',  # Bulk Deal
    'ctl00$ContentPlaceHolder1$chkAllMarket': 'on',
    'ctl00$ContentPlaceHolder1$ddlmarket': '',
    'ctl00$ContentPlaceHolder1$txtFromDate': '15/12/2025',
    'ctl00$ContentPlaceHolder1$txtToDate': '15/12/2025',
    'ctl00$ContentPlaceHolder1$btnSubmit': 'Submit'
}

response2 = session.post(url, data=form_data, timeout=20)
print(f"Status: {response2.status_code}")

if response2.status_code == 200:
    soup2 = BeautifulSoup(response2.text, 'html.parser')
    
    # Look for the data table - it should have ID with 'gv' (GridView)
    data_table = soup2.find('table', {'id': lambda x: x and 'gv' in x.lower()})
    
    if data_table:
        rows = data_table.find_all('tr')
        print(f"\n✅ Found data table with {len(rows)} rows")
        
        if len(rows) > 1:
            # Print headers
            headers = rows[0].find_all(['th', 'td'])
            print(f"Headers: {[h.text.strip() for h in headers]}")
            
            # Print first 3 data rows
            print("\nFirst 3 deals:")
            for i, row in enumerate(rows[1:4], 1):
                cells = row.find_all('td')
                if cells:
                    print(f"{i}. {[c.text.strip() for c in cells]}")
        else:
            print("Table exists but has no data rows")
    else:
        # Check all tables
        all_tables = soup2.find_all('table')
        print(f"\nNo GridView table found. Total tables: {len(all_tables)}")
        
        for i, table in enumerate(all_tables):
            rows = table.find_all('tr')
            if len(rows) > 2:
                print(f"\nTable {i+1}: {len(rows)} rows, ID={table.get('id', 'none')}")
                first_row = rows[0].find_all(['th', 'td'])
                if first_row:
                    print(f"  First row: {[cell.text.strip()[:30] for cell in first_row[:5]]}")

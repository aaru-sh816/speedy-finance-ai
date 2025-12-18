import requests
from bs4 import BeautifulSoup

url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Content-Type': 'application/x-www-form-urlencoded',
})

print("Getting initial page...")
response = session.get(url, timeout=20)
soup = BeautifulSoup(response.text, 'html.parser')

viewstate = soup.find('input', {'name': '__VIEWSTATE'})
viewstate_gen = soup.find('input', {'name': '__VIEWSTATEGENERATOR'})
event_val = soup.find('input', {'name': '__EVENTVALIDATION'})

print("Submitting form with date 15/12/2025...\n")

# Use the actual field names found: datr67 and todate78
form_data = {
    '__EVENTTARGET': '',
    '__EVENTARGUMENT': '',
    '__VIEWSTATE': viewstate['value'] if viewstate else '',
    '__VIEWSTATEGENERATOR': viewstate_gen['value'] if viewstate_gen else '',
    '__EVENTVALIDATION': event_val['value'] if event_val else '',
    'ctl00$ContentPlaceHolder1$dt6': '1',  # Bulk Deal
    'ctl00$ContentPlaceHolder1$chkAllMarket': 'on',
    'ctl00$ContentPlaceHolder1$ddlmarket': '',
    'datr67': '15/12/2025',  # Actual from date field name
    'todate78': '15/12/2025',  # Actual to date field name
    'ctl00$ContentPlaceHolder1$btnSubmit': 'Submit'
}

response2 = session.post(url, data=form_data, timeout=20)
print(f"Response status: {response2.status_code}\n")

if response2.status_code == 200:
    soup2 = BeautifulSoup(response2.text, 'html.parser')
    
    # Find all tables
    tables = soup2.find_all('table')
    print(f"Found {len(tables)} tables\n")
    
    for i, table in enumerate(tables, 1):
        rows = table.find_all('tr')
        if len(rows) > 1:
            print(f"Table {i}: {len(rows)} rows, ID={table.get('id', 'none')}, Class={table.get('class', 'none')}")
            
            # Check first row
            first_cells = rows[0].find_all(['th', 'td'])
            header_text = ' '.join([c.text.strip().lower() for c in first_cells])
            
            if first_cells and len(first_cells) > 3:
                print(f"  Headers: {[c.text.strip() for c in first_cells]}")
                
                # If this looks like data table
                if 'date' in header_text or 'security' in header_text or 'client' in header_text:
                    print(f"  ✅ This looks like the results table!")
                    print(f"  Sample data:")
                    for j, row in enumerate(rows[1:4], 1):
                        cells = row.find_all('td')
                        if cells and len(cells) > 3:
                            print(f"    Row {j}: {[c.text.strip()[:30] for c in cells[:6]]}")
            print()

# Also save the HTML to inspect
with open('bse_response.html', 'w', encoding='utf-8') as f:
    f.write(response2.text)
print("Response saved to bse_response.html")

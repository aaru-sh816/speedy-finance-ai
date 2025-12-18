import requests
from bs4 import BeautifulSoup
from datetime import datetime

url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
})

print("Testing with Dec 16, 2025 (Monday - known trading day)\n")

response = session.get(url, timeout=20)
soup = BeautifulSoup(response.text, 'html.parser')

viewstate = soup.find('input', {'name': '__VIEWSTATE'})
viewstate_gen = soup.find('input', {'name': '__VIEWSTATEGENERATOR'})
event_val = soup.find('input', {'name': '__EVENTVALIDATION'})

# Submit form for Dec 16
form_data = {
    '__VIEWSTATE': viewstate['value'] if viewstate else '',
    '__VIEWSTATEGENERATOR': viewstate_gen['value'] if viewstate_gen else '',
    '__EVENTVALIDATION': event_val['value'] if event_val else '',
    'ctl00$ContentPlaceHolder1$dt6': '1',
    'ctl00$ContentPlaceHolder1$chkAllMarket': 'on',
    'datr67': '16/12/2025',
    'todate78': '16/12/2025',
    'ctl00$ContentPlaceHolder1$btnSubmit': 'Submit'
}

response2 = session.post(url, data=form_data, timeout=20)
print(f"Response: {response2.status_code}\n")

soup2 = BeautifulSoup(response2.text, 'html.parser')

# Look for table with ID containing ContentPlaceHolder
result_table = soup2.find('table', {'id': lambda x: x and 'ContentPlaceHolder' in x and 'gv' in x})

if result_table:
    rows = result_table.find_all('tr')
    print(f"✅ Found result table with {len(rows)} rows\n")
    
    if len(rows) > 1:
        headers = rows[0].find_all(['th', 'td'])
        print(f"Headers: {[h.text.strip() for h in headers]}\n")
        
        print("First 5 deals:")
        for i, row in enumerate(rows[1:6], 1):
            cells = row.find_all('td')
            if len(cells) >= 7:
                print(f"{i}. {cells[0].text.strip()} | {cells[1].text.strip()} | {cells[2].text.strip()[:20]} | {cells[3].text.strip()[:20]} | {cells[4].text.strip()} | {cells[5].text.strip()} | {cells[6].text.strip()}")
else:
    # Try all tables
    all_tables = soup2.find_all('table')
    print(f"No ContentPlaceHolder table. Checking all {len(all_tables)} tables:\n")
    
    for i, table in enumerate(all_tables, 1):
        table_id = table.get('id', 'none')
        rows = table.find_all('tr')
        print(f"Table {i}: ID={table_id}, Rows={len(rows)}")
        
        if len(rows) > 3:
            first = rows[1].find_all('td') if len(rows) > 1 else []
            if first and len(first) > 3:
                print(f"  Sample: {[c.text.strip()[:20] for c in first[:5]]}")

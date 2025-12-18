import requests
from bs4 import BeautifulSoup

url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
})

print("Submitting form for 16/12/2025...\n")

response = session.get(url, timeout=20)
soup = BeautifulSoup(response.text, 'html.parser')

viewstate = soup.find('input', {'name': '__VIEWSTATE'})
viewstate_gen = soup.find('input', {'name': '__VIEWSTATEGENERATOR'})
event_val = soup.find('input', {'name': '__EVENTVALIDATION'})

form_data = {
    '__VIEWSTATE': viewstate.get('value', '') if viewstate else '',
    '__VIEWSTATEGENERATOR': viewstate_gen.get('value', '') if viewstate_gen else '',
    '__EVENTVALIDATION': event_val.get('value', '') if event_val else '',
    'ctl00$ContentPlaceHolder1$dt6': '1',
    'ctl00$ContentPlaceHolder1$chkAllMarket': 'on',
    'datr67': '16/12/2025',
    'todate78': '16/12/2025',
    'ctl00$ContentPlaceHolder1$btnSubmit': 'Submit'
}

response2 = session.post(url, data=form_data, timeout=20)
soup2 = BeautifulSoup(response2.text, 'html.parser')

# Check ALL tables regardless of size
tables = soup2.find_all('table')
print(f"Found {len(tables)} tables\n")

for i, table in enumerate(tables, 1):
    rows = table.find_all('tr')
    table_id = table.get('id', 'none')
    table_class = table.get('class', [])
    
    print(f"Table {i}:")
    print(f"  ID: {table_id}")
    print(f"  Class: {table_class}")
    print(f"  Rows: {len(rows)}")
    
    if len(rows) > 0:
        first_row = rows[0].find_all(['th', 'td'])
        if first_row and len(first_row) > 0:
            headers = [c.text.strip()[:30] for c in first_row]
            print(f"  First row cells: {headers}")
            
            # Check for data rows
            if len(rows) > 1:
                second_row = rows[1].find_all('td')
                if second_row and len(second_row) > 3:
                    data = [c.text.strip()[:20] for c in second_row[:6]]
                    print(f"  Second row data: {data}")
        else:
            print(f"  First row has no cells")
    print()

# Also check for any divs with bulk deal data
print("Checking for div elements with 'bulk' or 'deal'...")
divs = soup2.find_all('div', {'id': lambda x: x and ('bulk' in x.lower() or 'deal' in x.lower())})
print(f"Found {len(divs)} relevant divs")
for div in divs:
    print(f"  Div ID: {div.get('id')}")
    print(f"  Content preview: {div.text[:100]}")

import requests
from bs4 import BeautifulSoup

url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
})

print("Getting initial page...")
response = session.get(url, timeout=20)
soup = BeautifulSoup(response.text, 'html.parser')

viewstate = soup.find('input', {'name': '__VIEWSTATE'})
viewstate_gen = soup.find('input', {'name': '__VIEWSTATEGENERATOR'})
event_val = soup.find('input', {'name': '__EVENTVALIDATION'})

print("Submitting form for 16/12/2025...\n")

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
print(f"Response: {response2.status_code}\n")

soup2 = BeautifulSoup(response2.text, 'html.parser')

# Find ALL tables and check each one
tables = soup2.find_all('table')
print(f"Found {len(tables)} tables\n")

for i, table in enumerate(tables, 1):
    rows = table.find_all('tr')
    if len(rows) > 5:  # Only check substantial tables
        print(f"Table {i}: {len(rows)} rows")
        
        # Get first row to check headers
        first_row = rows[0].find_all(['th', 'td'])
        if first_row:
            headers = [cell.text.strip() for cell in first_row]
            print(f"  Headers: {headers}")
            
            # Check if this looks like bulk deals data
            header_text = ' '.join(headers).lower()
            if any(keyword in header_text for keyword in ['deal', 'security', 'client', 'quantity']):
                print(f"\n  ✅ THIS IS THE BULK DEALS TABLE!\n")
                print(f"  Parsing {len(rows)-1} deals...\n")
                
                deals = []
                for j, row in enumerate(rows[1:], 1):  # Skip header
                    cells = row.find_all('td')
                    if len(cells) >= 7:
                        deal = {
                            'deal_date': cells[0].text.strip(),
                            'security_code': cells[1].text.strip(),
                            'security_name': cells[2].text.strip(),
                            'client_name': cells[3].text.strip(),
                            'deal_type': cells[4].text.strip(),
                            'quantity': cells[5].text.strip(),
                            'price': cells[6].text.strip(),
                        }
                        deals.append(deal)
                        
                        if j <= 5:  # Print first 5
                            print(f"  {j}. {deal['deal_date']} | {deal['security_code']} | {deal['security_name'][:20]} | {deal['client_name'][:25]} | {deal['deal_type']} | {deal['quantity']} | ₹{deal['price']}")
                
                print(f"\n  ✅ Successfully parsed {len(deals)} bulk deals!")
                
                # Test with different date
                print("\n" + "="*80)
                print("Testing with 15/12/2025 (Sunday - should have no data)...\n")
                
                # Get fresh viewstate
                soup3 = BeautifulSoup(response2.text, 'html.parser')
                vs3 = soup3.find('input', {'name': '__VIEWSTATE'})
                vsg3 = soup3.find('input', {'name': '__VIEWSTATEGENERATOR'})
                ev3 = soup3.find('input', {'name': '__EVENTVALIDATION'})
                
                form_data2 = {
                    '__VIEWSTATE': vs3.get('value', '') if vs3 else '',
                    '__VIEWSTATEGENERATOR': vsg3.get('value', '') if vsg3 else '',
                    '__EVENTVALIDATION': ev3.get('value', '') if ev3 else '',
                    'ctl00$ContentPlaceHolder1$dt6': '1',
                    'ctl00$ContentPlaceHolder1$chkAllMarket': 'on',
                    'datr67': '15/12/2025',
                    'todate78': '15/12/2025',
                    'ctl00$ContentPlaceHolder1$btnSubmit': 'Submit'
                }
                
                response4 = session.post(url, data=form_data2, timeout=20)
                soup4 = BeautifulSoup(response4.text, 'html.parser')
                
                # Find the same table structure
                tables4 = soup4.find_all('table')
                for t4 in tables4:
                    rows4 = t4.find_all('tr')
                    if len(rows4) > 5:
                        first4 = rows4[0].find_all(['th', 'td'])
                        if first4:
                            headers4 = [c.text.strip() for c in first4]
                            if any(k in ' '.join(headers4).lower() for k in ['deal', 'security']):
                                deals4 = len(rows4) - 1
                                print(f"  Found {deals4} deals for 15/12/2025")
                                if deals4 > 0:
                                    print("  First deal:")
                                    cells4 = rows4[1].find_all('td')
                                    if cells4 and len(cells4) >= 7:
                                        print(f"    {cells4[0].text.strip()} | {cells4[2].text.strip()[:30]}")
                                break
                
                break
        print()

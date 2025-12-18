import requests
from bs4 import BeautifulSoup
from datetime import datetime

# The URL from the screenshot
url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': 'https://www.bseindia.com/',
})

print("1. Getting the form page to extract viewstate...")
response = session.get(url, timeout=20)
print(f"Status: {response.status_code}\n")

if response.status_code == 200:
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Find ASP.NET ViewState (needed for form submission)
    viewstate = soup.find('input', {'name': '__VIEWSTATE'})
    viewstate_generator = soup.find('input', {'name': '__VIEWSTATEGENERATOR'})
    event_validation = soup.find('input', {'name': '__EVENTVALIDATION'})
    
    print("Found form fields:")
    print(f"  __VIEWSTATE: {viewstate['value'][:50] if viewstate else 'Not found'}...")
    print(f"  __VIEWSTATEGENERATOR: {viewstate_generator['value'] if viewstate_generator else 'Not found'}")
    print(f"  __EVENTVALIDATION: {event_validation['value'][:50] if event_validation else 'Not found'}...")
    print()
    
    # Find all input fields
    inputs = soup.find_all('input')
    selects = soup.find_all('select')
    
    print(f"Found {len(inputs)} input fields and {len(selects)} select fields\n")
    
    print("Input fields:")
    for inp in inputs[:10]:
        name = inp.get('name', '')
        value = inp.get('value', '')
        input_type = inp.get('type', '')
        if name:
            print(f"  {input_type:10} | {name:40} | {str(value)[:30]}")
    
    print("\nSelect fields:")
    for sel in selects:
        name = sel.get('name', '')
        options = sel.find_all('option')
        print(f"  {name:40} | {len(options)} options")
        for opt in options[:3]:
            print(f"      -> {opt.get('value', '')}: {opt.text.strip()}")
    
    print("\n2. Testing form submission with date range (15-16 Dec 2025)...")
    
    # Prepare form data
    form_data = {
        '__VIEWSTATE': viewstate['value'] if viewstate else '',
        '__VIEWSTATEGENERATOR': viewstate_generator['value'] if viewstate_generator else '',
        '__EVENTVALIDATION': event_validation['value'] if event_validation else '',
        'ctl00$ContentPlaceHolder1$ddlmarket': '',  # All markets
        'ctl00$ContentPlaceHolder1$txtFromDate': '15/12/2025',
        'ctl00$ContentPlaceHolder1$txtToDate': '16/12/2025',
        'ctl00$ContentPlaceHolder1$btnSubmit': 'Submit'
    }
    
    response2 = session.post(url, data=form_data, timeout=20)
    print(f"Form submission status: {response2.status_code}")
    
    if response2.status_code == 200:
        soup2 = BeautifulSoup(response2.text, 'html.parser')
        
        # Find result table
        tables = soup2.find_all('table')
        print(f"Found {len(tables)} tables in response\n")
        
        for i, table in enumerate(tables):
            rows = table.find_all('tr')
            if len(rows) > 2:  # Has data
                print(f"Table {i+1}: {len(rows)} rows")
                header = rows[0].find_all(['th', 'td'])
                if header:
                    print(f"  Headers: {[h.text.strip()[:20] for h in header[:5]]}")
                
                # Check if this is the bulk deals table
                header_text = ' '.join([h.text.strip().lower() for h in header])
                if 'deal' in header_text or 'client' in header_text:
                    print(f"  ✅ This looks like the bulk deals result table!")
                    print(f"  Sample rows:")
                    for j, row in enumerate(rows[1:4], 1):
                        cells = row.find_all('td')
                        if cells:
                            print(f"    Row {j}: {[c.text.strip()[:20] for c in cells[:5]]}")

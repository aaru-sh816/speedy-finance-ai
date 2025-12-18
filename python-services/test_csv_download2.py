import requests
from bs4 import BeautifulSoup
import io
import csv

url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
})

print("Step 1: Get initial page...")
response = session.get(url, timeout=20)
soup = BeautifulSoup(response.text, 'html.parser')

viewstate = soup.find('input', {'name': '__VIEWSTATE'})
viewstate_gen = soup.find('input', {'name': '__VIEWSTATEGENERATOR'})
event_val = soup.find('input', {'name': '__EVENTVALIDATION'})

print("Step 2: Submit form for date 16/12/2025...\n")

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
print(f"Form submitted: {response2.status_code}")

# Extract updated form fields from the response
soup2 = BeautifulSoup(response2.text, 'html.parser')
viewstate2 = soup2.find('input', {'name': '__VIEWSTATE'})
viewstate_gen2 = soup2.find('input', {'name': '__VIEWSTATEGENERATOR'})
event_val2 = soup2.find('input', {'name': '__EVENTVALIDATION'})

print("Step 3: Trigger CSV download using __doPostBack...\n")

# Simulate the __doPostBack('ctl00$ContentPlaceHolder1$btnDownload','')
download_data = {
    '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$btnDownload',
    '__EVENTARGUMENT': '',
    '__VIEWSTATE': viewstate2['value'] if viewstate2 else '',
    '__VIEWSTATEGENERATOR': viewstate_gen2['value'] if viewstate_gen2 else '',
    '__EVENTVALIDATION': event_val2['value'] if event_val2 else '',
    'ctl00$ContentPlaceHolder1$dt6': '1',
    'ctl00$ContentPlaceHolder1$chkAllMarket': 'on',
    'datr67': '16/12/2025',
    'todate78': '16/12/2025',
}

response3 = session.post(url, data=download_data, timeout=20)
print(f"Download response: {response3.status_code}")
print(f"Content-Type: {response3.headers.get('content-type')}")
print(f"Content-Disposition: {response3.headers.get('content-disposition')}")

# Check if it's CSV
if 'csv' in response3.headers.get('content-type', '').lower() or 'text' in response3.headers.get('content-type', '').lower():
    print(f"\n✅ Received CSV data! Size: {len(response3.text)} bytes\n")
    
    # Parse CSV
    csv_data = io.StringIO(response3.text)
    reader = csv.reader(csv_data)
    
    rows = list(reader)
    print(f"CSV has {len(rows)} rows\n")
    
    if rows:
        print("Headers:")
        print(rows[0])
        print("\nFirst 5 data rows:")
        for i, row in enumerate(rows[1:6], 1):
            print(f"{i}. {row}")
        
        # Save to file for inspection
        with open('bulk_deals_test.csv', 'w', newline='', encoding='utf-8') as f:
            f.write(response3.text)
        print("\n✅ Saved to bulk_deals_test.csv")
else:
    print("⚠️ Response is not CSV")
    print(f"First 500 chars: {response3.text[:500]}")

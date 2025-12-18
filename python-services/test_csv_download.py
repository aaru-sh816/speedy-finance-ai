import requests
from bs4 import BeautifulSoup
import io
import csv

url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
})

print("Step 1: Getting initial page and form fields...\n")
response = session.get(url, timeout=20)
soup = BeautifulSoup(response.text, 'html.parser')

# Extract form fields
viewstate = soup.find('input', {'name': '__VIEWSTATE'})
viewstate_gen = soup.find('input', {'name': '__VIEWSTATEGENERATOR'})
event_val = soup.find('input', {'name': '__EVENTVALIDATION'})

print("Step 2: Submitting form for date range 15-16 Dec 2025...\n")

form_data = {
    '__VIEWSTATE': viewstate['value'] if viewstate else '',
    '__VIEWSTATEGENERATOR': viewstate_gen['value'] if viewstate_gen else '',
    '__EVENTVALIDATION': event_val['value'] if event_val else '',
    'ctl00$ContentPlaceHolder1$dt6': '1',  # Bulk Deal
    'ctl00$ContentPlaceHolder1$chkAllMarket': 'on',
    'datr67': '15/12/2025',
    'todate78': '16/12/2025',
    'ctl00$ContentPlaceHolder1$btnSubmit': 'Submit'
}

response2 = session.post(url, data=form_data, timeout=20)
print(f"Form submission: {response2.status_code}\n")

# Parse response to find download link
soup2 = BeautifulSoup(response2.text, 'html.parser')

# Look for download button/link
download_link = soup2.find('a', {'id': lambda x: x and 'download' in x.lower()})
if not download_link:
    download_link = soup2.find('a', string=lambda x: x and 'download' in x.lower())
if not download_link:
    download_link = soup2.find('a', {'href': lambda x: x and 'csv' in x.lower()})

if download_link:
    print(f"✅ Found download link: {download_link.get('href')}")
    print(f"   ID: {download_link.get('id')}")
    print(f"   Text: {download_link.text}")
else:
    print("⚠️ No download link found. Checking for data table...")
    
    # Look for the data table
    tables = soup2.find_all('table')
    for i, table in enumerate(tables, 1):
        rows = table.find_all('tr')
        if len(rows) > 5:  # Has substantial data
            print(f"\nTable {i}: {len(rows)} rows")
            # Check if it has the right columns
            first_row = rows[0].find_all(['th', 'td'])
            if first_row:
                headers = [cell.text.strip() for cell in first_row]
                print(f"Headers: {headers}")
                
                if 'Deal Date' in headers or 'Security Code' in headers:
                    print(f"✅ Found data table with {len(rows)-1} deals!")
                    print("\nFirst 3 deals:")
                    for j, row in enumerate(rows[1:4], 1):
                        cells = row.find_all('td')
                        if cells and len(cells) >= 7:
                            deal_date = cells[0].text.strip()
                            sec_code = cells[1].text.strip()
                            sec_name = cells[2].text.strip()
                            client = cells[3].text.strip()
                            deal_type = cells[4].text.strip()
                            quantity = cells[5].text.strip()
                            price = cells[6].text.strip()
                            print(f"{j}. {deal_date} | {sec_code} | {sec_name[:20]} | {client[:20]} | {deal_type} | {quantity} | {price}")
                    break

# Try to find the CSV export mechanism by looking for JavaScript or form buttons
print("\n\nLooking for CSV export mechanism...")
export_buttons = soup2.find_all('input', {'type': 'submit', 'value': lambda x: x and ('csv' in x.lower() or 'download' in x.lower())})
export_links = soup2.find_all('a', {'onclick': lambda x: x and 'csv' in str(x).lower()})

print(f"Export buttons found: {len(export_buttons)}")
for btn in export_buttons:
    print(f"  Button: {btn.get('id')} - {btn.get('value')}")

print(f"Export links found: {len(export_links)}")
for link in export_links:
    print(f"  Link: {link.get('id')} - onclick: {link.get('onclick')[:50]}")

import requests
from bs4 import BeautifulSoup

url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
})

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

print("Submitting form...")
response2 = session.post(url, data=form_data, timeout=20)

# Save full HTML
with open('bse_form_response.html', 'w', encoding='utf-8') as f:
    f.write(response2.text)

print(f"Response saved to bse_form_response.html ({len(response2.text)} bytes)")

# Search for known data from the images
known_strings = ['SYLPH', 'MANJULA HIRJI GADA', 'SHISHIND', 'MANGIND', 'MAHALIFE', 'NDTV']

print("\nSearching for known bulk deal names in response:")
for search_str in known_strings:
    if search_str in response2.text:
        print(f"  ✅ Found '{search_str}'")
        # Find context around it
        idx = response2.text.find(search_str)
        context = response2.text[max(0, idx-50):idx+100]
        print(f"     Context: ...{context}...")
    else:
        print(f"  ❌ NOT found: '{search_str}'")

# Check if there's a message about no records
if 'No record' in response2.text or 'no data' in response2.text.lower():
    print("\n⚠️ Response contains 'no record' message")

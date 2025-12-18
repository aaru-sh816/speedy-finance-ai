import requests
from bs4 import BeautifulSoup
from datetime import datetime

def scrape_bulk_deals_aspnet(date_str):
    """
    Properly handle ASP.NET ViewState and postback mechanism
    """
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    })
    
    url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"
    
    # Step 1: Get initial page to extract ViewState
    print(f"Getting initial page...")
    response1 = session.get(url, timeout=20)
    soup1 = BeautifulSoup(response1.text, 'html.parser')
    
    # Extract all ASP.NET form fields
    viewstate = soup1.find('input', {'name': '__VIEWSTATE'})
    viewstate_gen = soup1.find('input', {'name': '__VIEWSTATEGENERATOR'})
    event_val = soup1.find('input', {'name': '__EVENTVALIDATION'})
    viewstate_encrypted = soup1.find('input', {'name': '__VIEWSTATEENCRYPTED'})
    
    print(f"ViewState found: {bool(viewstate)}")
    print(f"ViewStateGenerator found: {bool(viewstate_gen)}")
    print(f"EventValidation found: {bool(event_val)}")
    
    # Step 2: Submit form with proper postback data
    print(f"\nSubmitting form for date: {date_str}")
    
    form_data = {
        '__EVENTTARGET': '',
        '__EVENTARGUMENT': '',
        '__VIEWSTATE': viewstate.get('value', '') if viewstate else '',
        '__VIEWSTATEGENERATOR': viewstate_gen.get('value', '') if viewstate_gen else '',
        '__EVENTVALIDATION': event_val.get('value', '') if event_val else '',
    }
    
    if viewstate_encrypted:
        form_data['__VIEWSTATEENCRYPTED'] = viewstate_encrypted.get('value', '')
    
    # Add form fields - need to find actual field IDs
    all_inputs = soup1.find_all('input')
    all_selects = soup1.find_all('select')
    
    print(f"\nFound {len(all_inputs)} inputs and {len(all_selects)} selects")
    
    # Set date fields (found from earlier investigation)
    form_data['datr67'] = date_str
    form_data['todate78'] = date_str
    
    # Set deal type dropdown
    for select in all_selects:
        select_name = select.get('name', '')
        select_id = select.get('id', '')
        if 'dt' in select_id.lower() or 'rbl' in select_id.lower():
            form_data[select_name] = '1'  # Bulk Deal
            print(f"Set {select_name} = 1 (Bulk Deal)")
    
    # Set checkbox for all market
    checkboxes = soup1.find_all('input', {'type': 'checkbox'})
    for cb in checkboxes:
        cb_name = cb.get('name', '')
        cb_id = cb.get('id', '')
        if 'market' in cb_id.lower():
            form_data[cb_name] = 'on'
            print(f"Set {cb_name} = on (All Market)")
    
    # Set submit button
    submit_btns = soup1.find_all('input', {'type': 'submit'})
    for btn in submit_btns:
        btn_name = btn.get('name', '')
        btn_id = btn.get('id', '')
        if 'submit' in btn_id.lower():
            form_data[btn_name] = btn.get('value', 'Submit')
            print(f"Set {btn_name} = Submit")
    
    print(f"\nForm data keys: {list(form_data.keys())}")
    
    # Submit the form
    response2 = session.post(url, data=form_data, timeout=20)
    print(f"\nResponse status: {response2.status_code}")
    
    # Check response for data
    if 'SYLPH' in response2.text or 'MANGIND' in response2.text:
        print("✅ Found bulk deal names in response!")
    else:
        print("⚠️ No bulk deal names found in response")
    
    # Parse response
    soup2 = BeautifulSoup(response2.text, 'html.parser')
    
    # Look for data table
    tables = soup2.find_all('table')
    print(f"Found {len(tables)} tables in response")
    
    deals = []
    for i, table in enumerate(tables, 1):
        rows = table.find_all('tr')
        if len(rows) > 5:
            print(f"\nTable {i}: {len(rows)} rows")
            first_row = rows[0].find_all(['th', 'td'])
            if first_row:
                headers = [c.text.strip() for c in first_row]
                print(f"  Headers: {headers[:5]}")
                
                if any(h for h in headers if 'deal' in h.lower() or 'security' in h.lower()):
                    print(f"  ✅ This looks like bulk deals table!")
                    for row in rows[1:]:
                        cells = row.find_all('td')
                        if len(cells) >= 7 and cells[1].text.strip():
                            deals.append({
                                'date': cells[0].text.strip(),
                                'code': cells[1].text.strip(),
                                'name': cells[2].text.strip(),
                                'client': cells[3].text.strip(),
                            })
    
    return deals


# Test
date_input = "16/12/2025"
deals = scrape_bulk_deals_aspnet(date_input)
print(f"\n{'='*80}")
print(f"RESULT: Found {len(deals)} bulk deals")
if deals:
    print("\nFirst 5 deals:")
    for i, deal in enumerate(deals[:5], 1):
        print(f"{i}. {deal['date']} | {deal['code']:6} | {deal['name'][:30]:30}")

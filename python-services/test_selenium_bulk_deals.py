from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import time

def scrape_bulk_deals_selenium(date_str):
    """
    Scrape BSE bulk deals using Selenium for a specific date
    date_str: Date in format 'DD/MM/YYYY' (e.g., '12/12/2025')
    """
    
    # Setup Chrome options
    chrome_options = Options()
    chrome_options.add_argument('--headless')  # Run in background
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    
    # Initialize driver
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    try:
        url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"
        print(f"Opening {url}...")
        driver.get(url)
        
        # Wait for page to load
        wait = WebDriverWait(driver, 20)
        
        # Wait for the date input fields to be present
        from_date_input = wait.until(
            EC.presence_of_element_located((By.ID, "ContentPlaceHolder1_txtDate"))
        )
        to_date_input = driver.find_element(By.ID, "ContentPlaceHolder1_txtToDate")
        
        print(f"Filling dates: {date_str} to {date_str}")
        
        # Clear and fill dates
        from_date_input.clear()
        from_date_input.send_keys(date_str)
        
        to_date_input.clear()
        to_date_input.send_keys(date_str)
        
        # Select "Bulk Deal" from dropdown if needed
        try:
            deal_type = driver.find_element(By.ID, "ContentPlaceHolder1_dt6")
            deal_type.click()
            # Select first option (Bulk Deal)
            bulk_option = driver.find_element(By.XPATH, "//select[@id='ContentPlaceHolder1_dt6']/option[@value='1']")
            bulk_option.click()
        except:
            # Try alternative selector
            try:
                deal_type = driver.find_element(By.NAME, "ctl00$ContentPlaceHolder1$dt6")
                from selenium.webdriver.support.ui import Select
                select = Select(deal_type)
                select.select_by_value('1')
            except Exception as e:
                print(f"Warning: Could not set deal type dropdown: {e}")
        
        # Check "All Market" checkbox
        try:
            all_market_checkbox = driver.find_element(By.ID, "ContentPlaceHolder1_chkAllMarket")
            if not all_market_checkbox.is_selected():
                all_market_checkbox.click()
        except:
            pass
        
        # Click Submit button
        submit_button = driver.find_element(By.ID, "ContentPlaceHolder1_btnSubmit")
        print("Clicking submit button...")
        submit_button.click()
        
        # Wait for results to load - look for the data table
        print("Waiting for results to load...")
        time.sleep(5)  # Give it more time for AJAX
        
        # Save page HTML for debugging
        with open(f'selenium_response_{date_str.replace("/", "_")}.html', 'w', encoding='utf-8') as f:
            f.write(driver.page_source)
        print(f"Saved page HTML to selenium_response_{date_str.replace('/', '_')}.html")
        
        # Try to find the results table
        # Look for table with bulk deals data
        tables = driver.find_elements(By.TAG_NAME, "table")
        print(f"Found {len(tables)} tables after submission")
        
        # Also check for any error messages or "no records" text
        body_text = driver.find_element(By.TAG_NAME, "body").text
        if 'no record' in body_text.lower() or 'no data' in body_text.lower():
            print("⚠️ Page shows 'no records' message")
        
        # Look for specific bulk deals elements
        bulk_divs = driver.find_elements(By.XPATH, "//*[contains(@id, 'bulk') or contains(@id, 'Bulk')]")
        print(f"Found {len(bulk_divs)} elements with 'bulk' in ID")
        
        deals = []
        
        for table in tables:
            try:
                rows = table.find_elements(By.TAG_NAME, "tr")
                if len(rows) > 5:  # Has substantial data
                    # Check if this is the bulk deals table by looking at headers
                    headers = rows[0].find_elements(By.TAG_NAME, "th")
                    if not headers:
                        headers = rows[0].find_elements(By.TAG_NAME, "td")
                    
                    header_text = ' '.join([h.text.strip() for h in headers]).lower()
                    
                    if 'deal' in header_text or 'security' in header_text or 'client' in header_text:
                        print(f"✅ Found bulk deals table with {len(rows)-1} potential deals")
                        
                        # Parse data rows
                        for i, row in enumerate(rows[1:], 1):  # Skip header
                            cells = row.find_elements(By.TAG_NAME, "td")
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
                                
                                # Only add if it has actual data
                                if deal['security_code']:
                                    deals.append(deal)
                        
                        break  # Found the table, exit loop
            except Exception as e:
                continue
        
        return deals
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return []
    
    finally:
        driver.quit()


# Test with different dates
if __name__ == "__main__":
    print("="*80)
    print("Testing Selenium-based bulk deals scraper")
    print("="*80 + "\n")
    
    test_dates = [
        ("12/12/2025", "Dec 12, 2025"),
        ("13/12/2025", "Dec 13, 2025"),
        ("16/12/2025", "Dec 16, 2025"),
    ]
    
    for date_input, date_label in test_dates:
        print(f"\n{'='*80}")
        print(f"Testing {date_label} ({date_input})")
        print('='*80)
        
        deals = scrape_bulk_deals_selenium(date_input)
        
        print(f"\n✅ Found {len(deals)} bulk deals")
        
        if deals:
            # Show unique dates in response
            unique_dates = set(d['deal_date'] for d in deals if d['deal_date'])
            print(f"Unique dates in response: {unique_dates}")
            
            print("\nTop 5 deals:")
            for i, deal in enumerate(deals[:5], 1):
                print(f"{i}. {deal['deal_date']} | {deal['security_code']:6} | {deal['security_name'][:25]:25} | {deal['client_name'][:30]:30}")
        else:
            print("⚠️ No deals found")
        
        time.sleep(2)  # Brief pause between requests
    
    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80)

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import Select
from webdriver_manager.chrome import ChromeDriverManager
import time

date_str = "12/12/2025"

chrome_options = Options()
chrome_options.add_argument('--start-maximized')  # Run visible to debug

service = Service(ChromeDriverManager().install())
driver = webdriver.Chrome(service=service, options=chrome_options)

try:
    url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"
    print(f"Opening {url}...")
    driver.get(url)
    
    wait = WebDriverWait(driver, 20)
    
    # Wait for datepickers
    print("Waiting for page to load...")
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".hasDatepicker")))
    time.sleep(3)
    
    driver.save_screenshot("step1_initial_page.png")
    print("Screenshot saved: step1_initial_page.png")
    
    # Set dates with delays
    print(f"\nSetting FROM date to {date_str}...")
    driver.execute_script(f"""
        var fromDateField = document.querySelector('div:nth-child(3) .hasDatepicker');
        console.log('From date field:', fromDateField);
        if (fromDateField) {{
            $(fromDateField).datepicker('setDate', '{date_str}');
            fromDateField.value = '{date_str}';
            console.log('From date set to:', fromDateField.value);
        }}
    """)
    time.sleep(2)
    
    print(f"Setting TO date to {date_str}...")
    driver.execute_script(f"""
        var toDateField = document.querySelector('div:nth-child(5) input[type="text"]');
        console.log('To date field:', toDateField);
        if (toDateField) {{
            $(toDateField).datepicker('setDate', '{date_str}');
            toDateField.value = '{date_str}';
            console.log('To date set to:', toDateField.value);
        }}
    """)
    time.sleep(2)
    
    # Check what values were actually set
    from_value = driver.execute_script("return document.querySelector('div:nth-child(3) .hasDatepicker').value;")
    to_value = driver.execute_script("return document.querySelector('div:nth-child(5) input[type=\"text\"]').value;")
    print(f"From date value in form: '{from_value}'")
    print(f"To date value in form: '{to_value}'")
    
    driver.save_screenshot("step2_dates_filled.png")
    print("Screenshot saved: step2_dates_filled.png")
    
    # Select Bulk Deal
    print("\nSelecting Bulk Deal type...")
    deal_type = driver.find_element(By.ID, "ContentPlaceHolder1_rblDT")
    Select(deal_type).select_by_value('1')
    time.sleep(1)
    
    # Check All Market
    print("Checking All Market...")
    try:
        all_market = driver.find_element(By.ID, "ContentPlaceHolder1_chkAllMarket")
        if not all_market.is_selected():
            all_market.click()
        time.sleep(1)
    except:
        pass
    
    driver.save_screenshot("step3_form_complete.png")
    print("Screenshot saved: step3_form_complete.png")
    
    # Check for any validation errors before submitting
    page_text = driver.find_element(By.TAG_NAME, "body").text
    if "Please Select" in page_text:
        print("⚠️ WARNING: Page shows 'Please Select' message BEFORE submit!")
    
    # Submit
    print("\nClicking Submit...")
    driver.execute_script("document.getElementById('ContentPlaceHolder1_btnSubmit').click();")
    
    print("Waiting for results (10 seconds)...")
    time.sleep(10)
    
    driver.save_screenshot("step4_after_submit.png")
    print("Screenshot saved: step4_after_submit.png")
    
    # Check page content
    page_text_after = driver.find_element(By.TAG_NAME, "body").text
    if "Please Select From Date" in page_text_after:
        print("❌ ERROR: 'Please Select From Date' message found AFTER submit!")
        print("The form did not accept the dates!")
    
    # Look for data
    tables = driver.find_elements(By.TAG_NAME, "table")
    print(f"\nFound {len(tables)} tables")
    
    for i, table in enumerate(tables, 1):
        rows = table.find_elements(By.TAG_NAME, "tr")
        if len(rows) > 3:
            print(f"\nTable {i}: {len(rows)} rows")
            first_cells = rows[0].find_elements(By.TAG_NAME, "th")
            if not first_cells:
                first_cells = rows[0].find_elements(By.TAG_NAME, "td")
            if first_cells:
                headers = [c.text.strip() for c in first_cells[:5]]
                print(f"  Headers: {headers}")
                
                if len(rows) > 1:
                    data_cells = rows[1].find_elements(By.TAG_NAME, "td")
                    if data_cells and len(data_cells) > 3:
                        data = [c.text.strip()[:20] for c in data_cells[:5]]
                        print(f"  Row 1: {data}")
    
    print("\nBrowser will stay open for 30 seconds for inspection...")
    time.sleep(30)
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    driver.save_screenshot("error_state.png")
    time.sleep(10)

finally:
    driver.quit()

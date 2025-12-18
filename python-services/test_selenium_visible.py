from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import Select
from webdriver_manager.chrome import ChromeDriverManager
import time

def scrape_with_visible_browser(date_str):
    """Test with visible browser to debug"""
    
    chrome_options = Options()
    # Remove headless mode to see what's happening
    chrome_options.add_argument('--start-maximized')
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    try:
        url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"
        print(f"Opening {url}...")
        driver.get(url)
        
        wait = WebDriverWait(driver, 20)
        
        # Wait for page to fully load
        time.sleep(2)
        print("Page loaded. Looking for form elements...")
        
        # Find all input elements to understand the structure
        all_inputs = driver.find_elements(By.TAG_NAME, "input")
        print(f"\nFound {len(all_inputs)} input elements:")
        for inp in all_inputs:
            inp_type = inp.get_attribute('type')
            inp_id = inp.get_attribute('id')
            inp_name = inp.get_attribute('name')
            if inp_type in ['text', 'submit', 'button'] and inp_id:
                print(f"  {inp_type:10} | ID: {inp_id}")
        
        # Find all select elements
        all_selects = driver.find_elements(By.TAG_NAME, "select")
        print(f"\nFound {len(all_selects)} select elements:")
        for sel in all_selects:
            sel_id = sel.get_attribute('id')
            sel_name = sel.get_attribute('name')
            print(f"  ID: {sel_id} | Name: {sel_name}")
        
        # Now fill the form
        print(f"\n\nFilling form with date: {date_str}")
        
        # Find date inputs by their actual IDs
        from_date = driver.find_element(By.ID, "ContentPlaceHolder1_txtDate")
        to_date = driver.find_element(By.ID, "ContentPlaceHolder1_txtToDate")
        
        from_date.clear()
        from_date.send_keys(date_str)
        print(f"Filled 'From' date: {date_str}")
        
        to_date.clear()
        to_date.send_keys(date_str)
        print(f"Filled 'To' date: {date_str}")
        
        # Try to select deal type from dropdown
        try:
            # Find the select element
            selects = driver.find_elements(By.TAG_NAME, "select")
            for select in selects:
                sel_id = select.get_attribute('id')
                if 'dt' in sel_id.lower() or 'deal' in sel_id.lower():
                    print(f"Found deal type select: {sel_id}")
                    select_obj = Select(select)
                    # Select "Bulk Deal" (usually first option value='1')
                    select_obj.select_by_value('1')
                    print("Selected 'Bulk Deal' from dropdown")
                    break
        except Exception as e:
            print(f"Could not select deal type: {e}")
        
        # Check "All Market" if present
        try:
            checkboxes = driver.find_elements(By.XPATH, "//input[@type='checkbox']")
            for cb in checkboxes:
                cb_id = cb.get_attribute('id')
                if 'market' in cb_id.lower():
                    if not cb.is_selected():
                        cb.click()
                    print(f"Checked 'All Market' checkbox: {cb_id}")
                    break
        except Exception as e:
            print(f"Could not check 'All Market': {e}")
        
        # Find and click submit button
        submit_button = driver.find_element(By.ID, "ContentPlaceHolder1_btnSubmit")
        print("\n\nClicking SUBMIT button...")
        submit_button.click()
        
        # Wait and observe
        print("Waiting 10 seconds for results to load...")
        time.sleep(10)
        
        # Check page content
        print("\n\nChecking for data...")
        
        # Look for data table
        tables = driver.find_elements(By.TAG_NAME, "table")
        print(f"Found {len(tables)} tables on page")
        
        for i, table in enumerate(tables, 1):
            rows = table.find_elements(By.TAG_NAME, "tr")
            if len(rows) > 3:
                print(f"\nTable {i}: {len(rows)} rows")
                # Get first row
                first_cells = rows[0].find_elements(By.TAG_NAME, "th")
                if not first_cells:
                    first_cells = rows[0].find_elements(By.TAG_NAME, "td")
                if first_cells:
                    headers = [c.text.strip() for c in first_cells]
                    print(f"  Headers: {headers[:5]}")
                    
                    if len(rows) > 1:
                        second_cells = rows[1].find_elements(By.TAG_NAME, "td")
                        if second_cells and len(second_cells) > 3:
                            data = [c.text.strip() for c in second_cells[:5]]
                            print(f"  Row 1 data: {data}")
        
        print("\n\nBrowser will stay open for 20 seconds for you to inspect...")
        time.sleep(20)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        time.sleep(10)
    
    finally:
        driver.quit()


if __name__ == "__main__":
    # Test with Dec 16 (known trading day)
    scrape_with_visible_browser("16/12/2025")

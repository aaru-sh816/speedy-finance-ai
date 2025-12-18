from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import Select
from webdriver_manager.chrome import ChromeDriverManager
import time
import os

date_str = "12/12/2025"

chrome_options = Options()
chrome_options.add_argument('--start-minimized')
chrome_options.add_argument('--no-sandbox')
chrome_options.add_argument('--disable-dev-shm-usage')

# Set download directory
download_dir = os.path.abspath("./bulk_deals_downloads")
os.makedirs(download_dir, exist_ok=True)

prefs = {
    "download.default_directory": download_dir,
    "download.prompt_for_download": False,
    "download.directory_upgrade": True,
    "safebrowsing.enabled": True
}
chrome_options.add_experimental_option("prefs", prefs)

service = Service(ChromeDriverManager().install())
driver = webdriver.Chrome(service=service, options=chrome_options)

try:
    url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"
    print(f"Opening {url}...")
    driver.get(url)
    
    wait = WebDriverWait(driver, 20)
    
    # Wait and set dates
    print("Setting dates...")
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".hasDatepicker")))
    time.sleep(3)
    
    driver.execute_script(f"""
        var fromDateField = document.querySelector('div:nth-child(3) .hasDatepicker');
        var toDateField = document.querySelector('div:nth-child(5) input[type="text"]');
        if (fromDateField) {{
            $(fromDateField).datepicker('setDate', '{date_str}');
            fromDateField.value = '{date_str}';
        }}
        if (toDateField) {{
            $(toDateField).datepicker('setDate', '{date_str}');
            toDateField.value = '{date_str}';
        }}
    """)
    time.sleep(2)
    
    # Select Bulk Deal
    deal_type = driver.find_element(By.ID, "ContentPlaceHolder1_rblDT")
    Select(deal_type).select_by_value('1')
    
    # Check All Market
    try:
        all_market = driver.find_element(By.ID, "ContentPlaceHolder1_chkAllMarket")
        if not all_market.is_selected():
            all_market.click()
    except:
        pass
    
    # Submit
    print(f"Submitting form for {date_str}...")
    driver.execute_script("document.getElementById('ContentPlaceHolder1_btnSubmit').click();")
    time.sleep(5)
    
    # Wait for results
    wait.until(lambda d: 'Period' in d.find_element(By.TAG_NAME, "body").text)
    print("Results loaded")
    time.sleep(2)
    
    # Look for download link/button
    print("\nLooking for CSV download button...")
    
    # Try common download selectors
    download_elements = []
    
    # Look for links with 'download' or 'csv' in them
    all_links = driver.find_elements(By.TAG_NAME, "a")
    for link in all_links:
        link_text = link.text.lower()
        link_id = link.get_attribute('id') or ''
        link_class = link.get_attribute('class') or ''
        
        if 'download' in link_text or 'csv' in link_text or 'download' in link_id.lower() or 'download' in link_class.lower():
            print(f"Found download element:")
            print(f"  Text: {link.text}")
            print(f"  ID: {link_id}")
            print(f"  Class: {link_class}")
            print(f"  href: {link.get_attribute('href')}")
            download_elements.append(link)
    
    # Also check for download icon/image
    download_icons = driver.find_elements(By.CSS_SELECTOR, ".fa-download")
    print(f"\nFound {len(download_icons)} download icons")
    
    if download_elements:
        print(f"\nClicking first download element...")
        download_elements[0].click()
        
        print("Waiting for download to complete (10 seconds)...")
        time.sleep(10)
        
        # Check download directory
        files = os.listdir(download_dir)
        print(f"\nFiles in download directory: {files}")
        
        csv_files = [f for f in files if f.endswith('.csv')]
        if csv_files:
            print(f"✅ CSV downloaded: {csv_files[0]}")
            
            # Read and display first few lines
            with open(os.path.join(download_dir, csv_files[0]), 'r', encoding='utf-8') as f:
                lines = f.readlines()
                print(f"\nCSV has {len(lines)} lines")
                print("\nFirst 5 lines:")
                for line in lines[:5]:
                    print(line.strip())
        else:
            print("⚠️ No CSV file found in downloads")
    else:
        print("⚠️ No download button found")
        
        # Save page source for inspection
        with open('page_with_results.html', 'w', encoding='utf-8') as f:
            f.write(driver.page_source)
        print("Saved page source to page_with_results.html")
    
    print("\nBrowser staying open for 15 seconds...")
    time.sleep(15)

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    time.sleep(10)

finally:
    driver.quit()

"""
Bulk Deals Scraper for BSE/NSE
Scrapes bulk deal data from BSE and Anand Rathi
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import json

class BulkDealsScraper:
    """Scraper for BSE/NSE bulk deals data"""
    
    BSE_URL = "https://www.bseindia.com/markets/equity/EQReports/bulk_deal.aspx"
    ANAND_RATHI_URL = "https://www.anandrathi.com/bulkdeals"
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def scrape_bse_bulk_deals_selenium(self, date: Optional[str] = None) -> List[Dict]:
        """
        Scrape BSE bulk deals using Selenium for proper historical date filtering
        """
        try:
            from selenium import webdriver
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            from selenium.webdriver.chrome.service import Service
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.support.ui import Select
            from webdriver_manager.chrome import ChromeDriverManager
            import time
        except ImportError:
            print("Selenium not installed. Falling back to HTML scraping.")
            return self.scrape_bse_bulk_deals_html(date)
        
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')
        
        try:
            date_obj = datetime.strptime(date, '%Y-%m-%d')
            date_bse_format = date_obj.strftime('%d/%m/%Y')  # BSE uses DD/MM/YYYY
            
            chrome_options = Options()
            # headless mode doesn't render BSE results properly - run visible
            # chrome_options.add_argument('--headless')  
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--start-minimized')  # Minimize instead of headless
            chrome_options.add_argument('--disable-gpu')
            
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
            
            url = "http://www.bseindia.com/markets/equity/EQReports/BulknBlockDeals.aspx?flag=1"
            driver.get(url)
            
            wait = WebDriverWait(driver, 20)
            
            # Wait for page and datepickers to load
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".hasDatepicker")))
            time.sleep(3)  # Wait for jQuery and datepicker initialization
            
            # Use proper CSS selectors for datepicker fields
            # Set FROM date
            driver.execute_script(f"""
                var fromDateField = document.querySelector('div:nth-child(3) .hasDatepicker');
                if (fromDateField) {{
                    $(fromDateField).datepicker('setDate', '{date_bse_format}');
                    fromDateField.value = '{date_bse_format}';
                }}
            """)
            time.sleep(2)  # CRITICAL: Wait for datepicker to process
            
            # Set TO date
            driver.execute_script(f"""
                var toDateField = document.querySelector('div:nth-child(5) input[type="text"]');
                if (toDateField) {{
                    $(toDateField).datepicker('setDate', '{date_bse_format}');
                    toDateField.value = '{date_bse_format}';
                }}
            """)
            time.sleep(2)  # CRITICAL: Wait for datepicker to process
            
            # Select Bulk Deal type
            deal_type_select = driver.find_element(By.ID, "ContentPlaceHolder1_rblDT")
            Select(deal_type_select).select_by_value('1')
            
            # Check All Market
            try:
                all_market = driver.find_element(By.ID, "ContentPlaceHolder1_chkAllMarket")
                if not all_market.is_selected():
                    all_market.click()
            except:
                pass
            
            # Submit using JavaScript (avoids click interception issues)
            print(f"Submitting form for date: {date_bse_format}")
            driver.execute_script("document.getElementById('ContentPlaceHolder1_btnSubmit').click();")
            
            # Wait longer for AJAX/postback to complete
            time.sleep(5)
            
            # Wait explicitly for results text to appear
            try:
                wait.until(lambda d: 'Period' in d.find_element(By.TAG_NAME, "body").text)
                print("Results loaded - found 'Period' text")
                time.sleep(3)  # Extra time for table to fully render
            except:
                print("Warning: Results text 'Period' not found, waiting anyway...")
                time.sleep(10)  # Much longer fallback wait
            
            # Download CSV for clean data extraction
            bulk_deals = []
            
            try:
                # Click download button
                download_btn = driver.find_element(By.ID, "ContentPlaceHolder1_btnDownload")
                
                # Set up temporary download directory
                import tempfile
                import csv as csv_module
                temp_dir = tempfile.mkdtemp()
                
                # Update download preferences
                driver.execute_cdp_cmd('Page.setDownloadBehavior', {
                    'behavior': 'allow',
                    'downloadPath': temp_dir
                })
                
                print("Clicking CSV download button...")
                download_btn.click()
                time.sleep(5)  # Wait for download
                
                # Find downloaded CSV file
                import os
                csv_files = [f for f in os.listdir(temp_dir) if f.endswith('.csv')]
                
                if csv_files:
                    csv_path = os.path.join(temp_dir, csv_files[0])
                    print(f"Downloaded CSV: {csv_files[0]}")
                    
                    # Parse CSV
                    with open(csv_path, 'r', encoding='utf-8') as f:
                        reader = csv_module.DictReader(f)
                        for row in reader:
                            bulk_deals.append({
                                'exchange': 'BSE',
                                'date': date,
                                'deal_date': row.get('Deal Date', '').strip(),
                                'scrip_code': row.get('Security Code', '').strip(),
                                'security_name': row.get('Company', '').strip(),
                                'client_name': row.get('Client Name', '').strip(),
                                'deal_type': row.get('Deal Type', '').strip().upper(),
                                'quantity': self._parse_number(row.get('Quantity', '0')),
                                'trade_price': self._parse_float(row.get('Price', '0')),
                                'remarks': ''
                            })
                    
                    print(f"Parsed {len(bulk_deals)} bulk deals from CSV")
                    
                    # Cleanup
                    import shutil
                    shutil.rmtree(temp_dir, ignore_errors=True)
                else:
                    print("Warning: CSV file not downloaded")
                    
            except Exception as csv_error:
                print(f"CSV download failed: {csv_error}, trying HTML parsing...")
                # Fallback to HTML parsing if CSV fails
                pass
            
            driver.quit()
            return bulk_deals
            
        except Exception as e:
            print(f"Selenium scraping failed: {e}")
            try:
                driver.quit()
            except:
                pass
            return self.scrape_bse_bulk_deals_html(date)
    
    def scrape_bse_bulk_deals_html(self, date: Optional[str] = None) -> List[Dict]:
        """
        Fallback HTML scraping method (gets latest trading day only)
        """
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')
        
        try:
            date_obj = datetime.strptime(date, '%Y-%m-%d')
            formatted_date = date_obj.strftime('%d%m%y')
            
            scrape_url = "https://www.bseindia.com/markets/equity/EQReports/bulk_deals.aspx?expandable=3"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
            
            response = self.session.get(scrape_url, headers=headers, timeout=20)
            
            if response.status_code == 200:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(response.text, 'html.parser')
                
                table = soup.find('table', {'id': 'ContentPlaceHolder1_gvbulk_deals'})
                
                if table:
                    bulk_deals = []
                    rows = table.find_all('tr')[1:]
                    
                    for row in rows:
                        cols = row.find_all('td')
                        if len(cols) >= 7:
                            bulk_deals.append({
                                'exchange': 'BSE',
                                'date': date,
                                'deal_date': cols[0].text.strip(),
                                'scrip_code': cols[1].text.strip(),
                                'security_name': cols[2].text.strip(),
                                'client_name': cols[3].text.strip(),
                                'deal_type': cols[4].text.strip().upper(),
                                'quantity': self._parse_number(cols[5].text.strip()),
                                'trade_price': self._parse_float(cols[6].text.strip()),
                                'remarks': ''
                            })
                    
                    return bulk_deals
            
            return []
            
        except Exception as e:
            print(f"HTML scraping failed: {e}")
            return []
    
    def scrape_bse_bulk_deals(self, date: Optional[str] = None) -> List[Dict]:
        """
        Scrape BSE bulk deals - tries Selenium first for historical dates, falls back to HTML
        """
        # Try Selenium first for proper date filtering
        return self.scrape_bse_bulk_deals_selenium(date)
    
    def scrape_bulk_deals(self, date: Optional[str] = None, exchange: str = 'bse') -> List[Dict]:
        """
        Scrape bulk deals for specified exchange
        
        Args:
            date: Date in YYYY-MM-DD format (defaults to today)
            exchange: 'bse', 'nse', or 'both'
        
        Returns:
            List of bulk deal dictionaries
        """
        if exchange.lower() == 'bse':
            return self.scrape_bse_bulk_deals(date)
        elif exchange.lower() == 'nse':
            return self.scrape_nse_bulk_deals(date)
        else:
            return self.get_combined_bulk_deals(date)
    
    def scrape_nse_bulk_deals(self, date: Optional[str] = None) -> List[Dict]:
        """
        Scrape NSE bulk deals for a specific date
        
        Args:
            date: Date in YYYY-MM-DD format (defaults to today)
        
        Returns:
            List of bulk deal dictionaries
        """
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')
        
        try:
            date_obj = datetime.strptime(date, '%Y-%m-%d')
            formatted_date = date_obj.strftime('%d-%m-%Y')
            
            # NSE bulk deal API
            api_url = f"https://www.nseindia.com/api/snapshot-capital-market-bulkDeals?date={formatted_date}"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.nseindia.com/'
            }
            
            # NSE requires session cookies
            self.session.get('https://www.nseindia.com/', headers=headers, timeout=15)
            
            response = self.session.get(api_url, headers=headers, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                bulk_deals = []
                for item in data.get('data', []):
                    bulk_deals.append({
                        'exchange': 'NSE',
                        'date': date,
                        'company_name': item.get('symbol', '').strip(),
                        'scrip_code': item.get('symbol', ''),
                        'security_name': item.get('secName', '').strip(),
                        'client_name': item.get('clientName', '').strip(),
                        'deal_type': item.get('buyOrSell', '').upper(),
                        'quantity': self._parse_number(item.get('quantityTraded', '0')),
                        'trade_price': self._parse_float(item.get('tradePrice', '0')),
                        'remarks': item.get('remarks', '').strip()
                    })
                
                return bulk_deals
            
            return []
            
        except Exception as e:
            print(f"Error scraping NSE bulk deals: {e}")
            return []
    
    def get_combined_bulk_deals(self, date: Optional[str] = None) -> List[Dict]:
        """
        Get bulk deals from both BSE and NSE
        
        Args:
            date: Date in YYYY-MM-DD format (defaults to today)
        
        Returns:
            Combined list of bulk deals from both exchanges
        """
        bse_deals = self.scrape_bse_bulk_deals(date)
        nse_deals = self.scrape_nse_bulk_deals(date)
        
        all_deals = bse_deals + nse_deals
        
        # Sort by quantity (largest first)
        all_deals.sort(key=lambda x: x.get('quantity', 0), reverse=True)
        
        return all_deals
    
    def get_date_range_deals(self, start_date: str, end_date: str) -> List[Dict]:
        """
        Get bulk deals for a date range
        
        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
        
        Returns:
            List of all bulk deals in the date range
        """
        all_deals = []
        
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')
        
        current = start
        while current <= end:
            date_str = current.strftime('%Y-%m-%d')
            deals = self.get_combined_bulk_deals(date_str)
            all_deals.extend(deals)
            current += timedelta(days=1)
        
        return all_deals
    
    def get_company_bulk_deals(self, scrip_code: str, days: int = 30) -> List[Dict]:
        """
        Get bulk deals for a specific company for last N days
        
        Args:
            scrip_code: Company scrip code
            days: Number of days to look back
        
        Returns:
            List of bulk deals for the company
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        all_deals = self.get_date_range_deals(
            start_date.strftime('%Y-%m-%d'),
            end_date.strftime('%Y-%m-%d')
        )
        
        # Filter for specific company
        company_deals = [
            deal for deal in all_deals 
            if deal.get('scrip_code', '').upper() == scrip_code.upper()
        ]
        
        return company_deals
    
    @staticmethod
    def _parse_number(value: str) -> int:
        """Parse number from string (handles commas)"""
        try:
            return int(str(value).replace(',', '').replace(' ', ''))
        except (ValueError, AttributeError):
            return 0
    
    @staticmethod
    def _parse_float(value: str) -> float:
        """Parse float from string (handles commas)"""
        try:
            return float(str(value).replace(',', '').replace(' ', ''))
        except (ValueError, AttributeError):
            return 0.0


def main():
    """Test the bulk deals scraper"""
    scraper = BulkDealsScraper()
    
    print("🔍 Fetching today's bulk deals...")
    deals = scraper.get_combined_bulk_deals()
    
    print(f"\n✅ Found {len(deals)} bulk deals\n")
    
    for i, deal in enumerate(deals[:10], 1):
        print(f"{i}. {deal['security_name']}")
        print(f"   Exchange: {deal['exchange']}")
        print(f"   Client: {deal['client_name']}")
        print(f"   Type: {deal['deal_type']}")
        print(f"   Quantity: {deal['quantity']:,}")
        print(f"   Price: ₹{deal['trade_price']:.2f}")
        print()


if __name__ == '__main__':
    main()

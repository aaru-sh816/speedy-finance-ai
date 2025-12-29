"""
SPEEDY FINANCE - Ultra High-Performance BSE/NSE Data API Service
World-Class Financial Backend with PDF Intelligence, Real-Time Quotes & Institutional Analytics
"""
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from functools import wraps, lru_cache
from datetime import datetime, timedelta
import json
import os
import time
import logging
import hashlib
import threading
import requests
import pdfplumber
import io
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from collections import OrderedDict
from bulk_deals_database import BulkDealsDatabase, create_database_api

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

THREAD_POOL = ThreadPoolExecutor(max_workers=10)

class LRUCache:
    def __init__(self, capacity=500, ttl_seconds=300):
        self.cache = OrderedDict()
        self.capacity = capacity
        self.ttl = ttl_seconds
        self.lock = threading.Lock()
    
    def _make_key(self, key):
        return hashlib.md5(str(key).encode()).hexdigest()
    
    def get(self, key):
        hkey = self._make_key(key)
        with self.lock:
            if hkey not in self.cache:
                return None
            item = self.cache[hkey]
            if time.time() - item['timestamp'] > self.ttl:
                del self.cache[hkey]
                return None
            self.cache.move_to_end(hkey)
            return item['value']
    
    def set(self, key, value):
        hkey = self._make_key(key)
        with self.lock:
            if hkey in self.cache:
                del self.cache[hkey]
            elif len(self.cache) >= self.capacity:
                self.cache.popitem(last=False)
            self.cache[hkey] = {'value': value, 'timestamp': time.time()}

quote_cache = LRUCache(capacity=1000, ttl_seconds=60)
pdf_cache = LRUCache(capacity=200, ttl_seconds=3600)

rate_limit_store = {}
rate_limit_lock = threading.Lock()

def rate_limit(max_requests=100, window_seconds=60):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            client_ip = request.remote_addr or 'unknown'
            current_time = time.time()
            key = f"{client_ip}:{f.__name__}"
            
            with rate_limit_lock:
                if key in rate_limit_store:
                    requests_list = rate_limit_store[key]
                    requests_list = [t for t in requests_list if current_time - t < window_seconds]
                    rate_limit_store[key] = requests_list
                else:
                    requests_list = []
                    rate_limit_store[key] = requests_list
                
                if len(requests_list) >= max_requests:
                    return jsonify({
                        'success': False,
                        'error': 'Rate limit exceeded',
                        'retry_after': window_seconds
                    }), 429
                
                rate_limit_store[key].append(current_time)
            
            return f(*args, **kwargs)
        return wrapper
    return decorator

def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate'
    return response

@app.after_request
def after_request(response):
    return add_security_headers(response)

try:
    from bsedata.bse import BSE
    bse = BSE(update_codes=False)
    BSE_AVAILABLE = True
    logger.info("BSE data service initialized successfully")
except ImportError:
    bse = None
    BSE_AVAILABLE = False
    logger.warning("bsedata not available - market data endpoints disabled")

# Initialize Bulk Deals Database
db_manager = BulkDealsDatabase()
create_database_api(app, db_manager)

def load_database():
    return db_manager.database

def invalidate_db_cache():
    pass # Managed by BulkDealsDatabase

@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'service': 'Speedy Finance API',
        'version': '2.0.0',
        'status': 'operational',
        'timestamp': datetime.now().isoformat(),
        'endpoints': {
            'health': '/health',
            'quote': '/api/quote/<scrip_code>',
            'gainers': '/api/gainers',
            'losers': '/api/losers',
            'bulk_deals': '/api/bulk-deals/database',
            'pdf_extract': '/api/pdf/extract',
            'company_details': '/api/company/<scrip_code>',
            'announcements': '/api/announcements'
        },
        'features': [
            'Real-time BSE/NSE quotes with 60s cache',
            'PDF text extraction & table parsing',
            'Bulk deals database with filtering',
            'Rate limiting (100 req/min)',
            'Thread-pooled concurrent processing',
            'LRU caching for performance'
        ]
    })

@app.route('/health', methods=['GET'])
def health():
    db = load_database()
    return jsonify({
        'status': 'healthy',
        'service': 'speedy-finance-backend',
        'version': '2.0.0',
        'timestamp': datetime.now().isoformat(),
        'bse_available': BSE_AVAILABLE,
        'cache_stats': {
            'quote_cache_size': len(quote_cache.cache),
            'pdf_cache_size': len(pdf_cache.cache)
        },
        'database': {
            'total_deals': len(db.get('deals', [])),
            'last_updated': db.get('metadata', {}).get('last_updated')
        }
    })

@app.route('/api/gainers', methods=['GET'])
@rate_limit(max_requests=60, window_seconds=60)
def get_gainers():
    if not BSE_AVAILABLE:
        return jsonify({'success': False, 'error': 'BSE service not available'}), 503
    
    cached = quote_cache.get('gainers')
    if cached:
        return jsonify({'success': True, 'data': cached, 'count': len(cached), 'cached': True})
    
    try:
        gainers = bse.topGainers()
        quote_cache.set('gainers', gainers)
        return jsonify({'success': True, 'data': gainers, 'count': len(gainers), 'cached': False})
    except Exception as e:
        logger.error(f"Error fetching gainers: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/losers', methods=['GET'])
@rate_limit(max_requests=60, window_seconds=60)
def get_losers():
    if not BSE_AVAILABLE:
        return jsonify({'success': False, 'error': 'BSE service not available'}), 503
    
    cached = quote_cache.get('losers')
    if cached:
        return jsonify({'success': True, 'data': cached, 'count': len(cached), 'cached': True})
    
    try:
        losers = bse.topLosers()
        quote_cache.set('losers', losers)
        return jsonify({'success': True, 'data': losers, 'count': len(losers), 'cached': False})
    except Exception as e:
        logger.error(f"Error fetching losers: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/quote/<scrip_code>', methods=['GET'])
@rate_limit(max_requests=120, window_seconds=60)
def get_quote(scrip_code):
    if not BSE_AVAILABLE:
        return jsonify({'success': False, 'error': 'BSE service not available'}), 503
    
    cache_key = f'quote:{scrip_code}'
    cached = quote_cache.get(cache_key)
    if cached:
        return jsonify({'success': True, 'data': cached, 'cached': True})
    
    try:
        quote_data = bse.getQuote(scrip_code)
        if quote_data:
            quote_cache.set(cache_key, quote_data)
        return jsonify({'success': True, 'data': quote_data, 'cached': False})
    except Exception as e:
        logger.error(f"Error fetching quote for {scrip_code}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/pdf/extract', methods=['POST'])
@rate_limit(max_requests=30, window_seconds=60)
def extract_pdf():
    try:
        pdf_url = None
        
        data = request.get_json(force=True, silent=True)
        if data and isinstance(data, dict):
            pdf_url = data.get('url')
        
        if not pdf_url and request.form:
            pdf_url = request.form.get('url')
        
        if not pdf_url and request.data:
            try:
                raw = request.data.decode('utf-8')
                if 'url=' in raw:
                    pdf_url = raw.split('url=')[1].split('&')[0]
            except:
                pass
        if not pdf_url:
            return jsonify({'success': False, 'error': 'PDF URL required'}), 400
        
        # Clean URL: strip quotes, spaces, and %22 (encoded quote)
        pdf_url = pdf_url.strip().replace('"', '').replace("'", "").replace('%22', '')
        
        # Further clean BSE URLs that might have trailing junk after .pdf or malformed UUIDs
        if 'bseindia.com' in pdf_url.lower() and '.pdf' in pdf_url.lower():
            # Keep only until .pdf
            pdf_url = pdf_url.split('.pdf')[0] + '.pdf'
        
        cache_key = f'pdf:{hashlib.md5(pdf_url.encode()).hexdigest()}'
        cached = pdf_cache.get(cache_key)
        if cached:
            return jsonify({'success': True, **cached, 'cached': True})
        
        def fetch_and_parse():
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/pdf,*/*',
                'Referer': 'https://www.bseindia.com/'
            }
            
            response = requests.get(pdf_url, headers=headers, timeout=30)
            response.raise_for_status()
            
            pdf_bytes = io.BytesIO(response.content)
            
            full_text = []
            tables = []
            page_count = 0
            
            with pdfplumber.open(pdf_bytes) as pdf:
                page_count = len(pdf.pages)
                for i, page in enumerate(pdf.pages[:20]):
                    text = page.extract_text() or ''
                    full_text.append({
                        'page': i + 1,
                        'text': text
                    })
                    
                    page_tables = page.extract_tables() or []
                    for j, table in enumerate(page_tables):
                        if table and len(table) > 0:
                            headers = table[0] if table else []
                            rows = table[1:] if len(table) > 1 else []
                            tables.append({
                                'page': i + 1,
                                'table_index': j,
                                'headers': headers,
                                'rows': rows,
                                'row_count': len(rows)
                            })
            
            combined_text = '\n\n'.join([p['text'] for p in full_text])
            
            numbers = re.findall(r'[\d,]+\.?\d*', combined_text)
            financial_figures = []
            for num in numbers:
                try:
                    cleaned = num.replace(',', '')
                    if '.' in cleaned:
                        val = float(cleaned)
                    else:
                        val = int(cleaned)
                    if val > 1000:
                        financial_figures.append(val)
                except:
                    pass
            
            return {
                'pages': full_text,
                'text': combined_text,
                'tables': tables,
                'page_count': page_count,
                'text_preview': combined_text[:2000],
                'financial_figures': sorted(set(financial_figures), reverse=True)[:50],
                'extracted_at': datetime.now().isoformat()
            }
        
        future = THREAD_POOL.submit(fetch_and_parse)
        try:
            result = future.result(timeout=45)
            pdf_cache.set(cache_key, result)
            return jsonify({'success': True, **result, 'cached': False})
        except FuturesTimeoutError:
            return jsonify({'success': False, 'error': 'PDF extraction timed out'}), 504
        
    except requests.exceptions.RequestException as e:
        logger.error(f"PDF download error: {e}")
        return jsonify({'success': False, 'error': f'Failed to download PDF: {str(e)}'}), 502
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/company/<scrip_code>', methods=['GET'])
@rate_limit(max_requests=60, window_seconds=60)
def get_company_details(scrip_code):
    if not BSE_AVAILABLE:
        return jsonify({'success': False, 'error': 'BSE service not available'}), 503
    
    cache_key = f'company:{scrip_code}'
    cached = quote_cache.get(cache_key)
    if cached:
        return jsonify({'success': True, 'data': cached, 'cached': True})
    
    try:
        quote_data = bse.getQuote(scrip_code)
        
        company_data = {
            'scrip_code': scrip_code,
            'quote': quote_data,
            'fetched_at': datetime.now().isoformat()
        }
        
        quote_cache.set(cache_key, company_data)
        return jsonify({'success': True, 'data': company_data, 'cached': False})
    except Exception as e:
        logger.error(f"Error fetching company {scrip_code}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/announcements', methods=['GET'])
@rate_limit(max_requests=60, window_seconds=60)
def get_announcements():
    scrip_code = request.args.get('scrip_code')
    category = request.args.get('category')
    from_date = request.args.get('from')
    to_date = request.args.get('to')
    
    return jsonify({
        'success': True,
        'message': 'Announcements are fetched via BSE API proxy in Next.js',
        'hint': 'Use /api/bse/announcements in the Next.js frontend',
        'params_received': {
            'scrip_code': scrip_code,
            'category': category,
            'from_date': from_date,
            'to_date': to_date
        }
    })

@app.route('/api/bulk-deals/stats', methods=['GET'])
def get_stats():
    db = load_database()
    deals = db.get('deals', [])
    
    bse_count = len([d for d in deals if d.get('exchange', '').upper() == 'BSE'])
    nse_count = len([d for d in deals if d.get('exchange', '').upper() == 'NSE'])
    
    buy_count = len([d for d in deals if d.get('dealType', '').upper() == 'B'])
    sell_count = len([d for d in deals if d.get('dealType', '').upper() == 'S'])
    
    dates = [d.get('date', '') for d in deals if d.get('date')]
    
    total_value = sum(d.get('value', 0) for d in deals)
    
    return jsonify({
        'success': True,
        'total_deals': len(deals),
        'bse_deals': bse_count,
        'nse_deals': nse_count,
        'buy_deals': buy_count,
        'sell_deals': sell_count,
        'total_value': total_value,
        'date_range': {
            'earliest': min(dates) if dates else None,
            'latest': max(dates) if dates else None
        },
        'metadata': db.get('metadata', {})
    })

@app.route('/api/bulk-deals/search', methods=['GET'])
@rate_limit(max_requests=60, window_seconds=60)
def search_deals():
    query = request.args.get('q', '').lower()
    limit = request.args.get('limit', type=int, default=100)
    
    if len(query) < 2:
        return jsonify({'success': False, 'error': 'Query too short (min 2 chars)'}), 400
    
    db = load_database()
    deals = db.get('deals', [])
    
    results = []
    for deal in deals:
        scrip_name = deal.get('scripName', '').lower()
        client_name = deal.get('clientName', '').lower()
        
        if query in scrip_name or query in client_name:
            results.append(deal)
            if len(results) >= limit:
                break
    
    return jsonify({
        'success': True,
        'query': query,
        'results': results,
        'count': len(results)
    })

@app.route('/api/cache/clear', methods=['POST'])
def clear_cache():
    auth = request.headers.get('Authorization')
    if auth != 'Bearer speedy-admin-key':
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    quote_cache.cache.clear()
    pdf_cache.cache.clear()
    invalidate_db_cache()
    
    return jsonify({
        'success': True,
        'message': 'All caches cleared'
    })

@app.errorhandler(404)
def not_found(e):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found',
        'available_endpoints': [
            '/', '/health', '/api/quote/<scrip_code>',
            '/api/gainers', '/api/losers',
            '/api/pdf/extract', '/api/bulk-deals/database',
            '/api/bulk-deals/stats', '/api/bulk-deals/search',
            '/api/company/<scrip_code>', '/api/announcements'
        ]
    }), 404

@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal server error: {e}")
    return jsonify({
        'success': False,
        'error': 'Internal server error',
        'message': str(e)
    }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    logger.info(f"Starting Speedy Finance API v2.0.0 on port {port}")
    logger.info(f"BSE Data Service: {'Available' if BSE_AVAILABLE else 'Unavailable'}")
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)

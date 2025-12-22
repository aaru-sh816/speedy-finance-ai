"""
BSE Data Microservice
Provides real-time BSE market data using the bsedata library
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import sys
import os
import json
from datetime import datetime

# Try importing bsedata from pip package first, then local
try:
    from bsedata.bse import BSE
except ImportError:
    # Fallback to local path for development
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bsedata'))
    try:
        from bsedata.bse import BSE
    except ImportError as e:
        print(f"WARNING: bsedata library not found: {e}")
        BSE = None

# Import bulk deals modules (scraper may fail without Selenium, that's OK)
try:
    from bulk_deals_scraper import BulkDealsScraper
    bulk_deals_scraper = BulkDealsScraper()
except Exception as e:
    print(f"WARNING: BulkDealsScraper not available: {e}")
    bulk_deals_scraper = None

from bulk_deals_database import BulkDealsDatabase, initialize_database, create_database_api

app = Flask(__name__)
CORS(app)

# Initialize BSE if available
bse = BSE(update_codes=False) if BSE else None

# Initialize bulk deals database with scheduler
bulk_deals_db = initialize_database()
create_database_api(app, bulk_deals_db)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'bse_data_service',
        'version': '1.0.0'
    })

@app.route('/api/quote/<scrip_code>', methods=['GET'])
def get_quote(scrip_code):
    """Get live quote for a stock"""
    if not bse:
        return jsonify({'success': False, 'error': 'BSE service not available'}), 503
    try:
        quote_data = bse.getQuote(scrip_code)
        return jsonify({
            'success': True,
            'data': quote_data
        })
    except Exception as e:
        # Fallback: Try direct BSE API fetch
        try:
            import requests
            url = f"https://api.bseindia.com/BseIndiaAPI/api/StockReachGraph/w?scripcode={scrip_code}&flag=0&fromdate=&todate=&seression=COM"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.bseindia.com/',
                'Accept': 'application/json'
            }
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                return jsonify({
                    'success': True,
                    'data': data,
                    'source': 'direct_api'
                })
        except:
            pass
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/gainers', methods=['GET'])
def get_gainers():
    """Get top gainers"""
    if not bse:
        return jsonify({'success': False, 'error': 'BSE service not available'}), 503
    try:
        gainers = bse.topGainers()
        return jsonify({
            'success': True,
            'data': gainers,
            'count': len(gainers)
        })
    except Exception as e:
        # Fallback: Try direct BSE API
        try:
            import requests
            url = "https://api.bseindia.com/BseIndiaAPI/api/StockReachGraph/w?scripcode=&flag=0&fromdate=&todate=&seression=COM"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.bseindia.com/',
            }
            # Return empty list as fallback (API may not have direct gainers endpoint)
            return jsonify({
                'success': True,
                'data': [],
                'count': 0,
                'source': 'fallback',
                'message': 'BSE API temporarily unavailable'
            })
        except:
            pass
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/losers', methods=['GET'])
def get_losers():
    """Get top losers"""
    if not bse:
        return jsonify({'success': False, 'error': 'BSE service not available'}), 503
    try:
        losers = bse.topLosers()
        return jsonify({
            'success': True,
            'data': losers,
            'count': len(losers)
        })
    except Exception as e:
        # Fallback: Return empty list gracefully
        try:
            return jsonify({
                'success': True,
                'data': [],
                'count': 0,
                'source': 'fallback',
                'message': 'BSE API temporarily unavailable'
            })
        except:
            pass
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/indices', methods=['GET'])
def get_indices():
    """Get BSE indices for a category"""
    category = request.args.get('category', 'market_cap/broad')
    
    valid_categories = [
        'market_cap/broad',
        'sector_and_industry',
        'thematics',
        'strategy',
        'sustainability',
        'volatility',
        'composite',
        'government',
        'corporate',
        'money_market'
    ]
    
    if category not in valid_categories:
        return jsonify({
            'success': False,
            'error': f'Invalid category. Valid categories: {", ".join(valid_categories)}'
        }), 400
    
    if not bse:
        return jsonify({'success': False, 'error': 'BSE service not available'}), 503
    try:
        indices_data = bse.getIndices(category)
        return jsonify({
            'success': True,
            'data': indices_data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/verify-scrip/<code>', methods=['GET'])
def verify_scrip(code):
    """Verify if a scrip code is valid"""
    if not bse:
        return jsonify({'success': False, 'error': 'BSE service not available'}), 503
    try:
        company_name = bse.verifyScripCode(code)
        if company_name:
            return jsonify({
                'success': True,
                'valid': True,
                'scripCode': code,
                'companyName': company_name
            })
        else:
            return jsonify({
                'success': True,
                'valid': False,
                'scripCode': code
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/bhav-copy', methods=['GET'])
def get_bhav_copy():
    """Get historical OHLCV data from Bhav Copy"""
    date_str = request.args.get('date')
    
    if not date_str:
        return jsonify({
            'success': False,
            'error': 'Date parameter required in YYYY-MM-DD format'
        }), 400
    
    if not bse:
        return jsonify({'success': False, 'error': 'BSE service not available'}), 503
    try:
        from datetime import datetime
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        bhav_data = bse.getBhavCopyData(date_obj)
        return jsonify({
            'success': True,
            'data': bhav_data,
            'count': len(bhav_data)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/bulk-deals', methods=['GET'])
def get_bulk_deals():
    """Get bulk deals for a specific date"""
    try:
        date = request.args.get('date')
        if not date:
            # Default to today's date
            date = datetime.now().strftime('%Y-%m-%d')
        
        # Try to load from cached file first (for automatic downloads)
        data_dir = os.path.join(os.path.dirname(__file__), 'data', 'bulk-deals')
        cache_file = os.path.join(data_dir, f'bulk_deals_{date}.json')
        
        if os.path.exists(cache_file):
            print(f"[BSE Service] Loading bulk deals from cache: {cache_file}")
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
                return jsonify({
                    "success": True,
                    "date": date,
                    "count": cached_data.get('count', 0),
                    "data": cached_data.get('deals', []),
                    "cached": True,
                    "downloaded_at": cached_data.get('downloaded_at')
                })
        
        # If not cached, scrape fresh data
        print(f"[BSE Service] Fetching bulk deals for date: {date}")
        deals = bulk_deals_scraper.scrape_bulk_deals(date)
        
        return jsonify({
            "success": True,
            "date": date,
            "count": len(deals),
            "data": deals,
            "cached": False
        })
    except Exception as e:
        print(f"[BSE Service] Error fetching bulk deals: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/bulk-deals/company/<scrip_code>', methods=['GET'])
def get_company_bulk_deals(scrip_code):
    """Get bulk deals for a specific company"""
    days = request.args.get('days', 30, type=int)
    
    try:
        deals = bulk_deals_scraper.get_company_bulk_deals(scrip_code, days)
        return jsonify({
            'success': True,
            'data': deals,
            'count': len(deals),
            'scripCode': scrip_code,
            'days': days
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500

@app.route('/api/pdf/extract', methods=['POST'])
def extract_pdf_text():
    """Extract text from a PDF URL using Python libraries"""
    try:
        data = request.get_json()
        pdf_url = data.get('url')
        
        if not pdf_url:
            return jsonify({'success': False, 'error': 'URL required'}), 400
        
        import requests
        import io
        
        # Try to import PyPDF2 or pdfplumber
        try:
            import pdfplumber
            use_pdfplumber = True
        except ImportError:
            try:
                import PyPDF2
                use_pdfplumber = False
            except ImportError:
                return jsonify({'success': False, 'error': 'No PDF library available'}), 500
        
        # Fetch PDF with browser-like headers
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/pdf,*/*',
            'Referer': 'https://www.bseindia.com/',
        }
        
        response = requests.get(pdf_url, headers=headers, timeout=30)
        if response.status_code != 200:
            return jsonify({'success': False, 'error': f'HTTP {response.status_code}'}), 400
        
        pdf_bytes = io.BytesIO(response.content)
        text = ""
        
        if use_pdfplumber:
            with pdfplumber.open(pdf_bytes) as pdf:
                for i, page in enumerate(pdf.pages[:30]):  # Max 30 pages
                    page_text = page.extract_text() or ""
                    text += page_text + "\n"
                    if len(text) > 150000:
                        break
        else:
            reader = PyPDF2.PdfReader(pdf_bytes)
            for i, page in enumerate(reader.pages[:30]):
                page_text = page.extract_text() or ""
                text += page_text + "\n"
                if len(text) > 150000:
                    break
        
        text = text.strip()
        
        return jsonify({
            'success': True,
            'text': text,
            'length': len(text),
            'library': 'pdfplumber' if use_pdfplumber else 'PyPDF2'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    print(f"🚀 BSE Data Microservice starting on port {port}")
    print(f"📊 Endpoints available:")
    print(f"   GET /health - Health check")
    print(f"   GET /api/quote/<scrip_code> - Live quote with full metrics")
    print(f"   GET /api/gainers - Top gainers")
    print(f"   GET /api/losers - Top losers")
    print(f"   GET /api/indices?category=<category> - BSE indices")
    print(f"   GET /api/verify-scrip/<code> - Verify scrip code")
    print(f"   GET /api/bhav-copy?date=YYYY-MM-DD - Historical OHLCV")
    print(f"   GET /api/bulk-deals?date=YYYY-MM-DD&exchange=bse|nse|both - Bulk deals")
    print(f"   GET /api/bulk-deals/company/<scrip_code>?days=30 - Company bulk deals")
    print(f"   POST /api/pdf/extract - Extract text from PDF URL")
    
    app.run(host='0.0.0.0', port=port, debug=debug)

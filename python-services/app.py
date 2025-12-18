"""
Minimal BSE Bulk Deals API Service
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Load bulk deals database
DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'data', 'bulk-deals', 'bulk_deals_database.json')

def load_database():
    """Load the bulk deals database"""
    if os.path.exists(DATABASE_PATH):
        with open(DATABASE_PATH, 'r') as f:
            return json.load(f)
    return {'deals': [], 'metadata': {}}

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'speedy-finance-backend',
        'version': '1.0.0'
    })

@app.route('/api/bulk-deals/database', methods=['GET'])
def get_database_deals():
    """Get all deals from database with optional filtering"""
    db = load_database()
    deals = db.get('deals', [])
    
    # Filter by date range if provided
    start_date = request.args.get('start')
    end_date = request.args.get('end')
    exchange = request.args.get('exchange')
    
    if start_date:
        deals = [d for d in deals if d.get('date', '') >= start_date]
    if end_date:
        deals = [d for d in deals if d.get('date', '') <= end_date]
    if exchange:
        deals = [d for d in deals if d.get('exchange', '').upper() == exchange.upper()]
    
    return jsonify({
        'success': True,
        'deals': deals,
        'count': len(deals),
        'metadata': db.get('metadata', {})
    })

@app.route('/api/bulk-deals/stats', methods=['GET'])
def get_stats():
    """Get database statistics"""
    db = load_database()
    deals = db.get('deals', [])
    
    # Count by exchange
    bse_count = len([d for d in deals if d.get('exchange', '').upper() == 'BSE'])
    nse_count = len([d for d in deals if d.get('exchange', '').upper() == 'NSE'])
    
    # Get date range
    dates = [d.get('date', '') for d in deals if d.get('date')]
    
    return jsonify({
        'success': True,
        'total_deals': len(deals),
        'bse_deals': bse_count,
        'nse_deals': nse_count,
        'date_range': {
            'earliest': min(dates) if dates else None,
            'latest': max(dates) if dates else None
        },
        'metadata': db.get('metadata', {})
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)

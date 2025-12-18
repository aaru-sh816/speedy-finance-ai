"""
Vercel Serverless Python Function for Bulk Deals API
"""
import json
import os
from http.server import BaseHTTPRequestHandler

# Load database from file
DATABASE_PATH = os.path.join(os.path.dirname(__file__), '..', 'python-services', 'data', 'bulk-deals', 'bulk_deals_database.json')

def load_database():
    if os.path.exists(DATABASE_PATH):
        with open(DATABASE_PATH, 'r') as f:
            return json.load(f)
    return {'deals': [], 'metadata': {}}

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        db = load_database()
        response = {
            'success': True,
            'deals': db.get('deals', []),
            'count': len(db.get('deals', [])),
            'metadata': db.get('metadata', {})
        }
        self.wfile.write(json.dumps(response).encode())
        return
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        return

# Deployment Guide - Speedy Finance AI

## 🚀 Complete Setup & Deployment

### **Local Development**

#### 1. Python Services (Port 5000)
```bash
cd python-services
pip install -r requirements.txt
python bse_service.py
```

#### 2. Bulk Deals Scheduler (Optional - runs automatically at 6:02 PM)
```bash
cd python-services
python scheduler.py
```

#### 3. Next.js Frontend (Port 3001)
```bash
cd speedy-finance-ai
npm install
npm run dev
```

### **Environment Variables**

**`.env.local` (Next.js)**
```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo-preview
BSE_SERVICE_URL=http://localhost:5000
NEXT_PUBLIC_BSE_SERVICE_URL=http://localhost:5000
```

**Python Services**
- No additional env vars needed
- Uses local BSE data library

### **Automatic Bulk Deals**

The scheduler automatically downloads bulk deals CSV daily at **6:02 PM IST**:
- Downloads to: `python-services/data/bulk-deals/bulk_deals_YYYY-MM-DD.json`
- Also saves as `latest.json` for quick access
- Frontend checks cache first before scraping

### **Key Features Implemented**

1. **Icon-Based Navigation** (Image 6 style)
   - Home, Market, Announcements, Bulk Deals, Corporate Actions
   - Active state highlighting with cyan glow
   - Floating pill design

2. **Market Page**
   - Market Movers (Top Gainers/Losers)
   - Real-time BSE data
   - Clean card-based layout
   - Links to company pages

3. **Bulk Deals Dashboard**
   - Fey-inspired premium dark theme
   - Stats cards (Buy/Sell value, Companies, Clients)
   - Advanced filters (Search, Trade Type, Date)
   - Pagination (50 per page)
   - Automatic daily updates at 6:02 PM

4. **BSE Quote Integration**
   - Replaced RapidAPI with BSE quote API
   - Full data: Price, Volume, Market Cap, 52-week range
   - Cached for performance (45s TTL)
   - Used across entire app

5. **Chat Panel Bug Fix**
   - Chat state resets when switching companies
   - Clean conversation for each stock

### **API Endpoints**

**BSE Service (Python - Port 5000)**
- `GET /api/quote/<scrip_code>` - Live quote with full metrics
- `GET /api/gainers` - Top gainers
- `GET /api/losers` - Top losers
- `GET /api/bulk-deals?date=YYYY-MM-DD` - Bulk deals (cached)
- `GET /health` - Health check

**Next.js API (Port 3001)**
- `GET /api/bse/quote?symbol=<symbol>` - Proxies to BSE service
- `GET /api/bse/market-movers?type=gainers|losers` - Market movers
- `GET /api/bse/announcements` - Company announcements
- `GET /api/ai/chat` - AI chat with PDF context
- `GET /api/ai/summary` - AI announcement summaries

### **Deployment**

#### **Railway (Python Services)**
```bash
# In python-services directory
railway up
```

**Railway Environment Variables:**
```
PORT=5000
PYTHON_VERSION=3.11
```

#### **Vercel (Next.js Frontend)**
```bash
vercel deploy --prod
```

**Vercel Environment Variables:**
```
OPENAI_API_KEY=<your_key>
OPENAI_MODEL=gpt-4-turbo-preview
BSE_SERVICE_URL=<railway_url>
NEXT_PUBLIC_BSE_SERVICE_URL=<railway_url>
```

### **Scheduler Deployment**

For production, run scheduler as a separate process:

**Option 1: PM2 (Linux/Mac)**
```bash
pm2 start scheduler.py --name bulk-deals-scheduler --interpreter python3
pm2 save
pm2 startup
```

**Option 2: Windows Service**
```bash
# Install NSSM (Non-Sucking Service Manager)
nssm install BulkDealsScheduler "C:\Python311\python.exe" "D:\path\to\scheduler.py"
nssm start BulkDealsScheduler
```

**Option 3: Docker**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "scheduler.py"]
```

### **Monitoring**

Check scheduler logs:
```bash
# Local
tail -f python-services/data/bulk-deals/scheduler.log

# PM2
pm2 logs bulk-deals-scheduler
```

### **Testing**

```bash
# Test BSE service
curl http://localhost:5000/health
curl http://localhost:5000/api/quote/500325

# Test bulk deals
curl http://localhost:5000/api/bulk-deals?date=2025-12-16

# Test Next.js
curl http://localhost:3001/api/bse/quote?symbol=RELIANCE
```

### **Troubleshooting**

1. **Bulk deals not loading**
   - Check if Python service is running on port 5000
   - Verify scheduler has created cache files
   - Check browser console for errors

2. **Quotes not showing**
   - Ensure BSE_SERVICE_URL is set correctly
   - Check Python service health endpoint
   - Verify scrip code is valid

3. **Scheduler not running**
   - Check if Chrome/Chromedriver is installed
   - Verify selenium dependencies
   - Check scheduler logs for errors

### **Production Checklist**

- [ ] Python service running on Railway
- [ ] Next.js deployed to Vercel
- [ ] Environment variables configured
- [ ] Scheduler running (PM2/Docker/Service)
- [ ] Health checks passing
- [ ] Cache directory created
- [ ] Logs monitored
- [ ] SSL/HTTPS enabled

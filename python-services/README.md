# BSE Data Microservice

Python Flask microservice providing real-time BSE market data using the `bsedata` library.

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run the service
python bse_service.py
```

The service will start on `http://localhost:5000`

## Docker Build

```bash
# Build the image
docker build -t speedy-bse-service .

# Run the container
docker run -p 5000:5000 speedy-bse-service
```

## Deployment to Railway

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Create new project: `railway init`
4. Deploy: `railway up`

## API Endpoints

- `GET /health` - Health check
- `GET /api/quote/<scrip_code>` - Get live quote
- `GET /api/gainers` - Top gainers
- `GET /api/losers` - Top losers
- `GET /api/indices?category=<category>` - BSE indices
- `GET /api/verify-scrip/<code>` - Verify scrip code
- `GET /api/bhav-copy?date=YYYY-MM-DD` - Historical OHLCV

## Environment Variables

- `PORT` - Port to run on (default: 5000)
- `DEBUG` - Enable debug mode (default: False)

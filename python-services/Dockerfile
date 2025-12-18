FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all service files
COPY bse_service.py .
COPY bulk_deals_database.py .
COPY bulk_deals_scraper.py .
COPY data/ data/

# Create data directory if not exists
RUN mkdir -p data/bulk-deals

EXPOSE 10000

CMD gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 120 bse_service:app

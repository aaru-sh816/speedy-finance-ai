FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all Python service files
COPY bse_service.py .
COPY bulk_deals_scraper.py .
COPY bulk_deals_database.py .
COPY daily_update.py .
COPY scheduler.py .

# Create data directory
RUN mkdir -p data/bulk-deals

ENV PORT=8080
ENV DEBUG=False

EXPOSE 8080

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "300", "bse_service:app"]

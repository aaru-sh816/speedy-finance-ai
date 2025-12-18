FROM python:3.11-slim

# Install Chrome and dependencies for Selenium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

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

# Copy existing database if available
COPY data/ data/ 2>/dev/null || true

ENV PORT=8080
ENV DEBUG=False
ENV CHROME_BIN=/usr/bin/google-chrome
ENV DISPLAY=:99

EXPOSE 8080

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "300", "bse_service:app"]

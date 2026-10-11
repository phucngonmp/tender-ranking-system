FROM python:3.11-slim

WORKDIR /app

# System deps required by Playwright/Chromium + Xvfb (virtual display so the
# muasamcong client can launch Chromium headed=False without a real screen)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg ca-certificates xvfb xauth \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Installs Playwright's Chromium + OS-level deps needed to run it
RUN crawl4ai-setup

COPY app ./app
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

RUN mkdir -p /app/data

EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

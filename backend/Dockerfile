FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads

EXPOSE 8003
# Live-update streams stay open for hours; they must not delay a redeploy by more than 5 s
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003", "--timeout-graceful-shutdown", "5"]

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
# --forwarded-allow-ips: the API sits behind nginx, so take the visitor's real address from X-Forwarded-For;
# without it every visitor shares nginx's address and the per-IP rate limits would lock everyone out together.
# (Only nginx can reach this port: compose publishes it on 127.0.0.1, so the header cannot be forged from outside.)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003", "--timeout-graceful-shutdown", "5", "--proxy-headers", "--forwarded-allow-ips", "*"]

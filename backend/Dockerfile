# Densify Core Engine — FastAPI on python:3.13-slim (runs on LKE).
# email_service.py and llm_provider.py must be copied alongside main.py.
FROM python:3.13-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --upgrade pip && pip install --prefix=/install --no-cache-dir -r requirements.txt

FROM python:3.13-slim AS runtime
RUN addgroup --system densify && adduser --system --ingroup densify densify
WORKDIR /app
COPY --from=builder /install /usr/local
COPY main.py database.py analyzer.py email_service.py llm_provider.py ./
EXPOSE 8000
USER densify
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]

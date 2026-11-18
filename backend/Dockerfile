FROM python:3.12.7-slim AS builder

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12.7-slim

RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /home/appuser/.local
COPY --chown=appuser:appuser . .

# Card and dive photos (settings.upload_dir); docker-compose and Railway mount a volume here
RUN mkdir -p /app/data/uploads && chown -R appuser:appuser /app/data

USER appuser

# PYTHONUSERBASE lets any user find the packages: Railway runs the container as
# root (RAILWAY_RUN_UID=0) so it can write to the uploads volume
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUSERBASE=/home/appuser/.local \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Railway sets PORT; docker-compose overrides this command and uses 8000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

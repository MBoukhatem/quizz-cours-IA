FROM python:3.11-slim

# Build dependencies for sentence-transformers (tokenizers C extension, git for hf hub)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies before copying the full source (layer caching)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/ ./app/

# Create non-root user with a writable home for HF / sentence-transformers caches
RUN useradd --create-home --shell /bin/false appuser \
    && mkdir -p /app/.hf_cache \
    && chown -R appuser:appuser /app /home/appuser

ENV HF_HOME=/app/.hf_cache \
    TRANSFORMERS_CACHE=/app/.hf_cache \
    SENTENCE_TRANSFORMERS_HOME=/app/.hf_cache \
    XDG_CACHE_HOME=/app/.hf_cache

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8000"]

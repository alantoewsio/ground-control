# syntax=docker/dockerfile:1
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    GROUND_CONTROL_DOCKER=1 \
    GROUND_CONTROL_BIND_ADDRESS=0.0.0.0

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv

COPY pyproject.toml uv.lock README.md LICENSE ./
COPY app ./app
COPY main.py ./
COPY scripts/docker_healthcheck.py ./scripts/docker_healthcheck.py
COPY scripts/docker_tcp_probe.py ./scripts/docker_tcp_probe.py
COPY templates ./templates
COPY static ./static

RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000 8443

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python scripts/docker_healthcheck.py

CMD ["python", "main.py"]

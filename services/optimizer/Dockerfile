# SupplyPilot optimizer service. Build from the REPO ROOT (it needs data/seed):
#   docker build -f services/optimizer/Dockerfile -t supplypilot-optimizer .
#   docker run --rm -p 8000:8000 -e OPTIMIZER_API_KEY=... supplypilot-optimizer
FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never

WORKDIR /app
# Dependencies first (cached unless the lockfile changes).
COPY services/optimizer/pyproject.toml services/optimizer/uv.lock services/optimizer/.python-version ./
RUN uv sync --frozen --no-dev --no-install-project
COPY services/optimizer/README.md ./
COPY services/optimizer/src ./src
RUN uv sync --frozen --no-dev

# The catalog the optimizer prices against. Replace with real supplier data later.
COPY data/seed/demo_catalog.json /app/data/demo_catalog.json
ENV SUPPLYPILOT_CATALOG_PATH=/app/data/demo_catalog.json PATH="/app/.venv/bin:$PATH"

RUN useradd --system --uid 10001 app
USER app
EXPOSE 8000
# Hosts like Render/Railway/Fly inject $PORT; default 8000.
CMD ["sh", "-c", "exec uvicorn supplypilot_optimizer.api:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]

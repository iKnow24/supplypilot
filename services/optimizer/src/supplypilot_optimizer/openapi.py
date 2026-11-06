"""Print the OpenAPI schema (the contract the web app's TypeScript types are generated from).

uv run python -m supplypilot_optimizer.openapi > ../../docs/openapi.json
"""

from __future__ import annotations

import json

from .api import app


def main() -> None:
    print(json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=False))


if __name__ == "__main__":
    main()

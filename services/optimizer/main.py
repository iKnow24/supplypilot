"""Vercel entrypoint: the FastAPI app in src/supplypilot_optimizer (src layout).

Vercel looks for `app` in main.py at the project root. Locally, use
`uv run supplypilot-optimizer` instead.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from supplypilot_optimizer.api import app  # noqa: E402

__all__ = ["app"]

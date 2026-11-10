"""Vercel build step: bundle the shared catalog next to the service.

The catalog lives at the repo root (data/seed/demo_catalog.json), outside this Vercel
project's root directory. Copy it to data/seed/ here so catalog_path() finds it by walking
up from the package at runtime.
"""

import shutil
from pathlib import Path

here = Path(__file__).resolve().parent
source = here.parent.parent / "data" / "seed" / "demo_catalog.json"
target = here / "data" / "seed" / "demo_catalog.json"
target.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(source, target)
print(f"copied {source} -> {target}")

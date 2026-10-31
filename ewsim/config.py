from __future__ import annotations
import json
from pathlib import Path
from copy import deepcopy

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "default.json"

def load_config(path: str | Path | None = None) -> dict:
    p = Path(path) if path else DEFAULT_CONFIG_PATH
    with p.open("r", encoding="utf-8") as f:
        return json.load(f)

def merge_config(base: dict, override: dict | None) -> dict:
    out = deepcopy(base)
    if not override: return out
    def rec(dst, src):
        for k,v in src.items():
            if isinstance(v,dict) and isinstance(dst.get(k),dict): rec(dst[k],v)
            else: dst[k]=v
    rec(out, override)
    return out

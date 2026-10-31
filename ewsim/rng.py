from __future__ import annotations
import hashlib
import json
import numpy as np

def keyed_seed(seed: int, *keys) -> int:
    payload=json.dumps([int(seed),*keys],separators=(",",":"),default=str).encode()
    return int.from_bytes(hashlib.blake2b(payload,digest_size=8).digest(),"little")

def keyed_rng(seed: int, *keys) -> np.random.Generator:
    return np.random.default_rng(keyed_seed(seed,*keys))

def unit_hash(seed: int, *keys) -> float:
    return keyed_rng(seed,*keys).random()

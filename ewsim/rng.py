from __future__ import annotations

import hashlib
import json
from typing import Any

import numpy as np


def keyed_seed(seed: int, *keys: Any) -> int:
    """
    Generate a deterministic 64-bit seed from a base seed and keys.

    Identical inputs always produce the same seed, independently
    of the order in which simulations are executed.
    """
    payload = json.dumps(
        [int(seed), *keys],
        separators=(",", ":"),
        default=str,
    ).encode("utf-8")

    digest = hashlib.blake2b(
        payload,
        digest_size=8,
    ).digest()

    return int.from_bytes(
        digest,
        byteorder="little",
        signed=False,
    )


def keyed_rng(
    seed: int,
    *keys: Any,
) -> np.random.Generator:
    """
    Create an independent deterministic NumPy random generator.

    The generator does not depend on global NumPy random state.
    """
    derived_seed = keyed_seed(seed, *keys)

    return np.random.default_rng(derived_seed)


def unit_hash(seed: int, *keys: Any) -> float:
    """
    Return a deterministic pseudorandom value in [0, 1).
    """
    return float(keyed_rng(seed, *keys).random())
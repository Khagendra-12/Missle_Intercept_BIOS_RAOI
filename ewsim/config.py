from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any


DEFAULT_CONFIG_PATH = (
    Path(__file__).resolve().parents[1]
    / "config"
    / "default.json"
)


def load_config(path: str | Path | None = None) -> dict:
    """
    Load a JSON configuration file.

    If no path is provided, load the project's default configuration.
    """
    config_path = Path(path) if path is not None else DEFAULT_CONFIG_PATH

    if not config_path.is_file():
        raise FileNotFoundError(
            f"Configuration file not found: {config_path}"
        )

    try:
        with config_path.open("r", encoding="utf-8") as file:
            config = json.load(file)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Invalid JSON in configuration file "
            f"'{config_path}': {exc}"
        ) from exc

    if not isinstance(config, dict):
        raise ValueError(
            "Configuration root must be a JSON object."
        )

    return config


def merge_config(
    base: dict,
    override: dict | None,
) -> dict:
    """
    Recursively merge override values into a copy of base.

    Nested dictionaries are merged.
    Lists and scalar values are replaced.
    The original dictionaries are never modified.
    """
    if not isinstance(base, dict):
        raise TypeError("'base' configuration must be a dictionary.")

    if override is not None and not isinstance(override, dict):
        raise TypeError("'override' configuration must be a dictionary.")

    result = deepcopy(base)

    if override is None:
        return result

    def recursive_merge(destination: dict, source: dict) -> None:
        for key, value in source.items():
            if (
                isinstance(value, dict)
                and isinstance(destination.get(key), dict)
            ):
                recursive_merge(destination[key], value)
            else:
                destination[key] = deepcopy(value)

    recursive_merge(result, override)

    return result
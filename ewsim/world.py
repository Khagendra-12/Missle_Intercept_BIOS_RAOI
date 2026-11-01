from __future__ import annotations

from dataclasses import dataclass
from .rng import keyed_rng


# Python integers support arbitrary precision.
MAX_LAYER = 10**100


@dataclass(frozen=True)
class Civilization:
    i: int
    j: int
    layer: int
    hostile: bool
    defense: float
    identifier: str


class ProceduralWorld:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.seed = int(cfg["simulation"]["seed"])
        self.na = int(cfg["world"]["na"])
        self.tolerance = float(cfg["world"]["hostility_tolerance"])

        if self.na <= 0:
            raise ValueError("World dimension 'na' must be positive.")

        if self.tolerance < 0:
            raise ValueError("Hostility tolerance cannot be negative.")

    def validate_layer(self, layer: int) -> int:
        layer = int(layer)

        if layer < 0 or layer > MAX_LAYER:
            raise ValueError("Layer outside [0, 10^100].")

        return layer

    def cell_center_xy(self, i: int, j: int) -> tuple[float, float]:
        i = int(i)
        j = int(j)

        if not (0 <= i < self.na and 0 <= j < self.na):
            raise ValueError("Cell coordinates are outside the world.")

        return float(i) + 0.5, float(j) + 0.5

    def layer_difference(self, a: int, b: int) -> int:
        return self.validate_layer(a) - self.validate_layer(b)

    def civilization(self, i: int, j: int, layer: int) -> Civilization:
        i = int(i)
        j = int(j)
        layer = self.validate_layer(layer)

        if not (0 <= i < self.na and 0 <= j < self.na):
            raise ValueError("Cell coordinates are outside the world.")

        hostile = self.is_hostile(i, j, layer)

        # Identical baseline defense strength for all civilizations.
        defense = 1.0

        identifier = f"c-{i}-{j}-L{layer}"

        return Civilization(
            i=i,
            j=j,
            layer=layer,
            hostile=hostile,
            defense=defense,
            identifier=identifier,
        )

    def hostility_score(self, i: int, j: int, layer: int) -> float:
        layer = self.validate_layer(layer)

        rng = keyed_rng(
            self.seed,
            "hostility-score",
            int(i),
            int(j),
            layer,
        )

        return float(rng.random())

    def is_hostile(self, i: int, j: int, layer: int) -> bool:
        # TEMPORARY: retain the existing placeholder until the
        # specified exponential/sine/cosine hostility equation
        # is available.
        return self.hostility_score(i, j, layer) < 0.12

    def hostility_match(
        self,
        attacker_y: float,
        target_y: float,
    ) -> bool:
        scale = float(self.na)

        normalized_difference = (
            abs(float(attacker_y) - float(target_y)) / scale
        )

        return normalized_difference <= self.tolerance

    def sample_layer_near(
        self,
        origin: int,
        max_delta: int,
        rng,
    ) -> int:
        origin = self.validate_layer(origin)
        max_delta = int(max_delta)

        if max_delta < 0:
            raise ValueError("max_delta cannot be negative.")

        if max_delta == 0:
            return origin

        # Sample a nearby offset without enumerating layers.
        delta = int(rng.integers(-max_delta, max_delta + 1))

        return max(0, min(MAX_LAYER, origin + delta))
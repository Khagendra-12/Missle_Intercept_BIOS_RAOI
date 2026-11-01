from __future__ import annotations

from decimal import Decimal, localcontext
from functools import lru_cache

import numpy as np

from .rng import keyed_rng


class ProceduralGRF:
    """
    Lazy correlated Gaussian random field.

    Generates weather on demand without allocating a world-sized grid.

    Temperature, density and wind use correlated spatial and layer
    variations. All random parameters are deterministic for a given seed.
    """

    def __init__(self, cfg: dict):
        c = cfg["weather"]

        self.seed = int(c["seed"])
        self.n = int(c["features"])

        self.lx = float(c["length_scale_km"])
        self.lz = float(c["layer_length_scale"])

        if self.n < 1:
            raise ValueError("Weather feature count must be at least 1.")

        if self.lx <= 0 or self.lz <= 0:
            raise ValueError("Weather correlation lengths must be positive.")

        self.c = c

        rng = keyed_rng(self.seed, "grf-parameters")

        # Spatial and layer frequencies.
        self.freq_xy = rng.normal(
            0.0,
            1.0 / self.lx,
            size=(self.n, 2),
        )

        self.freq_z = rng.normal(
            0.0,
            1.0 / self.lz,
            size=self.n,
        )

        self.phase = rng.uniform(
            0.0,
            2.0 * np.pi,
            size=self.n,
        )

        # Independent field weights.
        self.temperature_weights = rng.normal(
            0.0,
            1.0,
            size=self.n,
        ) / np.sqrt(self.n)

        self.wind_weights = rng.normal(
            0.0,
            1.0,
            size=(3, self.n),
        ) / np.sqrt(self.n)

        # Cache layer phases so repeated weather samples on the same
        # layer do not repeatedly perform high-precision calculations.
        self._layer_phase_cache = {}

    def _layer_phase(self, layer: int) -> np.ndarray:
        """
        Calculate layer phase without converting enormous layer
        indices directly to floating point.

        Decimal arithmetic avoids the precision loss caused by
        float(layer) and avoids artificial modulo periodicity.
        """
        layer = int(layer)

        cached = self._layer_phase_cache.get(layer)

        if cached is not None:
            return cached

        if abs(layer) < 10**12:
            result = np.remainder(
                self.freq_z * float(layer),
                2.0 * np.pi,
            )
        else:
            result = np.empty(self.n, dtype=float)

            with localcontext() as context:
                context.prec = len(str(abs(layer))) + 50

                layer_decimal = Decimal(layer)
                two_pi = Decimal.from_float(
                    2.0 * np.pi
                )

                for index in range(self.n):
                    frequency = Decimal.from_float(
                        float(self.freq_z[index])
                    )

                    phase = Decimal.from_float(
                        float(self.phase[index])
                    )

                    angle = (
                        frequency * layer_decimal + phase
                    ) % two_pi

                    result[index] = float(angle)

        result.setflags(write=False)

        self._layer_phase_cache[layer] = result

        # Keep the cache bounded.
        if len(self._layer_phase_cache) > 128:
            oldest_key = next(iter(self._layer_phase_cache))
            del self._layer_phase_cache[oldest_key]

        return result

    def _feature_vector(
        self,
        x_km: float,
        y_km: float,
        layer: int,
    ) -> np.ndarray:
        """Calculate the random Fourier feature vector."""
        x_km = float(x_km)
        y_km = float(y_km)

        if not np.isfinite(x_km) or not np.isfinite(y_km):
            raise ValueError("Weather coordinates must be finite.")

        layer_phase = self._layer_phase(int(layer))

        spatial_phase = (
            self.freq_xy[:, 0] * x_km
            + self.freq_xy[:, 1] * y_km
        )

        argument = (
            spatial_phase
            + layer_phase
        )

        return np.sqrt(2.0) * np.cos(argument)

    def scalar(
        self,
        x_km: float,
        y_km: float,
        layer: int,
    ) -> float:
        """Return a deterministic correlated scalar GRF sample."""
        features = self._feature_vector(
            x_km,
            y_km,
            layer,
        )

        return float(
            np.dot(
                self.temperature_weights,
                features,
            )
        )

    def sample(
        self,
        x_km: float,
        y_km: float,
        layer: int,
    ) -> dict:
        """
        Return temperature, density, wind and GRF at one location.

        No world-sized arrays are generated.
        """
        features = self._feature_vector(
            x_km,
            y_km,
            layer,
        )

        c = self.c

        g = float(
            np.dot(
                self.temperature_weights,
                features,
            )
        )

        temperature = (
            float(c["temperature_base_c"])
            + float(c["temperature_sigma_c"]) * g
        )

        density = (
            float(c["density_base_kg_m3"])
            * (
                1.0
                + float(c["density_sigma"]) * g
            )
        )

        density = max(0.05, density)

        # Three independently weighted but spatially correlated
        # Gaussian random fields for wind components.
        wind = (
            float(c["wind_sigma_m_s"])
            * (self.wind_weights @ features)
        )

        return {
            "grf": g,
            "temperature_c": float(temperature),
            "density_kg_m3": float(density),
            "wind_m_s": [
                float(wind[0]),
                float(wind[1]),
                float(wind[2]),
            ],
        }
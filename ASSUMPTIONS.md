# Backend Assumptions and Implementation Status

This document records implementation assumptions and unresolved requirements. A temporary implementation choice must not be treated as an authoritative simulation requirement.

## 1. World representation

- Civilization cells are represented in two dimensions, using integer coordinates `(i, j)`.
- Each layer contains `Na × Na` cells.
- Cell centers use `(i + 0.5, j + 0.5)` unless the configured coordinate convention specifies otherwise.
- Layer indices must support arbitrary-precision integers, including values up to `10**100`.
- World and weather generation must be lazy. No array, range, or loop may scale with the total theoretical number of layers.

## 2. Hostility

- The revised hostility equation is authoritative.
- Hostility input normalization, center-coordinate calculations, exponential/sine/cosine terms, and Taylor truncation must follow the revised specification.
- Hostility matching is based on the specified y-coordinate comparison only.
- The existing hash-based random hostility threshold is a temporary placeholder, not a substitute for the required hostility equation.
- The exact equation and coefficients must be taken from the authoritative specification; they must not be guessed.

## 3. Civilization and engagement constraints

The backend must support:

- Hostile attacker civilizations.
- Target civilizations within the specified 10–20 km distance constraint.
- One missile per attacker.
- Configurable attacker counts and maximum simultaneous attackers.
- Selective defender generation rather than generating every civilization in advance.

The precise target-selection and distance rules must follow the authoritative requirements.

## 4. Environment

- Weather must be generated lazily.
- The environmental model must support the required Gaussian Random Field behavior.
- Temperature, wind, and density must vary spatially and according to the configured weather model.
- Deterministic seeds must allow reproducible trials.

Random Fourier features are an implementation technique; they do not by themselves establish that the required GRF model has been fully satisfied.

## 5. Missile and interceptor simulation

The completed simulation must implement the specified:

- Missile and interceptor dynamics.
- Configurable interceptor speed.
- APN guidance.
- PPO-based evasion.
- Numerical integration and engagement termination conditions.
- Detection and visibility behavior.

A module containing an APN function or an RK4 utility does not establish that the complete engagement simulation uses those methods correctly.

## 6. Monte Carlo experiments

The required experiment framework must support:

- A minimum of 1 run.
- A maximum of 1,000,000 runs.
- Layer-independent paired trials.
- Alternating configurations as specified.
- Reproducible random seeds.
- Confidence intervals and the required statistical summaries.
- Reports and plots based on actual simulation results.

Trials must not use mock or fabricated outcomes.

## 7. Units and configurable parameters

All physical quantities must use consistent, documented units. In particular, document:

- Position and distance units.
- Velocity and acceleration units.
- Time units.
- Layer spacing.
- Weather field units.
- Detection and interception distances.

Do not silently assume that one layer equals one kilometre unless that value is explicitly configured or required.

## 8. Current implementation caveats

The following are not considered complete merely because related code exists:

- The exact revised hostility equation.
- Full attacker and target selection constraints.
- Complete missile evasion.
- Integrated RK4 engagement dynamics.
- Paired layer-independent trials.
- The full requested reporting and plotting workflow.
- Scientific validation of the physical model.

This document should be updated as each requirement is implemented and verified by tests.
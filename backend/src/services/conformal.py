"""Split-conformal prediction intervals from held-out absolute errors."""

import math
from typing import Optional, Sequence

LEVELS = (0.80, 0.95)
MIN_CALIBRATION_POINTS = 14


def conformal_quantile(abs_errors: Sequence[float], level: float) -> Optional[float]:
    """Smallest half-width covering ``level`` of future errors, or None if too few points.

    With n calibration errors the finite-sample quantile index is ``ceil((n + 1) * level)``;
    when that exceeds n no finite interval carries the guarantee, so None is returned
    instead of a silently under-covering one.
    """
    n = len(abs_errors)
    if n == 0:
        return None
    k = math.ceil((n + 1) * level)
    if k > n:
        return None
    return float(sorted(abs_errors)[k - 1])


def intervals_around(values: Sequence[float], half_width: float, nonnegative: bool = True) -> dict[str, list[float]]:
    """Symmetric interval around point forecasts.

    ``nonnegative`` floors the lower bound at zero; pass False for targets that can
    legitimately go negative (profit, net change), whose history includes negatives.
    """
    return {
        "lower": [round(max(0.0, v - half_width) if nonnegative else v - half_width, 2) for v in values],
        "upper": [round(v + half_width, 2) for v in values],
    }

"""Forecasting model tiers chosen by history length.

* ``linear``       (< 60 points)   - BayesianRidge on calendar features + regressors.
* ``prophet``      (60 - 364)      - Prophet with regressors (built in ``prophet_forecaster``).
* ``prophet_lgbm`` (365+)          - Prophet plus LightGBM fitted on Prophet's residuals.

Both models here deliberately present Prophet's interface (``make_future_dataframe``,
``predict`` returning ``yhat``/``yhat_lower``/``yhat_upper`` and one contribution column
per component, ``history``, ``uncertainty_samples``), so simulation, attribution and
persistence work the same whichever tier produced the model.
"""

from __future__ import annotations

import copy
import json
from typing import Any

import numpy as np
import pandas as pd

LINEAR_MAX_POINTS = 60      # below this: linear tier
LGBM_MIN_POINTS = 365       # at or above this: Prophet + LightGBM tier
Z_80 = 1.2815515655446004   # normal quantile for an 80% interval

TIER_LINEAR = "linear"
TIER_PROPHET = "prophet"
TIER_LGBM = "prophet_lgbm"


def select_tier(n_points: int) -> str:
    """Pick the model tier from the number of history points (cheap size thresholds, no search)."""
    if n_points < LINEAR_MAX_POINTS:
        return TIER_LINEAR
    if n_points >= LGBM_MIN_POINTS:
        return TIER_LGBM
    return TIER_PROPHET


# ---------------------------------------------------------------------------------------------
# Tier 1: regularised linear model
# ---------------------------------------------------------------------------------------------

class LinearTierModel:
    """BayesianRidge over a trend term, day-of-week dummies and standardised regressors."""

    tier = TIER_LINEAR

    def __init__(self) -> None:
        self.uncertainty_samples = 0  # unused; kept so callers can treat every tier alike
        self.regressors: list[str] = []
        self.history: pd.DataFrame | None = None
        self.feature_names: list[str] = []
        self.coef: np.ndarray | None = None
        self.intercept = 0.0
        self.alpha = 1.0
        self.sigma: np.ndarray | None = None
        self.reg_mean: dict[str, float] = {}
        self.reg_std: dict[str, float] = {}
        self.t0: pd.Timestamp | None = None

    # -- features -------------------------------------------------------------------------
    def _design(self, frame: pd.DataFrame) -> pd.DataFrame:
        ds = pd.to_datetime(frame["ds"]).reset_index(drop=True)
        cols: dict[str, np.ndarray] = {"t": ((ds - self.t0).dt.days.to_numpy(dtype=float)) / 30.0}
        dow = ds.dt.dayofweek.to_numpy()
        for d in range(1, 7):
            cols[f"dow_{d}"] = (dow == d).astype(float)
        for name in self.regressors:
            values = pd.to_numeric(frame[name], errors="coerce").fillna(0.0).to_numpy(dtype=float)
            cols[name] = (values - self.reg_mean[name]) / self.reg_std[name]
        return pd.DataFrame(cols)[self.feature_names]

    def fit(self, df: pd.DataFrame, regressors: list[str]) -> "LinearTierModel":
        from sklearn.linear_model import BayesianRidge

        df = df.sort_values("ds").reset_index(drop=True)
        self.regressors = list(regressors)
        self.t0 = pd.to_datetime(df["ds"]).min()
        for name in self.regressors:
            col = pd.to_numeric(df[name], errors="coerce").fillna(0.0)
            self.reg_mean[name] = float(col.mean())
            self.reg_std[name] = float(col.std()) if float(col.std()) > 1e-12 else 1.0
        self.feature_names = ["t"] + [f"dow_{d}" for d in range(1, 7)] + self.regressors
        X = self._design(df)
        reg = BayesianRidge(fit_intercept=True).fit(X.to_numpy(), df["y"].to_numpy(dtype=float))
        self.coef = np.asarray(reg.coef_, dtype=float)
        self.intercept = float(reg.intercept_)
        self.alpha = float(reg.alpha_)
        self.sigma = np.asarray(reg.sigma_, dtype=float)
        self.history = df[["ds", "y"]].copy()
        self.history["ds"] = pd.to_datetime(self.history["ds"])
        return self

    # -- Prophet-style interface ------------------------------------------------------------
    def make_future_dataframe(self, periods: int, freq: str = "D") -> pd.DataFrame:
        last = self.history["ds"].max()
        future = pd.date_range(start=last + pd.Timedelta(days=1), periods=periods, freq=freq)
        return pd.DataFrame({"ds": pd.concat([self.history["ds"], pd.Series(future)], ignore_index=True)})

    def predict(self, future: pd.DataFrame) -> pd.DataFrame:
        X = self._design(future)
        contrib = X.to_numpy() * self.coef
        yhat = contrib.sum(axis=1) + self.intercept
        x = X.to_numpy()
        var = 1.0 / self.alpha + np.einsum("ij,jk,ik->i", x, self.sigma, x)
        half = Z_80 * np.sqrt(var)

        out = pd.DataFrame({"ds": pd.to_datetime(future["ds"]).reset_index(drop=True)})
        out["yhat"], out["yhat_lower"], out["yhat_upper"] = yhat, yhat - half, yhat + half
        names = self.feature_names
        out["trend"] = self.intercept + contrib[:, names.index("t")]
        out["weekly"] = contrib[:, [names.index(f"dow_{d}") for d in range(1, 7)]].sum(axis=1)
        for name in self.regressors:
            out[name] = contrib[:, names.index(name)]
        return out

    # -- persistence ------------------------------------------------------------------------
    def to_dict(self) -> dict[str, Any]:
        return {
            "__tier__": self.tier,
            "regressors": self.regressors,
            "feature_names": self.feature_names,
            "coef": self.coef.tolist(),
            "intercept": self.intercept,
            "alpha": self.alpha,
            "sigma": self.sigma.tolist(),
            "reg_mean": self.reg_mean,
            "reg_std": self.reg_std,
            "t0": self.t0.isoformat(),
            "history": {"ds": [d.isoformat() for d in self.history["ds"]], "y": self.history["y"].tolist()},
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "LinearTierModel":
        m = cls()
        m.regressors = data["regressors"]
        m.feature_names = data["feature_names"]
        m.coef = np.asarray(data["coef"], dtype=float)
        m.intercept = float(data["intercept"])
        m.alpha = float(data["alpha"])
        m.sigma = np.asarray(data["sigma"], dtype=float)
        m.reg_mean = {k: float(v) for k, v in data["reg_mean"].items()}
        m.reg_std = {k: float(v) for k, v in data["reg_std"].items()}
        m.t0 = pd.Timestamp(data["t0"])
        m.history = pd.DataFrame({"ds": pd.to_datetime(data["history"]["ds"]), "y": data["history"]["y"]})
        return m


# ---------------------------------------------------------------------------------------------
# Tier 3: Prophet + LightGBM on Prophet's residuals
# ---------------------------------------------------------------------------------------------

LGBM_PARAMS = {
    "objective": "regression",
    "learning_rate": 0.05,
    "num_leaves": 15,
    "min_data_in_leaf": 10,
    "feature_fraction": 0.9,
    "verbosity": -1,
    "seed": 7,
    "deterministic": True,
    "force_row_wise": True,
}
LGBM_ROUNDS = 150
LAGS = (1, 7, 30)
ROLLS = (7, 28)


def _price_column(regressors: list[str]) -> str | None:
    candidates = [r for r in regressors if "price" in r.lower() and "cost" not in r.lower()]
    return "unit_price" if "unit_price" in candidates else (candidates[0] if candidates else None)


class ProphetLgbmModel:
    """Prophet for trend/seasonality, LightGBM for what Prophet leaves unexplained.

    Stage-2 features per day: the regressors, log price, residual lags 1/7/30, rolling
    means of the residual (7/28 days, shifted so they never see the day itself) and the
    day of week. Future days are predicted recursively: each predicted residual feeds the
    next day's lag features.
    """

    tier = TIER_LGBM

    def __init__(self, prophet: Any, booster: Any, regressors: list[str], residual_history: np.ndarray) -> None:
        self.prophet = prophet
        self.booster = booster
        self.regressors = list(regressors)
        self.price_col = _price_column(self.regressors)
        self.residual_history = np.asarray(residual_history, dtype=float)
        self.uncertainty_samples = prophet.uncertainty_samples
        self.feature_names = self._names()

    @property
    def history(self) -> pd.DataFrame:
        return self.prophet.history

    def make_future_dataframe(self, periods: int, freq: str = "D") -> pd.DataFrame:
        return self.prophet.make_future_dataframe(periods=periods, freq=freq)

    # -- features ---------------------------------------------------------------------------
    def _names(self) -> list[str]:
        names = list(self.regressors)
        if self.price_col:
            names.append("log_price")
        names += [f"resid_lag_{k}" for k in LAGS] + [f"resid_roll_mean_{w}" for w in ROLLS] + ["dow"]
        return names

    @staticmethod
    def _row(regressor_values: dict[str, float], price: float | None, dow: int, resid: np.ndarray, names: list[str]) -> list[float]:
        feats: dict[str, float] = dict(regressor_values)
        if price is not None:
            feats["log_price"] = float(np.log(max(price, 1e-9)))
        for k in LAGS:
            feats[f"resid_lag_{k}"] = float(resid[-k]) if len(resid) >= k else np.nan
        for w in ROLLS:
            feats[f"resid_roll_mean_{w}"] = float(np.mean(resid[-w:])) if len(resid) >= 1 else np.nan
        feats["dow"] = float(dow)
        return [feats[n] for n in names]

    def history_features(self, hist: pd.DataFrame) -> pd.DataFrame:
        """Vectorised features for history rows (true lags), aligned with ``residual_history``."""
        resid = pd.Series(self.residual_history)
        cols: dict[str, Any] = {r: pd.to_numeric(hist[r], errors="coerce").fillna(0.0).to_numpy(dtype=float) for r in self.regressors}
        if self.price_col:
            cols["log_price"] = np.log(np.maximum(cols[self.price_col], 1e-9))
        for k in LAGS:
            cols[f"resid_lag_{k}"] = resid.shift(k).to_numpy()
        for w in ROLLS:
            cols[f"resid_roll_mean_{w}"] = resid.shift(1).rolling(w, min_periods=1).mean().to_numpy()
        cols["dow"] = pd.to_datetime(hist["ds"]).dt.dayofweek.to_numpy(dtype=float)
        return pd.DataFrame(cols)[self.feature_names]

    # -- training ---------------------------------------------------------------------------
    @classmethod
    def fit(cls, prophet: Any, df: pd.DataFrame, regressors: list[str]) -> "ProphetLgbmModel":
        import lightgbm as lgb

        df = df.sort_values("ds").reset_index(drop=True)
        scorer = copy.copy(prophet)
        scorer.uncertainty_samples = 0
        in_sample = scorer.predict(df[["ds"] + list(regressors)])
        residual = df["y"].to_numpy(dtype=float) - in_sample["yhat"].to_numpy(dtype=float)

        shell = cls(prophet, booster=None, regressors=regressors, residual_history=residual)
        X = shell.history_features(df)
        booster = lgb.train(LGBM_PARAMS, lgb.Dataset(X, label=residual, feature_name=shell.feature_names), num_boost_round=LGBM_ROUNDS)
        shell.booster = booster
        return shell

    # -- prediction -------------------------------------------------------------------------
    def predict(self, future: pd.DataFrame) -> pd.DataFrame:
        base_model = copy.copy(self.prophet)
        base_model.uncertainty_samples = self.uncertainty_samples
        frame = future.reset_index(drop=True)
        out = base_model.predict(frame)

        hist_end = self.history["ds"].max()
        ds = pd.to_datetime(frame["ds"])
        correction = np.zeros(len(frame))

        # History rows get no residual correction: only days after the training window are
        # corrected (their regressor columns on history rows are placeholders anyway).
        in_hist = (ds <= hist_end).to_numpy()

        stage2 = np.full((len(frame), len(self.feature_names)), np.nan)
        resid = list(self.residual_history)
        for i in np.flatnonzero(~in_hist):
            row = frame.iloc[i]
            reg_vals = {r: float(row[r]) for r in self.regressors}
            price = reg_vals.get(self.price_col) if self.price_col else None
            feats = self._row(reg_vals, price, int(ds.iloc[i].dayofweek), np.asarray(resid), self.feature_names)
            stage2[i] = feats
            r_hat = float(self.booster.predict(np.asarray([feats], dtype=float))[0])
            correction[i] = r_hat
            resid.append(r_hat)

        for col in ("yhat", "yhat_lower", "yhat_upper"):
            if col in out.columns:
                out[col] = out[col] + correction
        out["lgbm_residual"] = correction
        # Feature rows the residual stage saw, for exact Shapley attribution (rows aligned with `out`).
        out.attrs["stage2_features"] = pd.DataFrame(stage2, columns=self.feature_names)
        return out

    # -- persistence ------------------------------------------------------------------------
    def to_dict(self) -> dict[str, Any]:
        from prophet.serialize import model_to_json

        return {
            "__tier__": self.tier,
            "prophet": model_to_json(self.prophet),
            "booster": self.booster.model_to_string(),
            "regressors": self.regressors,
            "residual_history": self.residual_history.tolist(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ProphetLgbmModel":
        import lightgbm as lgb
        from prophet.serialize import model_from_json

        prophet = model_from_json(data["prophet"])
        booster = lgb.Booster(model_str=data["booster"])
        return cls(prophet, booster, data["regressors"], np.asarray(data["residual_history"], dtype=float))


def model_from_payload(payload: Any) -> Any | None:
    """Rebuild a tier model from a stored JSON object; None if it is not a tier payload."""
    if isinstance(payload, dict) and payload.get("__tier__") == TIER_LINEAR:
        return LinearTierModel.from_dict(payload)
    if isinstance(payload, dict) and payload.get("__tier__") == TIER_LGBM:
        return ProphetLgbmModel.from_dict(payload)
    return None

"""
Meditrax unified taper engine (the FIXED algorithm).

A single source of truth used for BOTH plan generation and daily-dose lookup,
so the schedule can never contradict the dose shown on a given day.

Guarantees for every generated schedule:
  * step[0].dose == initial_dose
  * last step dose == final_dose
  * monotonic non-increasing
  * no negative doses

Methods:
  linear      -> equal mg decrements (fixed amount each step)
  exponential -> fixed % of CURRENT dose each step (geometric decay)
  hyperbolic  -> equal receptor-occupancy steps via the Hill equation
                 (gentlest reductions near the bottom; recommended for
                  benzodiazepines & antidepressants)
  custom      -> explicit user-provided dose levels
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional


def _round(x: float, places: int = 4) -> float:
    return max(0.0, round(x, places))


def generate_taper_levels(
    initial_dose: float,
    final_dose: float,
    total_days: int,
    step_interval_days: int = 7,
    method: str = "hyperbolic",
    custom_steps: Optional[List[dict]] = None,
) -> List[float]:
    """Return the list of dose levels (one per step, including day 0)."""
    initial_dose = float(initial_dose)
    final_dose = float(final_dose)
    if initial_dose <= 0:
        raise ValueError("initial_dose must be > 0")
    if final_dose < 0 or final_dose > initial_dose:
        raise ValueError("final_dose must be between 0 and initial_dose")
    if total_days <= 0 or step_interval_days <= 0:
        raise ValueError("durations must be > 0")

    n = max(1, round(total_days / step_interval_days))  # number of reductions

    if method == "custom" and custom_steps:
        doses = []
        for cs in custom_steps:
            if cs.get("dose") is not None:
                doses.append(float(cs["dose"]))
            else:
                doses.append(round(initial_dose * float(cs.get("multiplier", 1)), 4))
        if not doses or abs(doses[0] - initial_dose) > 1e-9:
            doses = [initial_dose] + doses
        doses[-1] = final_dose
        levels = doses
    else:
        levels = [0.0] * (n + 1)
        levels[0] = initial_dose
        levels[n] = final_dose

        if method == "linear":
            dec = (initial_dose - final_dose) / n
            for i in range(1, n):
                levels[i] = initial_dose - dec * i

        elif method == "exponential":
            if final_dose > 0:
                r = (final_dose / initial_dose) ** (1.0 / n)
                for i in range(1, n):
                    levels[i] = initial_dose * (r ** i)
            else:
                floor = max(initial_dose * 0.05, 1e-4)
                r = (floor / initial_dose) ** (1.0 / (n - 1)) if n > 1 else 0
                for i in range(1, n):
                    levels[i] = initial_dose * (r ** i)

        elif method == "hyperbolic":
            Kd = initial_dose * 0.25  # O(initial) ~ 0.8
            def occ(d):
                return d / (d + Kd)
            def inv(o):
                return Kd * o / (1 - o) if o < 1 else initial_dose
            o_init = occ(initial_dose)
            o_final = occ(final_dose)
            for i in range(1, n):
                o_i = o_init - (o_init - o_final) * (i / n)
                levels[i] = inv(o_i)
        else:
            raise ValueError(f"unknown taper method: {method}")

    # enforce non-increasing + clamp
    out = []
    prev = None
    for d in levels:
        v = _round(d)
        if prev is not None and v > prev:
            v = prev
        out.append(v)
        prev = v
    return out


def generate_taper_schedule(
    initial_dose: float,
    final_dose: float,
    start_date: datetime,
    step_interval_days: int = 7,
    total_days: Optional[int] = None,
    end_date: Optional[datetime] = None,
    method: str = "hyperbolic",
    unit: str = "mg",
    custom_steps: Optional[List[dict]] = None,
    max_reduction_warn_pct: float = 25.0,
) -> Dict:
    """Return a full schedule dict: {steps:[...], summary:{...}, warnings:[...]}."""
    if total_days is None:
        if end_date is None:
            raise ValueError("Provide total_days or end_date")
        total_days = max(1, (end_date - start_date).days)

    levels = generate_taper_levels(
        initial_dose, final_dose, total_days, step_interval_days, method, custom_steps
    )

    steps = []
    warnings: List[str] = []
    prev = None
    for i, dose in enumerate(levels):
        start_day = i * step_interval_days
        sdate = start_date + timedelta(days=start_day)
        edate = start_date + timedelta(days=(i + 1) * step_interval_days)
        reduction_pct = 0.0
        reduction_amt = 0.0
        if prev not in (None, 0):
            reduction_amt = round(prev - dose, 4)
            reduction_pct = round((prev - dose) / prev * 100, 1)
        note = ""
        if reduction_pct > max_reduction_warn_pct:
            note = f"Large reduction ({reduction_pct}%). Consider extending the duration."
            warnings.append(f"Step {i}: {note}")
        steps.append({
            "step": i,
            "start_day": start_day,
            "date": sdate.date().isoformat(),
            "end_date": edate.date().isoformat(),
            "dose": dose,
            "unit": unit,
            "reduction_amount": reduction_amt,
            "reduction_pct": reduction_pct,
            "note": note,
            "is_final": i == len(levels) - 1,
        })
        prev = dose

    summary = {
        "method": method,
        "initial_dose": initial_dose,
        "final_dose": final_dose,
        "unit": unit,
        "total_days": total_days,
        "step_interval_days": step_interval_days,
        "num_steps": len(steps),
        "start_date": start_date.date().isoformat(),
        "end_date": (start_date + timedelta(days=total_days)).date().isoformat(),
        "total_reduction": round(initial_dose - final_dose, 4),
    }
    return {"steps": steps, "summary": summary, "warnings": warnings}


def dose_on_date(schedule: Dict, on_date: datetime, start_date: datetime) -> float:
    """Daily-dose lookup using the SAME generated schedule (no contradictions)."""
    steps = schedule.get("steps", [])
    if not steps:
        return 0.0
    interval = schedule.get("summary", {}).get("step_interval_days", 7)
    day = (on_date.date() - start_date.date()).days
    if day < 0:
        return steps[0]["dose"]
    idx = min(len(steps) - 1, day // interval)
    return steps[idx]["dose"]


def suggest_taper_params(med: dict) -> dict:
    """Recommend method / interval / duration based on a medication's risk profile."""
    dep = (med or {}).get("dependency_risk_category", "none")
    risk = (med or {}).get("risk_level", "low")
    if dep in ("extreme", "high") or risk == "high":
        return {
            "method": "hyperbolic",
            "step_interval_days": 14,
            "suggested_weeks": 16,
            "reduction_per_step_pct": 10,
            "rationale": "High dependency risk: a slow hyperbolic taper (≈5-10% of current dose every 2 weeks) minimizes withdrawal.",
        }
    if dep == "moderate" or risk == "moderate":
        return {
            "method": "hyperbolic",
            "step_interval_days": 7,
            "suggested_weeks": 8,
            "reduction_per_step_pct": 15,
            "rationale": "Moderate risk: a gradual hyperbolic taper over about 8 weeks is reasonable.",
        }
    return {
        "method": "linear",
        "step_interval_days": 7,
        "suggested_weeks": 4,
        "reduction_per_step_pct": 25,
        "rationale": "Lower risk: a linear taper over a few weeks is usually well tolerated.",
    }

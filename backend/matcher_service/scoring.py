"""Server-side browse ranking for discover feed."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Set


def _normalize_tags(tags: Sequence[str] | None) -> Set[str]:
    if not tags:
        return set()
    return {t.strip().lower() for t in tags if t and str(t).strip()}


def jaccard(a: Sequence[str] | None, b: Sequence[str] | None) -> float:
    sa, sb = _normalize_tags(a), _normalize_tags(b)
    if not sa and not sb:
        return 0.0
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def looking_for_alignment(viewer_looking: Optional[str], candidate_looking: Optional[str],
                          candidate_interests: Sequence[str] | None) -> float:
    """
    Soft match: if viewer's looking_for token appears in candidate interests
    or looking_for strings overlap, score up to 1.0.
    """
    if not viewer_looking:
        return 0.5  # neutral when viewer has no preference
    v = viewer_looking.strip().lower()
    tokens = {t for t in v.replace("/", " ").replace(",", " ").split() if len(t) > 2}
    score = 0.0
    cand_lf = (candidate_looking or "").strip().lower()
    if cand_lf and (v in cand_lf or cand_lf in v):
        score = 1.0
    interests = _normalize_tags(candidate_interests)
    if tokens and interests:
        overlap = len(tokens & interests) / len(tokens)
        score = max(score, overlap)
    return min(1.0, score)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def recency_score(last_active_at: Optional[str]) -> float:
    """1.0 if active now, decaying toward 0 over ~14 days."""
    if not last_active_at:
        return 0.3
    try:
        # SQLite CURRENT_TIMESTAMP is 'YYYY-MM-DD HH:MM:SS'
        ts = datetime.fromisoformat(str(last_active_at).replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        hours = max(0.0, (now - ts).total_seconds() / 3600.0)
        # Half-life ~72 hours
        return math.exp(-hours / 72.0)
    except Exception:
        return 0.3


def distance_decay(distance_km: Optional[float], radius_km: Optional[float]) -> float:
    if distance_km is None:
        return 0.5  # unknown location — neutral
    radius = float(radius_km) if radius_km and radius_km > 0 else 50.0
    if distance_km > radius:
        return 0.0
    # Linear decay inside radius
    return max(0.0, 1.0 - (distance_km / radius))


def compute_score(
    viewer: Dict[str, Any],
    candidate: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Weighted composite → integer score 0–100.
    Weights: interests 45%, looking_for 20%, recency 15%, distance 20%.
    """
    interest = jaccard(viewer.get("interests"), candidate.get("interests"))
    looking = looking_for_alignment(
        viewer.get("looking_for"),
        candidate.get("looking_for"),
        candidate.get("interests"),
    )
    recency = recency_score(candidate.get("last_active_at"))

    distance_km = None
    vlat, vlng = viewer.get("lat"), viewer.get("lng")
    clat, clng = candidate.get("lat"), candidate.get("lng")
    if None not in (vlat, vlng, clat, clng):
        try:
            distance_km = haversine_km(float(vlat), float(vlng), float(clat), float(clng))
        except (TypeError, ValueError):
            distance_km = None

    radius = viewer.get("radius_limit")
    dist_factor = distance_decay(distance_km, float(radius) if radius else None)

    composite = (
        0.45 * interest
        + 0.20 * looking
        + 0.15 * recency
        + 0.20 * dist_factor
    )
    score = int(round(max(0.0, min(1.0, composite)) * 100))
    return {"score": score, "distance_km": distance_km}


def filter_by_tags(candidates: List[Dict[str, Any]], tags: Sequence[str] | None) -> List[Dict[str, Any]]:
    required = _normalize_tags(tags)
    if not required:
        return candidates
    out = []
    for c in candidates:
        interests = _normalize_tags(c.get("interests"))
        if required & interests:
            out.append(c)
    return out

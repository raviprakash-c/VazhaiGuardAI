from __future__ import annotations

import json
import time
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query


router = APIRouter(tags=["Weather"])


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# Small in-memory cache.
# This avoids repeatedly calling the weather provider when
# the farmer refreshes the screen within a short period.
CACHE_TTL_SECONDS = 60

_weather_cache: dict[
    str,
    tuple[float, dict[str, Any]],
] = {}


def _cache_key(
    latitude: float,
    longitude: float,
) -> str:
    return (
        f"{round(latitude, 3)}:"
        f"{round(longitude, 3)}"
    )


def _fetch_json(
    latitude: float,
    longitude: float,
) -> dict[str, Any]:

    params = {
        "latitude": latitude,
        "longitude": longitude,

        # Always return farm-local time.
        "timezone": "auto",

        # Current conditions.
        "current": ",".join(
            [
                "temperature_2m",
                "precipitation",
                "rain",
                "wind_speed_10m",
                "wind_gusts_10m",
                "wind_direction_10m",
            ]
        ),

        # Hourly data used to build the next 24-hour
        # farmer-facing summary.
        "hourly": ",".join(
            [
                "precipitation_probability",
                "precipitation",
                "wind_speed_10m",
                "wind_gusts_10m",
            ]
        ),

        # We only need a short horizon.
        "forecast_days": 2,
    }

    url = (
        f"{OPEN_METEO_URL}?"
        f"{urlencode(params)}"
    )

    request = Request(
        url,
        headers={
            "User-Agent": (
                "VazhaiGuardAI/2.0 "
                "weather-service"
            )
        },
        method="GET",
    )

    try:
        with urlopen(
            request,
            timeout=8,
        ) as response:

            body = response.read()

            return json.loads(
                body.decode("utf-8")
            )

    except Exception as exc:
        raise RuntimeError(
            f"Weather provider request failed: {exc}"
        ) from exc


def _safe_number(
    values: list[Any],
    index: int,
    default: float = 0.0,
) -> float:

    if index < 0 or index >= len(values):
        return default

    try:
        return float(values[index])
    except (
        TypeError,
        ValueError,
    ):
        return default


def _find_current_hour_index(
    current_time: str,
    hourly_times: list[Any],
) -> int:

    if not hourly_times:
        return 0

    current_hour = current_time[:13]

    for index, value in enumerate(
        hourly_times
    ):
        if not isinstance(value, str):
            continue

        if value[:13] == current_hour:
            return index

    return 0


def _build_next_24_hours(
    data: dict[str, Any],
) -> dict[str, Any]:

    current = data.get("current") or {}
    hourly = data.get("hourly") or {}

    current_time = str(
        current.get("time") or ""
    )

    times = hourly.get("time") or []

    rain_probability = (
        hourly.get(
            "precipitation_probability"
        )
        or []
    )

    precipitation = (
        hourly.get("precipitation")
        or []
    )

    wind_speed = (
        hourly.get("wind_speed_10m")
        or []
    )

    wind_gusts = (
        hourly.get("wind_gusts_10m")
        or []
    )

    start_index = _find_current_hour_index(
        current_time,
        times,
    )

    end_index = min(
        start_index + 24,
        len(times),
    )

    if end_index <= start_index:
        return {
            "max_rain_probability": 0,
            "total_precipitation": 0,
            "max_wind_speed": 0,
            "max_wind_gust": 0,
            "peak_gust_time": None,
        }

    probabilities = [
        _safe_number(
            rain_probability,
            index,
        )
        for index in range(
            start_index,
            end_index,
        )
    ]

    precipitation_values = [
        _safe_number(
            precipitation,
            index,
        )
        for index in range(
            start_index,
            end_index,
        )
    ]

    wind_values = [
        _safe_number(
            wind_speed,
            index,
        )
        for index in range(
            start_index,
            end_index,
        )
    ]

    gust_values = [
        _safe_number(
            wind_gusts,
            index,
        )
        for index in range(
            start_index,
            end_index,
        )
    ]

    max_gust = (
        max(gust_values)
        if gust_values
        else 0
    )

    peak_gust_time = None

    if gust_values and times:
        local_max_index = gust_values.index(
            max_gust
        )

        absolute_index = (
            start_index
            + local_max_index
        )

        if absolute_index < len(times):
            peak_gust_time = times[
                absolute_index
            ]

    return {
        "max_rain_probability": round(
            max(probabilities)
            if probabilities
            else 0,
            1,
        ),

        "total_precipitation": round(
            sum(precipitation_values),
            1,
        ),

        "max_wind_speed": round(
            max(wind_values)
            if wind_values
            else 0,
            1,
        ),

        "max_wind_gust": round(
            max_gust,
            1,
        ),

        "peak_gust_time":
            peak_gust_time,
    }


@router.get("/weather")
async def get_weather(
    lat: float = Query(
        ...,
        ge=-90,
        le=90,
    ),
    lon: float = Query(
        ...,
        ge=-180,
        le=180,
    ),
) -> dict[str, Any]:

    key = _cache_key(
        lat,
        lon,
    )

    cached = _weather_cache.get(key)

    if cached:
        created_at, cached_data = cached

        if (
            time.time()
            - created_at
            < CACHE_TTL_SECONDS
        ):
            return cached_data

    try:
        provider_data = _fetch_json(
            lat,
            lon,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to reach the live "
                "weather service."
            ),
        ) from exc

    current = (
        provider_data.get("current")
        or {}
    )

    result = {
        "location": {
            "latitude": float(
                provider_data.get(
                    "latitude",
                    lat,
                )
            ),
            "longitude": float(
                provider_data.get(
                    "longitude",
                    lon,
                )
            ),
            "timezone": str(
                provider_data.get(
                    "timezone",
                    "auto",
                )
            ),
        },

        "current": {
            "time": str(
                current.get("time") or ""
            ),

            "temperature": float(
                current.get(
                    "temperature_2m",
                    0,
                )
            ),

            "precipitation": float(
                current.get(
                    "precipitation",
                    0,
                )
            ),

            "rain": float(
                current.get(
                    "rain",
                    0,
                )
            ),

            "wind_speed": float(
                current.get(
                    "wind_speed_10m",
                    0,
                )
            ),

            "wind_gust": float(
                current.get(
                    "wind_gusts_10m",
                    0,
                )
            ),

            "wind_direction": float(
                current.get(
                    "wind_direction_10m",
                    0,
                )
            ),
        },

        "next_24_hours":
            _build_next_24_hours(
                provider_data
            ),
    }

    _weather_cache[key] = (
        time.time(),
        result,
    )

    return result
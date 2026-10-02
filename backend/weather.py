from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Query


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    tags=["weather"],
)


# ============================================================
# OPEN-METEO
# ============================================================

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


# ============================================================
# WEATHER HELPERS
# ============================================================

def _rain_risk(
    probability: float,
    precipitation: float,
) -> str:

    if probability >= 80 or precipitation >= 15:
        return "high"

    if probability >= 50 or precipitation >= 5:
        return "moderate"

    return "low"


def _wind_risk(
    wind_speed: float,
    wind_gust: float,
) -> str:

    if wind_gust >= 45 or wind_speed >= 25:
        return "high"

    if wind_gust >= 30 or wind_speed >= 18:
        return "moderate"

    return "low"


def _overall_weather_status(
    rain_risk: str,
    wind_risk: str,
) -> str:

    if "high" in (rain_risk, wind_risk):
        return "attention"

    if "moderate" in (rain_risk, wind_risk):
        return "monitor"

    return "favorable"


def _build_weather_actions(
    rain_probability: float,
    precipitation: float,
    max_wind_speed: float,
    max_wind_gust: float,
) -> list[str]:

    actions: list[str] = []

    if rain_probability >= 80:

        actions.append(
            "Rain is highly likely. "
            "Review planned field work before "
            "the expected rain period."
        )

    elif rain_probability >= 50:

        actions.append(
            "Rain is possible. "
            "Recheck weather conditions before "
            "weather-sensitive field work."
        )

    else:

        actions.append(
            "Rain probability is relatively low "
            "for the next 24 hours."
        )

    if precipitation >= 10:

        actions.append(
            "Expected precipitation is significant. "
            "Consider soil moisture and crop requirements "
            "before irrigation."
        )

    if max_wind_gust >= 45:

        actions.append(
            "Strong wind gusts are possible. "
            "Take extra care with weather-sensitive "
            "field activities."
        )

    elif max_wind_speed >= 18:

        actions.append(
            "Moderate-to-strong winds are possible. "
            "Recheck conditions before wind-sensitive "
            "activities."
        )

    return actions


# ============================================================
# FETCH OPEN-METEO WEATHER
# ============================================================

async def get_weather(
    lat: float,
    lon: float,
) -> dict[str, Any]:

    params = {
        "latitude": lat,
        "longitude": lon,

        "current": (
            "temperature_2m,"
            "precipitation,"
            "rain,"
            "wind_speed_10m,"
            "wind_gusts_10m,"
            "wind_direction_10m"
        ),

        "hourly": (
            "precipitation_probability,"
            "precipitation,"
            "wind_speed_10m,"
            "wind_gusts_10m"
        ),

        "forecast_days": 2,

        "timezone": "auto",
    }

    async with httpx.AsyncClient(
        timeout=15.0
    ) as client:

        response = await client.get(
            OPEN_METEO_URL,
            params=params,
        )

        response.raise_for_status()

        raw = response.json()

    current = raw.get(
        "current",
        {},
    )

    hourly = raw.get(
        "hourly",
        {},
    )

    times = hourly.get(
        "time",
        [],
    )

    rain_probabilities = hourly.get(
        "precipitation_probability",
        [],
    )

    precipitation_values = hourly.get(
        "precipitation",
        [],
    )

    wind_speed_values = hourly.get(
        "wind_speed_10m",
        [],
    )

    wind_gust_values = hourly.get(
        "wind_gusts_10m",
        [],
    )

    # --------------------------------------------------------
    # Only consider the next 24 forecast hours
    # --------------------------------------------------------

    rain_probabilities_24 = (
        rain_probabilities[:24]
    )

    precipitation_values_24 = (
        precipitation_values[:24]
    )

    wind_speed_values_24 = (
        wind_speed_values[:24]
    )

    wind_gust_values_24 = (
        wind_gust_values[:24]
    )

    max_rain_probability = (
        max(rain_probabilities_24)
        if rain_probabilities_24
        else 0
    )

    total_precipitation = sum(
        precipitation_values_24
    )

    max_wind_speed = (
        max(wind_speed_values_24)
        if wind_speed_values_24
        else 0
    )

    max_wind_gust = (
        max(wind_gust_values_24)
        if wind_gust_values_24
        else 0
    )

    peak_gust_time = None

    if wind_gust_values_24:

        peak_index = max(
            range(len(wind_gust_values_24)),
            key=lambda index:
                wind_gust_values_24[index],
        )

        if peak_index < len(times):

            peak_gust_time = (
                times[peak_index]
            )

    return {
        "location": {
            "latitude": lat,
            "longitude": lon,
            "timezone": raw.get(
                "timezone",
                "auto",
            ),
        },

        "current": {
            "time": current.get(
                "time",
                "",
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

        "next_24_hours": {
            "max_rain_probability":
                float(max_rain_probability),

            "total_precipitation":
                float(total_precipitation),

            "max_wind_speed":
                float(max_wind_speed),

            "max_wind_gust":
                float(max_wind_gust),

            "peak_gust_time":
                peak_gust_time,
        },
    }


# ============================================================
# BASIC WEATHER ENDPOINT
# ============================================================

@router.get(
    "/weather",
)
async def weather_endpoint(
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

    return await get_weather(
        lat=lat,
        lon=lon,
    )


# ============================================================
# WEATHER INTELLIGENCE ENDPOINT
# ============================================================

@router.get(
    "/weather/intelligence",
)
async def get_weather_intelligence(
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

    weather = await get_weather(
        lat=lat,
        lon=lon,
    )

    current = weather["current"]

    next_24 = weather[
        "next_24_hours"
    ]

    rain_probability = float(
        next_24.get(
            "max_rain_probability",
            0,
        )
    )

    precipitation = float(
        next_24.get(
            "total_precipitation",
            0,
        )
    )

    max_wind_speed = float(
        next_24.get(
            "max_wind_speed",
            0,
        )
    )

    max_wind_gust = float(
        next_24.get(
            "max_wind_gust",
            0,
        )
    )

    rain_risk = _rain_risk(
        rain_probability,
        precipitation,
    )

    wind_risk = _wind_risk(
        max_wind_speed,
        max_wind_gust,
    )

    overall_status = (
        _overall_weather_status(
            rain_risk,
            wind_risk,
        )
    )

    actions = _build_weather_actions(
        rain_probability=rain_probability,
        precipitation=precipitation,
        max_wind_speed=max_wind_speed,
        max_wind_gust=max_wind_gust,
    )

    return {
        "location": weather[
            "location"
        ],

        "overall": {
            "status": overall_status,

            "message": (
                "Weather conditions require attention."
                if overall_status == "attention"
                else (
                    "Weather conditions should be monitored."
                    if overall_status == "monitor"
                    else
                    "No major weather concern is indicated."
                )
            ),
        },

        "current": {
            "temperature":
                current["temperature"],

            "rain":
                current["rain"],

            "wind_speed":
                current["wind_speed"],

            "wind_gust":
                current["wind_gust"],
        },

        "rain": {
            "probability":
                rain_probability,

            "total_precipitation":
                precipitation,

            "risk":
                rain_risk,
        },

        "wind": {
            "max_speed":
                max_wind_speed,

            "max_gust":
                max_wind_gust,

            "peak_gust_time":
                next_24.get(
                    "peak_gust_time"
                ),

            "risk":
                wind_risk,
        },

        "farm_actions":
            actions,

        "data_source":
            "Open-Meteo",

        "forecast_horizon":
            "next_24_hours",
    }
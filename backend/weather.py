def _rain_risk(probability: float, precipitation: float) -> str:
    if probability >= 80 or precipitation >= 15:
        return "high"

    if probability >= 50 or precipitation >= 5:
        return "moderate"

    return "low"


def _wind_risk(wind_speed: float, wind_gust: float) -> str:
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
            "Rain is highly likely. Review planned field work "
            "before the expected rain period."
        )
    elif rain_probability >= 50:
        actions.append(
            "Rain is possible. Recheck weather conditions "
            "before weather-sensitive field work."
        )
    else:
        actions.append(
            "Rain probability is relatively low for the next "
            "24 hours."
        )

    if precipitation >= 10:
        actions.append(
            "Expected precipitation is significant. Avoid making "
            "irrigation decisions without considering soil moisture "
            "and crop requirements."
        )

    if max_wind_gust >= 45:
        actions.append(
            "Strong wind gusts are possible. Take extra care with "
            "weather-sensitive field activities."
        )
    elif max_wind_speed >= 18:
        actions.append(
            "Moderate-to-strong winds are possible. Recheck "
            "conditions before wind-sensitive activities."
        )

    if not actions:
        actions.append(
            "No major weather-related action is indicated from "
            "the available 24-hour forecast."
        )

    return actions


@router.get("/weather/intelligence")
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
    """
    Convert live weather data into a farmer-facing
    weather intelligence summary.

    The original /weather endpoint remains unchanged.
    """

    weather = await get_weather(
        lat=lat,
        lon=lon,
    )

    current = weather["current"]
    next_24 = weather["next_24_hours"]

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

    overall_status = _overall_weather_status(
        rain_risk,
        wind_risk,
    )

    actions = _build_weather_actions(
        rain_probability=rain_probability,
        precipitation=precipitation,
        max_wind_speed=max_wind_speed,
        max_wind_gust=max_wind_gust,
    )

    return {
        "location": weather["location"],

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
            "temperature": current["temperature"],
            "rain": current["rain"],
            "wind_speed": current["wind_speed"],
            "wind_gust": current["wind_gust"],
        },

        "rain": {
            "probability": rain_probability,
            "total_precipitation": precipitation,
            "risk": rain_risk,
        },

        "wind": {
            "max_speed": max_wind_speed,
            "max_gust": max_wind_gust,
            "peak_gust_time": next_24.get(
                "peak_gust_time"
            ),
            "risk": wind_risk,
        },

        "farm_actions": actions,

        "data_source": "Open-Meteo",

        "forecast_horizon": "next_24_hours",
    }
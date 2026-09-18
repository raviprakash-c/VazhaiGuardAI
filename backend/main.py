from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
from voice_registration import router as voice_registration_router

app = FastAPI(
    title="VazhaiGuard AI API",
    version="0.1.0"
)
app.include_router(
    voice_registration_router
)

# --------------------------------------------------
# CORS
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# ROOT
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "VazhaiGuard AI Backend",
        "status": "running"
    }


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "project": "VazhaiGuard AI"
    }


# --------------------------------------------------
# WEATHER
# --------------------------------------------------

@app.get("/weather")
async def get_weather(lat: float, lon: float):

    url = "https://api.open-meteo.com/v1/forecast"

    params = {

        "latitude": lat,
        "longitude": lon,

        # Current weather
        "current": ",".join([
            "temperature_2m",
            "precipitation",
            "rain",
            "wind_speed_10m",
            "wind_gusts_10m",
            "wind_direction_10m"
        ]),

        # Next 24 hours
        "hourly": ",".join([
            "precipitation_probability",
            "precipitation",
            "wind_speed_10m",
            "wind_gusts_10m"
        ]),

        "forecast_hours": 24,

        # Open-Meteo automatically finds local timezone
        "timezone": "auto"
    }

    try:

        # ------------------------------------------
        # CALL OPEN-METEO
        # ------------------------------------------

        async with httpx.AsyncClient(timeout=20) as client:

            response = await client.get(
                url,
                params=params
            )

            response.raise_for_status()

        data = response.json()


        # ------------------------------------------
        # CURRENT WEATHER
        # ------------------------------------------

        current = data.get("current", {})


        # ------------------------------------------
        # HOURLY WEATHER
        # ------------------------------------------

        hourly = data.get("hourly", {})

        times = hourly.get(
            "time",
            []
        )

        rain_probability = hourly.get(
            "precipitation_probability",
            []
        )

        precipitation = hourly.get(
            "precipitation",
            []
        )

        wind_speed = hourly.get(
            "wind_speed_10m",
            []
        )

        wind_gust = hourly.get(
            "wind_gusts_10m",
            []
        )


        # ------------------------------------------
        # NEXT 24 HOUR CALCULATIONS
        # ------------------------------------------

        max_rain_probability = (
            max(rain_probability)
            if rain_probability
            else 0
        )

        total_precipitation = (
            round(sum(precipitation), 2)
            if precipitation
            else 0
        )

        max_wind_speed = (
            max(wind_speed)
            if wind_speed
            else 0
        )

        max_wind_gust = (
            max(wind_gust)
            if wind_gust
            else 0
        )


        # ------------------------------------------
        # FIND PEAK GUST TIME
        # ------------------------------------------

        peak_gust_time = None

        if wind_gust and times:

            gust_index = wind_gust.index(
                max_wind_gust
            )

            if gust_index < len(times):

                peak_gust_time = times[
                    gust_index
                ]


        # ------------------------------------------
        # FINAL RESPONSE
        # ------------------------------------------

        return {

            "location": {

                "latitude": data.get(
                    "latitude",
                    lat
                ),

                "longitude": data.get(
                    "longitude",
                    lon
                ),

                "timezone": data.get(
                    "timezone",
                    ""
                )
            },


            "current": {

                "time": current.get(
                    "time"
                ),

                "temperature": current.get(
                    "temperature_2m"
                ),

                "precipitation": current.get(
                    "precipitation"
                ),

                "rain": current.get(
                    "rain"
                ),

                "wind_speed": current.get(
                    "wind_speed_10m"
                ),

                "wind_gust": current.get(
                    "wind_gusts_10m"
                ),

                "wind_direction": current.get(
                    "wind_direction_10m"
                )
            },


            "next_24_hours": {

                "max_rain_probability":
                    max_rain_probability,

                "total_precipitation":
                    total_precipitation,

                "max_wind_speed":
                    max_wind_speed,

                "max_wind_gust":
                    max_wind_gust,

                "peak_gust_time":
                    peak_gust_time
            }
        }


    # --------------------------------------------------
    # ERROR HANDLING
    # --------------------------------------------------

    except httpx.HTTPStatusError as e:

        print(
            "OPEN-METEO ERROR:",
            e.response.status_code,
            e.response.text
        )

        raise HTTPException(
            status_code=502,
            detail="Weather provider returned an error."
        )


    except Exception as e:

        print(
            "WEATHER ERROR:",
            repr(e)
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
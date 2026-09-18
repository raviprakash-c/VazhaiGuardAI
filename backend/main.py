from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import httpx

from voice_registration import (
    router as voice_registration_router,
)

from tts.tamil_tts import (
    generate_question_audio,
)


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="VazhaiGuard AI API",
    version="1.0.0",
)


# =========================================================
# CORS
# =========================================================

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


# =========================================================
# VOICE REGISTRATION ROUTER
# =========================================================

app.include_router(
    voice_registration_router
)


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():
    return {
        "message": "VazhaiGuard AI Backend",
        "status": "running",
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "project": "VazhaiGuard AI",
    }


# =========================================================
# TAMIL TTS
# =========================================================

@app.get("/voice/tamil-audio/{field}")
def tamil_voice_audio(
    field: str,
):
    print(
        "TAMIL AUDIO REQUEST:",
        field,
    )

    try:
        audio_path = (
            generate_question_audio(
                field
            )
        )

        print(
            "TAMIL AUDIO GENERATED:",
            audio_path,
        )

        return FileResponse(
        path=str(audio_path),
        media_type="audio/mpeg",
        filename=f"{field}.mp3",
        )

    except ValueError as error:

        print(
            "TAMIL FIELD ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except FileNotFoundError as error:

        print(
            "TAMIL TTS FILE ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )

    except Exception as error:

        print(
            "TAMIL TTS ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Tamil voice generation failed: "
                + str(error)
            ),
        )


# =========================================================
# WEATHER
# =========================================================

@app.get("/weather")
async def get_weather(
    lat: float,
    lon: float,
):

    url = (
        "https://api.open-meteo.com/"
        "v1/forecast"
    )

    params = {

        "latitude": lat,

        "longitude": lon,

        # ---------------------------------------------
        # CURRENT WEATHER
        # ---------------------------------------------

        "current": ",".join([
            "temperature_2m",
            "precipitation",
            "rain",
            "wind_speed_10m",
            "wind_gusts_10m",
            "wind_direction_10m",
        ]),

        # ---------------------------------------------
        # NEXT 24 HOURS
        # ---------------------------------------------

        "hourly": ",".join([
            "precipitation_probability",
            "precipitation",
            "wind_speed_10m",
            "wind_gusts_10m",
        ]),

        "forecast_hours": 24,

        "timezone": "auto",
    }

    try:

        # =================================================
        # CALL OPEN-METEO
        # =================================================

        async with httpx.AsyncClient(
            timeout=20
        ) as client:

            response = await client.get(
                url,
                params=params,
            )

            response.raise_for_status()

        data = response.json()


        # =================================================
        # CURRENT WEATHER
        # =================================================

        current = data.get(
            "current",
            {},
        )


        # =================================================
        # HOURLY WEATHER
        # =================================================

        hourly = data.get(
            "hourly",
            {},
        )

        times = hourly.get(
            "time",
            [],
        )

        rain_probability = hourly.get(
            "precipitation_probability",
            [],
        )

        precipitation = hourly.get(
            "precipitation",
            [],
        )

        wind_speed = hourly.get(
            "wind_speed_10m",
            [],
        )

        wind_gust = hourly.get(
            "wind_gusts_10m",
            [],
        )


        # =================================================
        # NEXT 24 HOUR CALCULATIONS
        # =================================================

        max_rain_probability = (
            max(rain_probability)
            if rain_probability
            else 0
        )

        total_precipitation = (
            round(
                sum(precipitation),
                2,
            )
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


        # =================================================
        # FIND PEAK GUST TIME
        # =================================================

        peak_gust_time = None

        if (
            wind_gust
            and times
        ):
            gust_index = (
                wind_gust.index(
                    max_wind_gust
                )
            )

            if gust_index < len(times):

                peak_gust_time = (
                    times[
                        gust_index
                    ]
                )


        # =================================================
        # FINAL WEATHER RESPONSE
        # =================================================

        return {

            "location": {

                "latitude": data.get(
                    "latitude",
                    lat,
                ),

                "longitude": data.get(
                    "longitude",
                    lon,
                ),

                "timezone": data.get(
                    "timezone",
                    "",
                ),
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
                ),
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
                    peak_gust_time,
            },
        }


    # =====================================================
    # WEATHER PROVIDER ERROR
    # =====================================================

    except httpx.HTTPStatusError as error:

        print(
            "OPEN-METEO ERROR:",
            error.response.status_code,
            error.response.text,
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "Weather provider "
                "returned an error."
            ),
        )


    # =====================================================
    # GENERAL WEATHER ERROR
    # =====================================================

    except Exception as error:

        print(
            "WEATHER ERROR:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )
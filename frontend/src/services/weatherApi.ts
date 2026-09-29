import axios from "axios";

import type { WeatherData } from "../types/weather";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export async function getWeather(
  lat: number,
  lon: number
): Promise<WeatherData> {
  try {
    const response = await axios.get<WeatherData>(
      `${API_BASE_URL}/weather`,
      {
        params: {
          lat,
          lon,
        },
        headers: {
          Accept: "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "[WeatherAPI] Failed to fetch weather:",
      error
    );

    if (axios.isAxiosError(error)) {
      if (error.response?.data?.detail) {
        throw new Error(
          String(error.response.data.detail)
        );
      }

      if (error.response) {
        throw new Error(
          `Weather service returned HTTP ${error.response.status}.`
        );
      }

      if (error.request) {
        throw new Error(
          "Unable to connect to the VazhaiGuardAI weather service."
        );
      }
    }

    throw new Error(
      "Unable to load live weather data."
    );
  }
}
import axios from "axios";
import type { WeatherData } from "../types/weather";

export async function getWeather(
  lat: number,
  lon: number
): Promise<WeatherData> {
  const response = await axios.get("/api/weather", {
    params: { lat, lon },
  });

  return response.data;
}
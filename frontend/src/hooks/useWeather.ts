import { useState } from "react";
import { getWeather } from "../services/weatherApi";
import type { WeatherData } from "../types/weather";

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  const fetchWeather = async (lat: number, lon: number) => {
    try {
      setIsLoadingWeather(true);
      setWeatherError("");

      const data = await getWeather(lat, lon);
      setWeather(data);
    } catch (error) {
      console.error("Weather fetch error:", error);
      setWeatherError("Unable to load live weather data.");
    } finally {
      setIsLoadingWeather(false);
    }
  };

  return {
    weather,
    isLoadingWeather,
    weatherError,
    fetchWeather,
  };
}
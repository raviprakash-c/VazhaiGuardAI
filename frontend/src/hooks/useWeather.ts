import {
  useCallback,
  useRef,
  useState,
} from "react";

import { getWeather } from "../services/weatherApi";
import type { WeatherData } from "../types/weather";

type WeatherCacheEntry = {
  key: string;
  data: WeatherData;
  timestamp: number;
};

const CACHE_DURATION_MS =
  5 * 60 * 1000;

export function useWeather() {
  const [weather, setWeather] =
    useState<WeatherData | null>(null);

  const [
    isLoadingWeather,
    setIsLoadingWeather,
  ] = useState(false);

  const [
    weatherError,
    setWeatherError,
  ] = useState("");

  const cacheRef =
    useRef<WeatherCacheEntry | null>(null);

  const activeRequestRef =
    useRef<{
      key: string;
      promise: Promise<WeatherData>;
    } | null>(null);

  const makeKey = (
    lat: number,
    lon: number
  ) =>
    `${lat.toFixed(5)},${lon.toFixed(5)}`;

  const fetchWeather = useCallback(
    async (
      lat: number,
      lon: number,
      forceRefresh = false
    ): Promise<WeatherData | null> => {
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ) {
        setWeatherError(
          "Invalid farm coordinates."
        );

        return null;
      }

      const key = makeKey(lat, lon);

      setWeatherError("");

      /*
       * CACHE
       */
      if (!forceRefresh) {
        const cached =
          cacheRef.current;

        if (
          cached &&
          cached.key === key &&
          Date.now() - cached.timestamp <
            CACHE_DURATION_MS
        ) {
          setWeather(cached.data);
          return cached.data;
        }
      }

      /*
       * DUPLICATE REQUEST PROTECTION
       */
      const active =
        activeRequestRef.current;

      if (
        active &&
        active.key === key
      ) {
        try {
          const data =
            await active.promise;

          setWeather(data);

          return data;
        } catch {
          return null;
        }
      }

      setIsLoadingWeather(true);

      const requestPromise =
        getWeather(lat, lon);

      activeRequestRef.current = {
        key,
        promise: requestPromise,
      };

      try {
        const data =
          await requestPromise;

        cacheRef.current = {
          key,
          data,
          timestamp: Date.now(),
        };

        setWeather(data);
        setWeatherError("");

        return data;
      } catch (error) {
        console.error(
          "[useWeather]",
          error
        );

        setWeatherError(
          error instanceof Error
            ? error.message
            : "Unable to load live weather data."
        );

        return null;
      } finally {
        if (
          activeRequestRef.current
            ?.promise === requestPromise
        ) {
          activeRequestRef.current = null;
        }

        setIsLoadingWeather(false);
      }
    },
    []
  );

  const refreshWeather =
    useCallback(
      async (
        lat: number,
        lon: number
      ) =>
        fetchWeather(
          lat,
          lon,
          true
        ),
      [fetchWeather]
    );

  const clearWeatherCache =
    useCallback(() => {
      cacheRef.current = null;
    }, []);

  return {
    weather,
    isLoadingWeather,
    weatherError,
    fetchWeather,
    refreshWeather,
    clearWeatherCache,
  };
}
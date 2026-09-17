export interface WeatherData {
  location: {
    latitude: number;
    longitude: number;
    timezone: string;
  };

  current: {
    time: string;
    temperature: number;
    precipitation: number;
    rain: number;
    wind_speed: number;
    wind_gust: number;
    wind_direction: number;
  };

  next_24_hours: {
    max_rain_probability: number;
    total_precipitation: number;
    max_wind_speed: number;
    max_wind_gust: number;
    peak_gust_time: string | null;
  };
}
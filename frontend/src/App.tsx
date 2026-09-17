import { useState } from "react";
import axios from "axios";
import "./App.css";

interface WeatherData {
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
    peak_gust_time: string;
  };
}

function App() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const getFarmWeather = () => {
  if (!navigator.geolocation) {
    setMessage("GPS is not supported by this browser.");
    return;
  }

  setLoading(true);
  setMessage("Getting your location...");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      console.log("Latitude:", lat);
      console.log("Longitude:", lon);

      try {
        setMessage("Getting weather data...");

      const response = await axios.get(
  "/api/weather",
  {
    params: {
      lat,
      lon,
    },
  }
);

        console.log(response.data);

        setWeather(response.data);
        setMessage("");
      } catch (error: any) {
  console.error("Weather API error:", error);

  if (error.response) {
    console.error(
      "Backend response:",
      error.response.data
    );

    setMessage(
      `Backend error: ${error.response.status}`
    );
  } else if (error.request) {
    setMessage(
      "Cannot connect to VazhaiGuard backend."
    );
  } else {
    setMessage(
      "Unable to request weather data."
    );
  }
} finally {
        setLoading(false);
      }
    },

    (error) => {
      console.error("GPS Error:", error);

      if (error.code === 1) {
        setMessage(
          "Location permission denied. Please allow location access in your browser."
        );
      } else if (error.code === 2) {
        setMessage(
          "Your device could not determine your current location."
        );
      } else if (error.code === 3) {
        setMessage(
          "Location request timed out. Please try again."
        );
      } else {
        setMessage("Unable to get your location.");
      }

      setLoading(false);
    },

    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    }
  );
};

  return (
    <div style={{ padding: "30px", fontFamily: "Arial" }}>
      <h1>🍌 VazhaiGuard AI</h1>

      <p>
        Pre-Storm Operational Intelligence for Banana Farms
      </p>

      <button
        onClick={getFarmWeather}
        disabled={loading}
        style={{
          padding: "12px 20px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        📍 Use My Farm Location
      </button>

      {message && <p>{message}</p>}

      {weather && (
  <div
    style={{
      marginTop: "30px",
      padding: "20px",
      border: "1px solid #ccc",
      borderRadius: "10px",
      maxWidth: "600px",
    }}
  >
    <h2>🌦 Current Farm Weather</h2>

    <p>
      📍 Latitude: {weather.location.latitude}
    </p>

    <p>
      📍 Longitude: {weather.location.longitude}
    </p>

    <p>
      🌡 Temperature: {weather.current.temperature} °C
    </p>

    <p>
      🌧 Current Rain: {weather.current.rain} mm
    </p>

    <p>
      💨 Wind Speed: {weather.current.wind_speed} km/h
    </p>

    <p>
      🌪 Wind Gust: {weather.current.wind_gust} km/h
    </p>

    <p>
      🧭 Wind Direction: {weather.current.wind_direction}°
    </p>

    <hr />

    <h2>⏱ Next 24 Hours</h2>

    <p>
      🌧 Maximum Rain Probability:{" "}
      {weather.next_24_hours.max_rain_probability}%
    </p>

    <p>
      💧 Expected Precipitation:{" "}
      {weather.next_24_hours.total_precipitation} mm
    </p>

    <p>
      💨 Maximum Wind Speed:{" "}
      {weather.next_24_hours.max_wind_speed} km/h
    </p>

    <p>
      🌪 Maximum Wind Gust:{" "}
      {weather.next_24_hours.max_wind_gust} km/h
    </p>

    <p>
      ⏰ Peak Gust Time:{" "}
      {weather.next_24_hours.peak_gust_time}
    </p>
  </div>
)}
    </div>
  );
}

export default App;
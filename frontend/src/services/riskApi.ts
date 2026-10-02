import type { WeatherData } from "../types/weather";
import type { WeatherDerivedRisk } from "../types/risk";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getWeatherDerivedRisk(
  weather: WeatherData
): WeatherDerivedRisk {
  const rainProbability = weather.next_24_hours.max_rain_probability;
  const precipitation = weather.next_24_hours.total_precipitation;
  const maxWind = weather.next_24_hours.max_wind_speed;
  const maxGust = weather.next_24_hours.max_wind_gust;

  const riskScore =
    clamp(rainProbability * 0.45, 0, 100) +
    clamp(precipitation * 2.1, 0, 30) +
    clamp(maxWind * 1.2, 0, 40) +
    clamp(maxGust * 0.8, 0, 45);

  let level: WeatherDerivedRisk["level"] = "low";
  let label = "LOW WATCH";
  let labelTa = "குறைந்த கவனம்";
  let reason =
    "Rain and wind conditions are within a manageable range for the next 24 hours.";
  let reasonTa =
    "அடுத்த 24 மணி நேரத்திற்கு மழை மற்றும் காற்று நிலை கட்டுப்படுத்தக்கூடிய வரம்பில் உள்ளது.";
  let recommendation =
    "Keep routine checks in place and continue normal field monitoring.";
  let recommendationTa =
    "வழக்கமான கண்காணிப்பை தொடருங்கள். சாதாரண வயல் பணிகளை மேற்கொள்ளலாம்.";

  if (riskScore >= 110 || rainProbability >= 75 || maxGust >= 45) {
    level = "high";
    label = "HIGH WATCH";
    labelTa = "உயர் கவனம்";
    reason =
      "Strong wind and rain are expected. The weather window may affect banana support, drainage, and field work.";
    reasonTa =
      "பலத்த காற்று மற்றும் மழை எதிர்பார்க்கப்படுகிறது. இதனால் வாழை மரங்களின் ஆதரவு, நீர் வடிகால் மற்றும் வயல் பணிகள் பாதிக்கப்படலாம்.";
    recommendation =
      "Check banana plant support, clear drainage paths, and avoid unnecessary field work during the peak weather window.";
    recommendationTa =
      "வாழை மரங்களின் ஆதரவு கயிறுகளை சரிபார்க்கவும். நீர் வடிகால் பாதைகளை சுத்தமாக்கவும். வானிலை உச்ச நேரத்தில் தேவையற்ற வயல் பணிகளை தவிர்க்கவும்.";
  } else if (
    riskScore >= 70 ||
    rainProbability >= 45 ||
    precipitation >= 8 ||
    maxGust >= 25 ||
    maxWind >= 18
  ) {
    level = "moderate";
    label = "MODERATE WATCH";
    labelTa = "மிதமான கவனம்";
    reason =
      "Rain or wind could become more noticeable in the next 24 hours, especially during stronger gust periods.";
    reasonTa =
      "அடுத்த 24 மணி நேரத்தில் மழை அல்லது காற்று சற்று அதிகமாக இருக்கலாம், குறிப்பாக பலமான காற்று காலங்களில்.";
    recommendation =
      "Review irrigation timing, inspect field drainage, and prepare for slightly slower field work.";
    recommendationTa =
      "பாசன நேரத்தை மீண்டும் பாருங்கள். வயல் வடிகால் நிலையை சரிபார்க்கவும். சற்றே மெதுவாக வயல் பணிகளை திட்டமிடுங்கள்.";
  }

  return {
    level,
    label,
    labelTa,
    reason,
    reasonTa,
    recommendation,
    recommendationTa,
    evidence: [
      {
        label: "Rain probability",
        labelTa: "மழை வாய்ப்பு",
        value: `${Math.round(rainProbability)}%`,
      },
      {
        label: "Expected rainfall",
        labelTa: "எதிர்பார்க்கும் மழை",
        value: `${precipitation.toFixed(1)} mm`,
      },
      {
        label: "Max wind speed",
        labelTa: "அதிகபட்ச காற்று வேகம்",
        value: `${maxWind.toFixed(1)} km/h`,
      },
      {
        label: "Peak gust",
        labelTa: "அதிகபட்ச காற்று அலை",
        value: `${maxGust.toFixed(1)} km/h`,
      },
    ],
  };
}

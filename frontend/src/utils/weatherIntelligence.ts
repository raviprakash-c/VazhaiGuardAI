import type { WeatherData } from "../types/weather";

export type WeatherRiskLevel =
  | "safe"
  | "watch"
  | "warning"
  | "danger";

export type WeatherInsightType =
  | "rain"
  | "wind"
  | "heat"
  | "general";

export interface WeatherInsight {
  type: WeatherInsightType;
  level: WeatherRiskLevel;

  title: string;
  message: string;
  action: string;

  titleTa: string;
  messageTa: string;
  actionTa: string;

  value?: string;
}

export interface WeatherIntelligence {
  overallLevel: WeatherRiskLevel;

  title: string;
  titleTa: string;

  summary: string;
  summaryTa: string;

  insights: WeatherInsight[];
}

function getRiskLevel(
  value: number,
  watch: number,
  warning: number,
  danger: number
): WeatherRiskLevel {
  if (value >= danger) {
    return "danger";
  }

  if (value >= warning) {
    return "warning";
  }

  if (value >= watch) {
    return "watch";
  }

  return "safe";
}

function riskScore(
  level: WeatherRiskLevel
): number {
  switch (level) {
    case "danger":
      return 4;

    case "warning":
      return 3;

    case "watch":
      return 2;

    default:
      return 1;
  }
}

export function getWeatherInsights(
  weather: WeatherData
): WeatherInsight[] {
  const insights: WeatherInsight[] = [];

  const rain =
    weather.next_24_hours
      .max_rain_probability;

  const precipitation =
    weather.next_24_hours
      .total_precipitation;

  const wind =
    weather.next_24_hours
      .max_wind_speed;

  const gust =
    weather.next_24_hours
      .max_wind_gust;

  const temperature =
    weather.current.temperature;

  /*
   * RAIN
   */
  const rainLevel =
    getRiskLevel(
      rain,
      30,
      50,
      80
    );

  if (rain >= 80) {
    insights.push({
      type: "rain",
      level: rainLevel,
      title: "High Rain Chance",
      titleTa: "அதிக மழை வாய்ப்பு",

      message:
        "Rain is highly likely during the next 24 hours.",
      messageTa:
        "அடுத்த 24 மணி நேரத்தில் மழை பெய்யும் வாய்ப்பு அதிகமாக உள்ளது.",

      action:
        "Check the field before irrigation. Avoid unnecessary watering.",
      actionTa:
        "பாசனம் செய்வதற்கு முன் வயலை சரிபார்க்கவும். தேவையில்லாத நீர்ப்பாசனத்தை தவிர்க்கவும்.",

      value: `${Math.round(rain)}%`,
    });
  } else if (rain >= 50) {
    insights.push({
      type: "rain",
      level: rainLevel,
      title: "Rain Possible",
      titleTa: "மழை பெய்ய வாய்ப்பு உள்ளது",

      message:
        "There is a moderate chance of rain during the next 24 hours.",
      messageTa:
        "அடுத்த 24 மணி நேரத்தில் மழை பெய்யும் வாய்ப்பு உள்ளது.",

      action:
        "Monitor the weather before irrigation.",
      actionTa:
        "பாசனம் செய்வதற்கு முன் வானிலையை கண்காணிக்கவும்.",

      value: `${Math.round(rain)}%`,
    });
  } else {
    insights.push({
      type: "rain",
      level: rainLevel,
      title: "Low Rain Risk",
      titleTa: "குறைந்த மழை அபாயம்",

      message:
        "Rain probability is currently low.",
      messageTa:
        "தற்போது மழை பெய்யும் வாய்ப்பு குறைவாக உள்ளது.",

      action:
        "Continue normal irrigation planning.",
      actionTa:
        "வழக்கமான பாசன திட்டத்தை தொடரலாம்.",

      value: `${Math.round(rain)}%`,
    });
  }

  /*
   * WIND
   */
  const windLevel =
    getRiskLevel(
      Math.max(wind, gust),
      15,
      25,
      45
    );

  if (
    gust >= 45 ||
    wind >= 30
  ) {
    insights.push({
      type: "wind",
      level: "danger",

      title: "Strong Wind Expected",
      titleTa: "பலத்த காற்று எதிர்பார்க்கப்படுகிறது",

      message:
        "Strong winds or gusts may occur during the next 24 hours.",
      messageTa:
        "அடுத்த 24 மணி நேரத்தில் பலத்த காற்று அல்லது காற்றழுத்த அலைகள் இருக்கலாம்.",

      action:
        "Avoid spraying pesticides or foliar nutrients during strong winds.",
      actionTa:
        "பலத்த காற்று இருக்கும் நேரத்தில் பூச்சிக்கொல்லி அல்லது இலை வழி உரம் தெளிப்பதை தவிர்க்கவும்.",

      value: `${gust.toFixed(1)} km/h`,
    });
  } else if (
    gust >= 25 ||
    wind >= 20
  ) {
    insights.push({
      type: "wind",
      level: windLevel,

      title: "Windy Conditions",
      titleTa: "காற்று அதிகமாக இருக்கலாம்",

      message:
        "Moderate to strong winds are possible.",
      messageTa:
        "மிதமான முதல் அதிகமான காற்று இருக்கலாம்.",

      action:
        "Check wind conditions before spraying.",
      actionTa:
        "தெளிப்பு பணிக்கு முன் காற்றின் நிலையை சரிபார்க்கவும்.",

      value: `${gust.toFixed(1)} km/h`,
    });
  } else {
    insights.push({
      type: "wind",
      level: "safe",

      title: "Wind Conditions Normal",
      titleTa: "காற்றின் நிலை சாதாரணமாக உள்ளது",

      message:
        "No significant strong-wind signal is currently detected.",
      messageTa:
        "தற்போது குறிப்பிடத்தக்க பலத்த காற்று அறிகுறி இல்லை.",

      action:
        "Normal farm activities can continue.",
      actionTa:
        "வழக்கமான விவசாய பணிகளை தொடரலாம்.",

      value: `${gust.toFixed(1)} km/h`,
    });
  }

  /*
   * HEAT
   */
  const heatLevel =
    getRiskLevel(
      temperature,
      30,
      34,
      38
    );

  if (temperature >= 38) {
    insights.push({
      type: "heat",
      level: heatLevel,

      title: "High Temperature",
      titleTa: "அதிக வெப்பநிலை",

      message:
        "The current temperature is very high.",
      messageTa:
        "தற்போதைய வெப்பநிலை மிகவும் அதிகமாக உள்ளது.",

      action:
        "Monitor crop water stress and avoid unnecessary field work during peak heat.",
      actionTa:
        "பயிரின் நீர் தேவையை கவனிக்கவும். அதிக வெப்ப நேரத்தில் தேவையற்ற வயல் பணிகளை தவிர்க்கவும்.",

      value: `${temperature.toFixed(1)}°C`,
    });
  } else if (temperature >= 34) {
    insights.push({
      type: "heat",
      level: heatLevel,

      title: "Warm Conditions",
      titleTa: "வெப்பமான நிலை",

      message:
        "The current temperature is relatively high.",
      messageTa:
        "தற்போதைய வெப்பநிலை சற்று அதிகமாக உள்ளது.",

      action:
        "Monitor soil moisture and crop water requirements.",
      actionTa:
        "மண்ணின் ஈரப்பதம் மற்றும் பயிரின் நீர் தேவையை கவனிக்கவும்.",

      value: `${temperature.toFixed(1)}°C`,
    });
  } else {
    insights.push({
      type: "heat",
      level: "safe",

      title: "Temperature Normal",
      titleTa: "வெப்பநிலை சாதாரணமாக உள்ளது",

      message:
        "Current temperature is within a moderate range.",
      messageTa:
        "தற்போதைய வெப்பநிலை மிதமான நிலையில் உள்ளது.",

      action:
        "Continue normal crop monitoring.",
      actionTa:
        "வழக்கமான பயிர் கண்காணிப்பை தொடரலாம்.",

      value: `${temperature.toFixed(1)}°C`,
    });
  }

  /*
   * RAINFALL
   */
  if (precipitation > 0) {
    insights.push({
      type: "general",
      level: "watch",

      title: "Rainfall Expected",
      titleTa: "மழைப்பொழிவு எதிர்பார்க்கப்படுகிறது",

      message:
        `${precipitation.toFixed(1)} mm of precipitation is expected over the next 24 hours.`,

      messageTa:
        `அடுத்த 24 மணி நேரத்தில் சுமார் ${precipitation.toFixed(1)} மிமீ மழைப்பொழிவு எதிர்பார்க்கப்படுகிறது.`,

      action:
        "Consider expected rainfall when planning irrigation.",
      actionTa:
        "பாசன திட்டமிடும்போது எதிர்பார்க்கப்படும் மழையை கணக்கில் கொள்ளவும்.",

      value:
        `${precipitation.toFixed(1)} mm`,
    });
  }

  return insights;
}

export function getWeatherIntelligence(
  weather: WeatherData
): WeatherIntelligence {
  const insights =
    getWeatherInsights(weather);

  const highestRisk =
    insights.reduce<WeatherRiskLevel>(
      (highest, insight) =>
        riskScore(insight.level) >
        riskScore(highest)
          ? insight.level
          : highest,
      "safe"
    );

  switch (highestRisk) {
    case "danger":
      return {
        overallLevel: "danger",

        title:
          "Weather needs immediate attention",
        titleTa:
          "வானிலை நிலையை உடனடியாக கவனிக்க வேண்டும்",

        summary:
          "Strong weather signals are present. Review the recommended farm actions before sensitive field work.",
        summaryTa:
          "வானிலையில் முக்கியமான எச்சரிக்கை அறிகுறிகள் உள்ளன. முக்கியமான வயல் பணிகளை தொடங்குவதற்கு முன் பரிந்துரைகளை சரிபார்க்கவும்.",

        insights,
      };

    case "warning":
      return {
        overallLevel: "warning",

        title:
          "Weather conditions need attention",
        titleTa:
          "வானிலை நிலையை கவனிக்க வேண்டும்",

        summary:
          "Rain, wind or heat may affect today's farm activities. Check conditions before important work.",
        summaryTa:
          "மழை, காற்று அல்லது வெப்பநிலை இன்று விவசாய பணிகளை பாதிக்கலாம். முக்கியமான பணிக்கு முன் நிலையை சரிபார்க்கவும்.",

        insights,
      };

    case "watch":
      return {
        overallLevel: "watch",

        title:
          "Keep watching the weather",
        titleTa:
          "வானிலையை தொடர்ந்து கவனிக்கவும்",

        summary:
          "Some weather changes are possible. Use the forecast when planning irrigation and field work.",
        summaryTa:
          "சில வானிலை மாற்றங்கள் ஏற்படலாம். பாசனம் மற்றும் வயல் பணிகளை திட்டமிடும்போது முன்னறிவிப்பை பயன்படுத்தவும்.",

        insights,
      };

    default:
      return {
        overallLevel: "safe",

        title:
          "Weather looks relatively calm",
        titleTa:
          "வானிலை தற்போது சாதாரணமாக உள்ளது",

        summary:
          "No major weather warning was detected from the available 24-hour weather data.",
        summaryTa:
          "கிடைக்கும் 24 மணி நேர வானிலை தரவின் அடிப்படையில் பெரிய எச்சரிக்கை எதுவும் கண்டறியப்படவில்லை.",

        insights,
      };
  }
}
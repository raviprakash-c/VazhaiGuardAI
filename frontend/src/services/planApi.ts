import type { WeatherData } from "../types/weather";
import type { WeatherActionPlan } from "../types/plan";
import { getWeatherDerivedRisk } from "./riskApi";

export function getWeatherActionPlan(
  weather: WeatherData
): WeatherActionPlan {
  const risk = getWeatherDerivedRisk(weather);

  const before = [
    {
      category: "before" as const,
      title: "Check plant support",
      titleTa: "வாழை மர ஆதரவை சரிபார்க்கவும்",
      description:
        "Tighten loose support strings and inspect leaning plants before the weather window.",
      descriptionTa:
        "வானிலை வருவதற்கு முன் தளர்வான ஆதரவு கயிறுகளை இறுக்கவும். சாய்ந்த மரங்களை சரிபார்க்கவும்.",
    },
    {
      category: "before" as const,
      title: "Check drainage",
      titleTa: "வடிகால் பாதையை சரிபார்க்கவும்",
      description:
        "Open blocked drains and confirm water can move away from the root zone.",
      descriptionTa:
        "தடுக்கப்பட்ட வடிகால் பாதைகளை திறக்கவும். வேர்பகுதிக்கு நீர் தேங்காமல் இருப்பதை உறுதிசெய்யவும்.",
    },
    {
      category: "before" as const,
      title: "Secure loose materials",
      titleTa: "தளர்வான பொருட்களை பாதுகாக்கவும்",
      description:
        "Remove or tie down lightweight materials that could be lifted by wind.",
      descriptionTa:
        "காற்றினால் இழுக்கப்படும் சிறிய பொருட்களை அகற்றி அல்லது இறுக்கமாக கட்டிவைக்கவும்.",
    },
  ];

  const during = [
    {
      category: "during" as const,
      title: "Avoid unnecessary field work",
      titleTa: "தேவையற்ற வயல் பணிகளை தவிர்க்கவும்",
      description:
        "Postpone non-essential work when rain and gusts are strongest.",
      descriptionTa:
        "மழை மற்றும் காற்று அதிகமாக இருக்கும் நேரத்தில் அவசியமில்லாத பணிகளை ஒத்திவைக்கவும்.",
    },
    {
      category: "during" as const,
      title: "Watch for standing water",
      titleTa: "நீர் தேங்குவதை கண்காணிக்கவும்",
      description:
        "Monitor low-lying patches where runoff can collect around plant roots.",
      descriptionTa:
        "மரங்களுக்கு அருகே நீர் தேங்கும் பகுதியை கவனிக்கவும். வேர்களுக்கு சுற்றிலும் நீர் குவிவதை தடுப்பது முக்கியம்.",
    },
  ];

  const after = [
    {
      category: "after" as const,
      title: "Inspect damaged plants",
      titleTa: "சேதமடைந்த மரங்களை பரிசோதிக்கவும்",
      description:
        "Check for snapped leaves, loosened supports, or waterlogging after the weather window.",
      descriptionTa:
        "வானிலை முடிந்த பிறகு முறிந்த இலைகள், தளர்ந்த ஆதரவு மற்றும் நீர் தேங்கிய பகுதிகளை சரிபார்க்கவும்.",
    },
    {
      category: "after" as const,
      title: "Record field conditions",
      titleTa: "வயல் நிலையை பதிவுசெய்யவும்",
      description:
        "Note where drainage or support failed so the next weather check is easier.",
      descriptionTa:
        "வடிகால் அல்லது ஆதரவு எங்கு தோல்வியடைந்தது என்பதை பதிவு செய்யுங்கள். அடுத்த முறை சுலபமாக கவனிக்கலாம்.",
    },
  ];

  if (risk.level === "high") {
    return {
      summary:
        "A strong weather window is expected. Focus on support, drainage, and reducing field exposure.",
      summaryTa:
        "பலத்த காற்று மற்றும் மழை காலம் எதிர்பார்க்கப்படுகிறது. ஆதரவு, வடிகால் மற்றும் வயல் வெளிப்பாட்டைக் குறைப்பதில் கவனம் செலுத்துங்கள்.",
      steps: [...before.slice(0, 2), ...during, ...after.slice(0, 1)],
    };
  }

  if (risk.level === "moderate") {
    return {
      summary:
        "The next 24 hours need proactive monitoring and careful irrigation timing.",
      summaryTa:
        "அடுத்த 24 மணி நேரத்தில் முன்கூட்டியே கண்காணிப்பு மற்றும் கவனமான பாசன நேரம் தேவைப்படுகிறது.",
      steps: [...before.slice(0, 2), ...during, ...after],
    };
  }

  return {
    summary:
        "Conditions are relatively calm. Maintain normal checks and keep drainage clear.",
    summaryTa:
        "நிலை ஒப்பீட்டளவில் சுமாராக உள்ளது. வழக்கமான கண்காணிப்பை தொடருங்கள், வடிகால் பாதையை சுத்தமாக வைத்திருங்கள்.",
    steps: [before[0], before[1], during[0], after[0]],
  };
}

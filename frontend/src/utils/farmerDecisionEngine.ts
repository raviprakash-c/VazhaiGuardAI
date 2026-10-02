import type { WeatherData } from "../types/weather";

export type DecisionUrgency = "normal" | "monitor" | "today" | "now";
export type DecisionPriority = "critical" | "high" | "medium" | "low";

export interface FarmerAction {
  id: string;
  priority: DecisionPriority;
  urgency: DecisionUrgency;
  title: string;
  titleTa: string;
  reason: string;
  reasonTa: string;
  timing: string;
  timingTa: string;
  resource: string;
  resourceTa: string;
  done: boolean;
}

export interface FarmerDecisionPlan {
  status: "favorable" | "monitor" | "attention";
  urgency: DecisionUrgency;
  headline: string;
  headlineTa: string;
  explanation: string;
  explanationTa: string;
  confidence: "high" | "medium";
  generatedAt: string;
  actions: FarmerAction[];
}

function action(
  input: Omit<FarmerAction, "done">
): FarmerAction {
  return { ...input, done: false };
}

export function buildFarmerDecisionPlan(
  weather: WeatherData
): FarmerDecisionPlan {
  const rain = weather.next_24_hours.max_rain_probability;
  const precipitation = weather.next_24_hours.total_precipitation;
  const wind = weather.next_24_hours.max_wind_speed;
  const gust = weather.next_24_hours.max_wind_gust;

  const highRain = rain >= 80 || precipitation >= 15;
  const moderateRain = rain >= 50 || precipitation >= 5;
  const highWind = gust >= 45 || wind >= 25;
  const moderateWind = gust >= 30 || wind >= 18;

  const actions: FarmerAction[] = [];

  if (highWind) {
    actions.push(
      action({
        id: "secure-support",
        priority: "critical",
        urgency: "now",
        title: "Check banana plant support",
        titleTa: "வாழை மர ஆதரவை சரிபார்க்கவும்",
        reason: "Strong gusts can increase exposure for leaning or weakly supported plants.",
        reasonTa: "பலத்த காற்று சாய்ந்த அல்லது பலவீனமான ஆதரவு உள்ள மரங்களுக்கு பாதிப்பை அதிகரிக்கலாம்.",
        timing: "Do this before the strongest wind window.",
        timingTa: "பலத்த காற்று வருவதற்கு முன் இதை செய்யுங்கள்.",
        resource: "Check support ropes/stakes and available help.",
        resourceTa: "ஆதரவு கயிறு/கம்பிகள் மற்றும் கிடைக்கும் உதவியை சரிபார்க்கவும்.",
      })
    );
  } else if (moderateWind) {
    actions.push(
      action({
        id: "inspect-support",
        priority: "high",
        urgency: "today",
        title: "Inspect plant support",
        titleTa: "மர ஆதரவை ஆய்வு செய்யவும்",
        reason: "Moderate-to-strong winds are possible during the next 24 hours.",
        reasonTa: "அடுத்த 24 மணி நேரத்தில் மிதமானது முதல் பலமான காற்று இருக்கலாம்.",
        timing: "Complete a quick field check today.",
        timingTa: "இன்று ஒரு விரைவான வயல் சோதனை செய்யுங்கள்.",
        resource: "Check support ropes/stakes before entering exposed areas.",
        resourceTa: "வெளிப்புற பகுதிகளுக்கு செல்வதற்கு முன் ஆதரவு கயிறு/கம்பிகளை சரிபார்க்கவும்.",
      })
    );
  }

  if (highRain || moderateRain) {
    actions.push(
      action({
        id: "check-drainage",
        priority: highRain ? "critical" : "high",
        urgency: highRain ? "now" : "today",
        title: "Check field drainage",
        titleTa: "வயல் வடிகாலை சரிபார்க்கவும்",
        reason: highRain
          ? "High rainfall potential makes blocked drainage more important to address early."
          : "Rain is possible, so low-lying areas should be checked before water collects.",
        reasonTa: highRain
          ? "அதிக மழை வாய்ப்பு இருப்பதால் அடைப்பட்ட வடிகால்களை முன்கூட்டியே சரிபார்ப்பது முக்கியம்."
          : "மழை வாய்ப்பு இருப்பதால் தாழ்வான பகுதிகளில் நீர் தேங்குமா என்பதை முன்கூட்டியே பார்க்க வேண்டும்.",
        timing: highRain ? "Check before the expected rain period." : "Check during today's field round.",
        timingTa: highRain ? "எதிர்பார்க்கப்படும் மழைக்கு முன் சரிபார்க்கவும்." : "இன்றைய வயல் சுற்றுப்பார்வையில் சரிபார்க்கவும்.",
        resource: "Check drains, channels and low-lying patches.",
        resourceTa: "வடிகால், கால்வாய் மற்றும் தாழ்வான பகுதிகளை சரிபார்க்கவும்.",
      })
    );
  }

  if (precipitation >= 10) {
    actions.push(
      action({
        id: "review-irrigation",
        priority: "high",
        urgency: "today",
        title: "Review irrigation timing",
        titleTa: "பாசன நேரத்தை மறுபரிசீலனை செய்யவும்",
        reason: "Meaningful rainfall is forecast, so irrigation should be considered together with current soil and crop conditions.",
        reasonTa: "குறிப்பிடத்தக்க மழை எதிர்பார்க்கப்படுவதால் மண் மற்றும் பயிர் நிலையை பார்த்து பாசனத்தை முடிவு செய்ய வேண்டும்.",
        timing: "Review before the next irrigation cycle.",
        timingTa: "அடுத்த பாசனத்திற்கு முன் மறுபரிசீலனை செய்யுங்கள்.",
        resource: "Check soil moisture and crop condition before deciding.",
        resourceTa: "முடிவு செய்வதற்கு முன் மண் ஈரப்பதம் மற்றும் பயிர் நிலையை சரிபார்க்கவும்.",
      })
    );
  }

  actions.push(
    action({
      id: "field-recheck",
      priority: highRain || highWind ? "medium" : "low",
      urgency: highRain || highWind ? "monitor" : "normal",
      title: "Recheck the field after the weather window",
      titleTa: "வானிலை முடிந்த பிறகு வயலை மீண்டும் பாருங்கள்",
      reason: "A short inspection helps identify waterlogging, leaning plants, or damaged supports.",
      reasonTa: "சிறிய ஆய்வு மூலம் நீர் தேக்கம், சாய்ந்த மரங்கள் அல்லது சேதமான ஆதரவை கண்டறியலாம்.",
      timing: "Recheck after the rain or strong-wind period passes.",
      timingTa: "மழை அல்லது பலத்த காற்று முடிந்த பிறகு மீண்டும் சரிபார்க்கவும்.",
      resource: "Keep a simple note or photo of anything that needs follow-up.",
      resourceTa: "மேலும் கவனம் தேவைப்படும் விஷயங்களை குறிப்பு அல்லது புகைப்படமாக வைத்துக்கொள்ளுங்கள்.",
    })
  );

  actions.sort((a, b) => {
    const order: Record<DecisionPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return order[a.priority] - order[b.priority];
  });

  const status = highRain || highWind
    ? "attention"
    : moderateRain || moderateWind
      ? "monitor"
      : "favorable";

  const urgency = highRain || highWind
    ? "now"
    : moderateRain || moderateWind
      ? "today"
      : "normal";

  return {
    status,
    urgency,
    headline:
      status === "attention"
        ? "A weather-sensitive field window needs attention."
        : status === "monitor"
          ? "The next 24 hours need a proactive field check."
          : "Conditions are relatively calm; continue normal field checks.",
    headlineTa:
      status === "attention"
        ? "வானிலை காரணமாக வயலில் சில முக்கிய பணிகளை முன்கூட்டியே செய்ய வேண்டும்."
        : status === "monitor"
          ? "அடுத்த 24 மணி நேரத்தில் முன்கூட்டியே வயலை கவனிப்பது நல்லது."
          : "நிலை ஒப்பீட்டளவில் சீராக உள்ளது; வழக்கமான வயல் கண்காணிப்பை தொடருங்கள்.",
    explanation:
      highRain || highWind
        ? "Prioritize the first actions before the expected weather window."
        : moderateRain || moderateWind
          ? "Use the action list as a practical checklist for today's field round."
          : "No major weather-driven intervention is indicated by the current forecast.",
    explanationTa:
      highRain || highWind
        ? "எதிர்பார்க்கப்படும் வானிலைக்கு முன் முதல் முக்கிய பணிகளை முடிக்கவும்."
        : moderateRain || moderateWind
          ? "இன்றைய வயல் சுற்றுப்பார்வைக்கு இந்த பட்டியலை நடைமுறை சரிபார்ப்பு பட்டியலாக பயன்படுத்துங்கள்."
          : "தற்போதைய வானிலை கணிப்பில் பெரிய அவசர நடவடிக்கை தேவையில்லை.",
    confidence: "high",
    generatedAt: new Date().toISOString(),
    actions,
  };
}

export function saveFarmerDecisionPlan(plan: FarmerDecisionPlan): void {
  try {
    localStorage.setItem("vazhaiguard_latest_decision_plan", JSON.stringify(plan));
  } catch {
    // Local storage is an enhancement; the plan remains usable in memory.
  }
}

import { useEffect, useMemo, useState } from "react";
import { Camera, CheckCircle2, CircleHelp, Clock3, Leaf, MessageCircle, RefreshCw, Volume2 } from "lucide-react";
import { getLatestAgentLoop, getStoredFarmContext, sendActionFeedback } from "../services/agentApi";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import type { CopilotLanguage, CopilotLoopState } from "../types/copilot";

interface FeedbackChoice { key: "completed" | "unable" | "needs_help" | "recheck"; tamil: string; english: string; icon: typeof CheckCircle2; }
const choices: FeedbackChoice[] = [
  { key: "completed", tamil: "செய்துவிட்டேன்", english: "Done", icon: CheckCircle2 },
  { key: "unable", tamil: "இப்போது முடியவில்லை", english: "Not now", icon: Clock3 },
  { key: "needs_help", tamil: "உதவி வேண்டும்", english: "Need help", icon: CircleHelp },
  { key: "recheck", tamil: "மீண்டும் படம் பார்க்கவும்", english: "Check again", icon: RefreshCw },
];

function readLoop(): CopilotLoopState | null {
  const stored = getLatestAgentLoop<CopilotLoopState>();
  if (stored?.primary_action && Object.keys(stored.primary_action).length > 0) return stored;

  const raw = window.localStorage.getItem("vazhaiguard_last_decision");
  if (!raw) return stored;
  try {
    const decision = JSON.parse(raw) as any;
    const action = decision.action || decision.decision?.action || decision.decision?.priority_actions?.[0]?.action || "";
    const reason = decision.reason || decision.decision?.reason || decision.decision?.priority_actions?.[0]?.reason || "";
    const score = decision.risk?.score;
    const level = decision.risk?.level;
    if (!action) return stored;
    return {
      state: decision.vision?.needs_field_verification ? "field_verification" : "wait_for_farmer",
      action_id: `inspection-${localStorage.getItem("vazhaiguard_last_decision_at") || Date.now()}`,
      primary_action: { action, reason },
      follow_up_check: decision.follow_up_check || decision.decision?.follow_up_check || "மீண்டும் இலை அல்லது பழத்தின் தெளிவான படத்தை எடுத்து சரிபார்க்கவும்.",
      recheck_after: decision.recheck_after || decision.decision?.recheck_after || null,
      needs_field_verification: Boolean(decision.vision?.needs_field_verification),
      risk: { score, level, signals_used: decision.risk?.signals_used || [] },
    };
  } catch { return stored; }
}

export default function FarmerActionsPage() {
  const [language, setLanguage] = useState<CopilotLanguage>("ta-IN");
  const [loop, setLoop] = useState<CopilotLoopState | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { speak } = useVoiceAssistant();

  useEffect(() => {
    setLoop(readLoop());
    const onStorage = () => setLoop(readLoop());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const tamil = language === "ta-IN";
  const context = useMemo(() => getStoredFarmContext(), []);
  const primaryAction = loop?.primary_action || {};
  const actionText = String(primaryAction.action || "");
  const reasonText = String(primaryAction.reason || "");

  const submitFeedback = async (outcome: FeedbackChoice["key"]) => {
    if (!loop?.action_id || busy) return;
    setBusy(true);
    try {
      const result = await sendActionFeedback({
        action_id: loop.action_id,
        outcome,
        farmer_id: typeof context.farm_id === "string" ? context.farm_id : null,
        language,
      });
      setMessage(result.farmer_message);
      setLoop({ ...loop, state: result.next_state });
      window.localStorage.setItem("vazhaiguard_latest_agent_loop", JSON.stringify({ ...loop, state: result.next_state }));
      speak(result.farmer_message, language);
    } catch (error) {
      console.error("[FarmerActions] feedback failed", error);
      setMessage(tamil ? "பதிவு செய்ய முடியவில்லை. மீண்டும் முயற்சி செய்யுங்கள்." : "Could not save the update. Please try again.");
    } finally { setBusy(false); }
  };

  const stateLabel = loop?.state === "field_verification" ? tamil ? "இப்போது சரிபார்க்க வேண்டியது" : "Check this now" : loop?.state === "recheck_due" ? tamil ? "மீண்டும் சரிபார்க்க வேண்டிய நேரம்" : "Ready for a re-check" : tamil ? "அடுத்த நடவடிக்கைக்கு தயாராக உள்ளது" : "Ready for the next step";

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="mb-6 rounded-3xl bg-[#073b2a] p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#b8df4b]"><Leaf className="h-4 w-4" /> VazhaiGuard AI</div><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{tamil ? "இப்போது என்ன செய்ய வேண்டும்?" : "What should I do now?"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">{tamil ? "AI சொன்ன நடவடிக்கையை செய்து முடித்ததும், முடிந்தது அல்லது உதவி வேண்டும் என்று சொல்லுங்கள். அடுத்த படியை AI வழிகாட்டும்." : "After you try the recommended action, tell the assistant what happened. It will guide the next step."}</p></div>
          <div className="flex gap-2 rounded-2xl bg-white/10 p-1"><button onClick={() => setLanguage("ta-IN")} className={`rounded-xl px-4 py-2 text-xs font-bold ${tamil ? "bg-white text-[#073b2a]" : "text-white/70"}`}>தமிழ்</button><button onClick={() => setLanguage("en-IN")} className={`rounded-xl px-4 py-2 text-xs font-bold ${!tamil ? "bg-white text-[#073b2a]" : "text-white/70"}`}>English</button></div>
        </div>
      </section>

      {!loop || !actionText ? <section className="rounded-3xl border border-dashed border-[#cfe0d4] bg-white p-8 text-center shadow-sm"><Camera className="mx-auto h-10 w-10 text-[#146c43]" /><h2 className="mt-4 text-xl font-bold text-[#13271d]">{tamil ? "இன்னும் நடவடிக்கை இல்லை" : "No pending action yet"}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{tamil ? "பயிரின் புதிய படம் எடுத்து ஆய்வு செய்யுங்கள் அல்லது Copilot-ல் கேள்வி கேளுங்கள். முடிவு வந்ததும் அடுத்த நடவடிக்கை இங்கே வரும்." : "Inspect a crop photo or ask the Copilot a question. A recommended action will appear here when one is available."}</p></section> :
        <div className="space-y-5">
          <section className="rounded-3xl border border-[#dce9e0] bg-white p-5 shadow-sm sm:p-7"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#edf7e8] text-[#146c43]"><CheckCircle2 className="h-6 w-6" /></div><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#146c43]">{stateLabel}</p><h2 className="mt-2 text-2xl font-bold leading-tight text-[#13271d]">{actionText}</h2>{reasonText && <p className="mt-3 text-sm leading-6 text-muted-foreground">{reasonText}</p>}{loop.risk?.level && <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-[#f3f7e8] px-3 py-1.5 text-[#315e2b]">Risk: {loop.risk.level}</span>{typeof loop.risk.score === "number" && <span className="rounded-full bg-[#f5f5f5] px-3 py-1.5 text-muted-foreground">{Math.round(loop.risk.score)}/100</span>}<span className="rounded-full bg-[#f5f5f5] px-3 py-1.5 text-muted-foreground">{loop.risk.signals_used?.length || 0} evidence sources</span></div>}</div><button type="button" onClick={() => speak(actionText, language)} className="rounded-2xl border border-border p-3" aria-label="Speak action"><Volume2 className="h-5 w-5" /></button></div></section>
          {loop.follow_up_check && <section className="rounded-3xl border border-[#dce9e0] bg-[#f7fbf5] p-5 sm:p-6"><div className="flex gap-3"><MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#146c43]" /><div><p className="text-sm font-bold text-[#13271d]">{tamil ? "அடுத்த முறை பார்க்க வேண்டியது" : "What to check next"}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{loop.follow_up_check}</p></div></div></section>}
          <section className="rounded-3xl border border-[#dce9e0] bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-bold text-[#13271d]">{tamil ? "நான் செய்தது என்ன?" : "Tell the AI what happened"}</h2><p className="mt-1 text-sm text-muted-foreground">{tamil ? "ஒரு பொத்தானை மட்டும் தேர்வு செய்யுங்கள்." : "Choose one simple update."}</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{choices.map((choice) => { const Icon = choice.icon; return <button key={choice.key} type="button" disabled={busy} onClick={() => void submitFeedback(choice.key)} className="flex min-h-16 items-center gap-3 rounded-2xl border border-[#dce9e0] bg-white px-4 text-left transition hover:border-[#9bc87b] hover:bg-[#f8fbf6] disabled:opacity-50"><Icon className="h-5 w-5 shrink-0 text-[#146c43]" /><span className="font-semibold text-[#13271d]">{tamil ? choice.tamil : choice.english}</span></button>; })}</div>{message && <div className="mt-4 rounded-2xl bg-[#edf7e8] p-4 text-sm font-semibold leading-6 text-[#315e2b]">{message}</div>}</section>
        </div>}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Keyboard, Languages, Leaf, Mic, Sparkles, TriangleAlert } from "lucide-react";
import VoiceAssistantCard from "../components/voice/VoiceAssistantCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { sendVoiceRegistrationTurn, startVoiceRegistration } from "../services/voiceApi";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import { playTamilAcceptedTurn, playTamilQuestion, playTamilRetry, stopTamilQuestion } from "../lib/tamilVoice";
import type { RegistrationField, VoiceFarmState, VoiceLanguage } from "../types/voice";

// --- Types ---
type ConversationMessage = { role: "assistant" | "user"; text: string };

// --- Constants ---
const fieldNumber: Record<RegistrationField, number> = {
  farm_name: 1, total_farm_acres: 2, banana_area_acres: 3, banana_variety: 4,
  planting_age: 5, approximate_plants: 6, drainage: 7, support: 8, accessibility: 9, complete: 9,
};

// --- Safe Initial State Helper ---
const getEmptyState = (): VoiceFarmState => ({
  farm_name: "",
  total_farm_acres: undefined,
  banana_area_acres: undefined,
  banana_variety: "",
  planting_age: "",
  approximate_plants: undefined,
  drainage: undefined,      // ✅ Changed from "" to undefined
  support: undefined,       // ✅ Changed from "" to undefined
  accessibility: undefined, // ✅ Changed from "" to undefined
});

export default function VoiceRegistrationPage() {
  const navigate = useNavigate();
  const speakTimerRef = useRef<number | null>(null);

  // State
  const [language, setLanguage] = useState<VoiceLanguage>("ta-IN");
  const [sessionId, setSessionId] = useState("");
  const [currentField, setCurrentField] = useState<RegistrationField>("farm_name");
  const [question, setQuestion] = useState("");
  
  // FIX: Initialize with safe empty state immediately
  const [farmState, setFarmState] = useState<VoiceFarmState>(getEmptyState());
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [complete, setComplete] = useState(false);
  const [pageError, setPageError] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [showTyping, setShowTyping] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);

  const {
    isListening, isSpeaking, liveTranscript, voiceError, tamilVoiceAvailable,
    speak, startListening, stopListening, cancelSpeech, setLiveTranscript,
  } = useVoiceAssistant();

  // --- Helpers ---
  const speakCurrentQuestion = useCallback((field: RegistrationField, text: string) => {
    cancelSpeech();
    stopTamilQuestion();
    if (language === "ta-IN") {
      void playTamilQuestion(field);
    } else {
      speak(text, language);
    }
  }, [cancelSpeech, language, speak]);

  // --- Initialization ---
  const initialise = useCallback(async () => {
    try {
      setPageError("");
      setComplete(false);
      setFarmState(getEmptyState()); // Reset to safe state
      setConversation([]);
      setLiveTranscript("");
      stopTamilQuestion();
      cancelSpeech();

      const response = await startVoiceRegistration(language);

      // Safety Check: Ensure response has data
      if (!response || !response.farm_state) {
        throw new Error("Invalid response from server");
      }

      setSessionId(response.session_id);
      setCurrentField(response.current_field as RegistrationField);
      setQuestion(response.question);
      setFarmState(response.farm_state); // Merge with server data

      setConversation([{ role: "assistant", text: response.question }]);

      if (speakTimerRef.current !== null) window.clearTimeout(speakTimerRef.current);

      speakTimerRef.current = window.setTimeout(() => {
        speakCurrentQuestion(response.current_field as RegistrationField, response.question);
        speakTimerRef.current = null;
      }, 700);
    } catch (error) {
      console.error("VOICE START ERROR:", error);
      setPageError(language === "ta-IN" ? "தொடங்க முடியவில்லை." : "Unable to start.");
    }
  }, [language, speakCurrentQuestion, cancelSpeech, setLiveTranscript]);

  useEffect(() => {
    void initialise();
    return () => {
      if (speakTimerRef.current !== null) window.clearTimeout(speakTimerRef.current);
      stopTamilQuestion();
      cancelSpeech();
    };
  }, [initialise, cancelSpeech]);

  // --- Process Answer ---
  const processAnswer = useCallback(async (transcript: string) => {
  const clean = transcript.trim();
  if (!clean) return;

  setIsProcessing(true);
  setPageError("");
  
  // Stop current audio/mic
  stopTamilQuestion();
  cancelSpeech();

  setConversation((prev) => [...prev, { role: "user", text: clean }]);

  try {
    const response = await sendVoiceRegistrationTurn({
      session_id: sessionId,
      language,
      current_field: currentField,
      transcript: clean,
      farm_state: farmState,
    });

    if (!response || !response.farm_state) {
      throw new Error("Invalid response");
    }

    // 1. Update State
    setFarmState(response.farm_state);
    setCurrentField(response.next_field as RegistrationField);
    setQuestion(response.next_question);
    setComplete(response.complete);

    if (response.complete) {
      localStorage.setItem("vazhaiguard_farm_profile", JSON.stringify(response.farm_state));
    }

    setConversation((prev) => [...prev, { role: "assistant", text: response.reply_text }]);

    // ===============================================
    // ✅ FIX: AUTO-PLAY NEXT QUESTION HERE
    // ===============================================
    
    // Small delay to let React render the new question text first
    setTimeout(() => {
      if (language === "ta-IN") {
        // Play the Tamil MP3 for the NEW field
        if (response.accepted) {
           void playTamilAcceptedTurn(response.next_field as RegistrationField);
        } else {
           void playTamilRetry(response.current_field as RegistrationField);
        }
      } else {
        // Speak English via Browser
        speak(response.reply_text + " " + response.next_question, language);
      }
    }, 500); 
    // ===============================================

  } catch (error: unknown) {
    console.error("VOICE ERROR:", error);
    setPageError("பதிலை செயலாக்க முடியவில்லை.");
    
    if (language === "ta-IN") {
      void playTamilRetry(currentField);
    }
  } finally {
    setIsProcessing(false);
  }
}, [cancelSpeech, currentField, farmState, language, sessionId, speak]); // Dependencies, [cancelSpeech, currentField, farmState, language, sessionId, speak]);

  // --- Handlers ---
  const beginListening = () => {
    stopTamilQuestion();
    cancelSpeech();
    startListening(language, (finalTranscript) => void processAnswer(finalTranscript));
  };

  const submitTypedAnswer = () => {
    const answer = typedAnswer.trim();
    if (!answer) return;
    setLiveTranscript(answer);
    void processAnswer(answer);
    setTypedAnswer("");
  };

  const changeLanguage = (newLang: VoiceLanguage) => {
    stopTamilQuestion();
    cancelSpeech();
    setLanguage(newLang);
  };

  // --- Render ---
  return (
    <div className="mx-auto w-full max-w-[1350px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Header */}
      <section className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf5ec]">
              <Mic className="h-[18px] w-[18px] text-[#146c43]" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.13em] text-[#146c43]">Voice Farm Registration</span>
          </div>
          <h1 className="vg-heading mt-3 text-3xl font-bold tracking-[-0.04em] text-[#13271d] sm:text-4xl">
            பேசுங்கள். VazhaiGuard புரிந்துகொள்ளும்.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            படிக்கவோ type செய்யவோ தேவையில்லை.
          </p>
        </div>
        <div className="flex w-fit rounded-2xl border border-border bg-white p-1 shadow-sm">
          <button onClick={() => changeLanguage("ta-IN")} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${language === "ta-IN" ? "bg-[#073b2a] text-white" : "text-muted-foreground"}`}>
            <Languages className="h-4 w-4" /> தமிழ்
          </button>
          <button onClick={() => changeLanguage("en-IN")} className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition ${language === "en-IN" ? "bg-[#073b2a] text-white" : "text-muted-foreground"}`}>
            English
          </button>
        </div>
      </section>

      {/* Errors */}
      {(pageError || voiceError) && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <p className="text-xs leading-5 text-red-700">{pageError || voiceError}</p>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <VoiceAssistantCard
          language={language}
          question={complete ? (language === "ta-IN" ? "பதிவு முடிந்தது" : "Complete") : question}
          transcript={liveTranscript}
          isListening={isListening}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          step={fieldNumber[currentField] || 1}
          totalSteps={9}
          onListen={beginListening}
          onStop={stopListening}
          onReplay={() => speakCurrentQuestion(currentField, question)}
        />

        <aside className="vg-card p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#146c43]">Live Farm Profile</p>
              <h2 className="vg-heading mt-1 text-xl font-bold">பதிவு செய்யப்பட்ட தகவல்</h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf5ec]">
              <Leaf className="h-5 w-5 text-[#146c43]" />
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            {/* Safe Rendering with Optional Chaining */}
            <ProfileValue label="தோட்டத்தின் பெயர்" value={farmState?.farm_name} />
            <ProfileValue label="மொத்த நிலப்பரப்பு" value={farmState?.total_farm_acres ? `${farmState.total_farm_acres} acres` : undefined} />
            <ProfileValue label="வாழை வகை" value={farmState?.banana_variety} />
            <ProfileValue label="வடிகால்" value={farmState?.drainage} />
            <ProfileValue label="ஆதரவு கம்பு" value={farmState?.support} />
            <ProfileValue label="அணுகல்" value={farmState?.accessibility} />
          </div>

          {complete && (
  <Button onClick={() => {
    localStorage.setItem("vazhaiguard_farm_profile", JSON.stringify(farmState));
    navigate("/farm/location"); // ✅ Ensure this path exists in your router
  }}>
    Satellite Map-க்கு தொடரவும்
  </Button>
)}
        </aside>
      </div>
      
      {/* Typing Fallback */}
      {!complete && (
        <section className="mt-5">
          {!showTyping ? (
            <button onClick={() => setShowTyping(true)} className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Keyboard className="h-4 w-4" /> பேச முடியவில்லையா? Type செய்யலாம்
            </button>
          ) : (
            <div className="vg-card flex flex-col gap-3 p-4 sm:flex-row">
              <Input value={typedAnswer} onChange={(e) => setTypedAnswer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitTypedAnswer()} placeholder="உங்கள் பதிலை இங்கே எழுதலாம்..." className="h-11 rounded-xl" />
              <Button onClick={submitTypedAnswer} className="h-11 rounded-xl bg-[#073b2a]">அனுப்பு</Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ProfileValue({ label, value }: { label: string; value?: string | number | null }) {
  const available = value !== undefined && value !== null && value !== "";
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-[#fafcfb] px-3.5 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {available ? (
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#22a35a]" />
          <p className="max-w-[160px] truncate text-xs font-semibold text-[#13271d]">{String(value)}</p>
        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground/50">இன்னும் இல்லை</span>
      )}
    </div>
  );
}
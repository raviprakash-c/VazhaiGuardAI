import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Languages,
  Leaf,
  Loader2,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import ChatMessage from "../components/copilot/ChatMessage";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import { askCopilot, getStoredFarmContext } from "../services/agentApi";
import type { CopilotLanguage } from "../types/copilot";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const initialTamil =
  "வணக்கம்! நான் VazhaiGuard AI. உங்கள் தோட்டம், மழை, காற்று அல்லது பயிர் பற்றிய கேள்வியை கேளுங்கள்.";
const initialEnglish =
  "Hello! I am VazhaiGuard AI. Ask me about your farm, weather, wind, rain, or crop.";

export default function CopilotPage() {
  const [language, setLanguage] = useState<CopilotLanguage>("ta-IN");
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", text: initialTamil },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const {
    isListening,
    isSpeaking,
    liveTranscript,
    voiceError,
    speak,
    startListening,
    stopListening,
    cancelSpeech,
    setLiveTranscript,
  } = useVoiceAssistant();

  const languageName = language === "ta-IN" ? "தமிழ்" : "English";
  const context = useMemo(() => getStoredFarmContext(), [messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveTranscript]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0].id !== "welcome") return current;

      return [
        {
          id: "welcome",
          role: "assistant",
          text: language === "ta-IN" ? initialTamil : initialEnglish,
        },
      ];
    });

    cancelSpeech();
  }, [language, cancelSpeech]);

  const submit = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isProcessing) return;

    setInput("");
    setLiveTranscript("");
    cancelSpeech();

    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text,
      },
    ]);

    setIsProcessing(true);

    try {
      const result = await askCopilot({
        user_query: text,
        language,
        context,
      });

      const answer =
        result.response?.trim() ||
        (language === "ta-IN"
          ? "மன்னிக்கவும். இப்போது பதில் கிடைக்கவில்லை."
          : "Sorry, I could not produce a response right now.");

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: answer,
        },
      ]);

      if (autoSpeak) {
        window.setTimeout(() => speak(answer, language), 120);
      }
    } catch (error) {
      const fallback =
        language === "ta-IN"
          ? "மன்னிக்கவும். AI சேவையுடன் தொடர்பு கொள்ள முடியவில்லை. Backend இயங்குகிறதா என்று சரிபார்க்கவும்."
          : "Sorry. I could not reach the AI service. Please check that the backend is running.";

      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          text: fallback,
        },
      ]);

      console.error("[Copilot] request failed", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const beginListening = () => {
    cancelSpeech();
    startListening(language, (transcript) => {
      void submit(transcript);
    });
  };

  const toggleLanguage = (next: CopilotLanguage) => {
    if (next === language) return;
    stopListening();
    cancelSpeech();
    setLanguage(next);
  };

  const replayMessage = (message: Message) => {
    cancelSpeech();
    speak(message.text, language);
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-[#146c43]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf5ec]">
              <Bot className="h-[18px] w-[18px]" />
            </div>
            VazhaiGuard AI Copilot
          </div>
          <h1 className="vg-heading mt-3 text-3xl font-bold tracking-[-0.04em] text-[#13271d] sm:text-4xl">
            {language === "ta-IN"
              ? "பேசுங்கள். உதவி பெறுங்கள்."
              : "Talk to your farm assistant."}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {language === "ta-IN"
              ? "உங்கள் தோட்டம் மற்றும் தற்போதைய தகவல்களை வைத்து எளிமையாக பதில் அளிக்கிறது."
              : "Get simple answers using your available farm and weather context."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-2xl border border-border bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => toggleLanguage("ta-IN")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold ${language === "ta-IN" ? "bg-[#073b2a] text-white" : "text-muted-foreground"}`}
            >
              <Languages className="h-4 w-4" /> தமிழ்
            </button>
            <button
              type="button"
              onClick={() => toggleLanguage("en-IN")}
              className={`rounded-xl px-4 py-2.5 text-xs font-semibold ${language === "en-IN" ? "bg-[#073b2a] text-white" : "text-muted-foreground"}`}
            >
              English
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <section className="overflow-hidden rounded-3xl border border-[#dce9e0] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf5ec]">
                <Leaf className="h-5 w-5 text-[#146c43]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#13271d]">VazhaiGuard AI</p>
                <p className="text-[11px] text-muted-foreground">{languageName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAutoSpeak((value) => !value);
                if (isSpeaking) cancelSpeech();
              }}
              className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold"
            >
              {autoSpeak ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              {autoSpeak ? "Voice on" : "Voice off"}
            </button>
          </div>

          <div className="min-h-[430px] max-h-[55vh] overflow-y-auto bg-[#f8fbf9] px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  text={message.text}
                  onSpeak={
                    message.role === "assistant"
                      ? () => replayMessage(message)
                      : undefined
                  }
                  isSpeaking={isSpeaking}
                />
              ))}

              {liveTranscript && (
                <div className="flex justify-end gap-3">
                  <div className="max-w-[82%] rounded-2xl rounded-br-md border border-[#b8df4b] bg-[#f3f9dc] px-4 py-3 text-sm text-[#13271d]">
                    {liveTranscript}
                  </div>
                </div>
              )}

              {isProcessing && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {language === "ta-IN"
                    ? "உங்கள் கேள்வியை புரிந்துகொள்கிறேன்..."
                    : "Understanding your question..."}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {voiceError && (
            <div className="border-t border-red-100 bg-red-50 px-5 py-3 text-xs text-red-700">
              {voiceError}
            </div>
          )}

          <div className="border-t border-border bg-white p-4 sm:p-5">
            <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-[#cfded4] bg-[#fafcfb] p-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submit(input);
                }}
                disabled={isProcessing || isListening}
                placeholder={
                  language === "ta-IN"
                    ? "இங்கே type செய்யலாம்..."
                    : "Type your question..."
                }
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => void submit(input)}
                disabled={!input.trim() || isProcessing || isListening}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#073b2a] text-white disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={isListening ? stopListening : beginListening}
                disabled={isProcessing}
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${isListening ? "bg-red-600 text-white" : "bg-[#b8df4b] text-[#073b2a]"}`}
                aria-label={isListening ? "Stop listening" : "Start listening"}
              >
                {isListening ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-muted-foreground">
              {isListening
                ? language === "ta-IN"
                  ? "கேட்கிறேன்... பேசுங்கள்."
                  : "Listening... speak now."
                : language === "ta-IN"
                  ? "மைக்ரோஃபோனை அழுத்தி பேசலாம் அல்லது type செய்யலாம்."
                  : "Press the microphone or type your question."}
            </p>
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-[#dce9e0] bg-[#073b2a] p-5 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#b8df4b]">
              <Leaf className="h-5 w-5 text-[#073b2a]" />
            </div>
            <div>
              <p className="text-sm font-bold">Farm-aware assistant</p>
              <p className="text-[10px] text-white/55">VazhaiGuard AI</p>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-xs leading-5 text-white/75">
            <div className="rounded-2xl bg-white/[0.07] p-3">
              <p className="font-semibold text-white">1. கேளுங்கள்</p>
              <p className="mt-1">மழை, காற்று, வாழை, தோட்டம் பற்றி கேளுங்கள்.</p>
            </div>
            <div className="rounded-2xl bg-white/[0.07] p-3">
              <p className="font-semibold text-white">2. புரிந்துகொள்கிறேன்</p>
              <p className="mt-1">AI உங்கள் கேள்வியை விவசாய சூழலில் புரிந்துகொள்ளும்.</p>
            </div>
            <div className="rounded-2xl bg-white/[0.07] p-3">
              <p className="font-semibold text-white">3. பதில்</p>
              <p className="mt-1">எளிய பதிலும் அடுத்த நடைமுறை நடவடிக்கையும் வழங்கப்படும்.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

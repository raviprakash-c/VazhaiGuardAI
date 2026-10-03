import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Languages,
  Leaf,
  Loader2,
  Mic,
  MicOff,
  Send,
  Sparkles,
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

type ConversationStage = "ready" | "listening" | "thinking" | "speaking";

const initialTamil =
  "வணக்கம்! நான் VazhaiGuard AI. உங்கள் தோட்டம், மழை, காற்று அல்லது பயிர் பற்றி கேளுங்கள்.";
const initialEnglish =
  "Hello! I am VazhaiGuard AI. Ask me about your farm, weather, rain, wind, or crop.";

export default function CopilotPage() {
  const [language, setLanguage] = useState<CopilotLanguage>("ta-IN");
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", text: initialTamil },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [handsFree, setHandsFree] = useState(true);
  const [stage, setStage] = useState<ConversationStage>("ready");
  const [lastAnswerId, setLastAnswerId] = useState<string | null>(null);
  const [lastQuestionId, setLastQuestionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const autoListenPendingRef = useRef(false);
  const speechStartedRef = useRef(false);
  const submitRef = useRef<(text: string) => Promise<void>>(async () => undefined);

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
    autoListenPendingRef.current = false;
    speechStartedRef.current = false;
    cancelSpeech();
    stopListening();
    setStage("ready");
  }, [language, cancelSpeech, stopListening]);

  const beginListening = () => {
    if (isProcessing || isSpeaking) return;

    setInput("");
    setLiveTranscript("");
    cancelSpeech();
    setStage("listening");

    startListening(language, (transcript) => {
      void submitRef.current(transcript);
    });
  };

  const submit = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isProcessing) return;

    autoListenPendingRef.current = handsFree && autoSpeak;
    speechStartedRef.current = false;

    setInput("");
    setLiveTranscript("");
    cancelSpeech();
    setStage("thinking");

    const questionId = `user-${Date.now()}`;
    setLastQuestionId(questionId);
    setMessages((current) => [
      ...current,
      { id: questionId, role: "user", text },
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

      const answerId = `assistant-${Date.now()}`;
      setLastAnswerId(answerId);
      setMessages((current) => [
        ...current,
        { id: answerId, role: "assistant", text: answer },
      ]);

      setIsProcessing(false);

      if (autoSpeak) {
        setStage("speaking");
        window.setTimeout(() => {
          const speechQueued = speak(answer, language);

          // If the device has no Tamil TTS voice (or speech synthesis is
          // unavailable), do not leave hands-free mode stuck on "Speaking".
          // The answer remains visible and the microphone can move to the
          // next farmer turn after a short pause.
          if (!speechQueued) {
            speechStartedRef.current = false;
            if (handsFree) {
              window.setTimeout(() => {
                autoListenPendingRef.current = false;
                if (handsFree && autoSpeak && !isProcessing) beginListening();
                else setStage("ready");
              }, 650);
            } else {
              autoListenPendingRef.current = false;
              setStage("ready");
            }
          }
        }, 100);
      } else {
        autoListenPendingRef.current = false;
        setStage("ready");
      }
    } catch (error) {
      console.error("[Copilot] request failed", error);
      autoListenPendingRef.current = false;
      setIsProcessing(false);
      setStage("ready");

      const fallback =
        language === "ta-IN"
          ? "மன்னிக்கவும். AI சேவையுடன் தொடர்பு கொள்ள முடியவில்லை. Backend இயங்குகிறதா என்று சரிபார்க்கவும்."
          : "Sorry. I could not reach the AI service. Please check that the backend is running.";

      const answerId = `error-${Date.now()}`;
      setLastAnswerId(answerId);
      setMessages((current) => [
        ...current,
        { id: answerId, role: "assistant", text: fallback },
      ]);
    }
  };

  submitRef.current = submit;

  useEffect(() => {
    if (!autoListenPendingRef.current) return;

    if (isSpeaking) {
      speechStartedRef.current = true;
      setStage("speaking");
      return;
    }

    if (!speechStartedRef.current || isProcessing || isListening) return;

    autoListenPendingRef.current = false;
    speechStartedRef.current = false;

    const timer = window.setTimeout(() => {
      if (handsFree && autoSpeak && !isProcessing) beginListening();
      else setStage("ready");
    }, 350);

    return () => window.clearTimeout(timer);
  }, [isSpeaking, isProcessing, isListening, handsFree, autoSpeak]);

  useEffect(() => {
    if (isListening) setStage("listening");
    else if (isProcessing) setStage("thinking");
  }, [isListening, isProcessing]);

  const stopConversation = () => {
    autoListenPendingRef.current = false;
    speechStartedRef.current = false;
    stopListening();
    cancelSpeech();
    setStage("ready");
  };

  const toggleLanguage = (next: CopilotLanguage) => {
    if (next === language) return;
    stopConversation();
    setLanguage(next);
  };

  const replayMessage = (message: Message) => {
    autoListenPendingRef.current = false;
    speechStartedRef.current = false;
    cancelSpeech();
    setStage("speaking");
    speak(message.text, language);
  };

  const statusText =
    stage === "listening"
      ? language === "ta-IN"
        ? "கேட்கிறேன் — பேசுங்கள்"
        : "Listening — speak now"
      : stage === "thinking"
        ? language === "ta-IN"
          ? "உங்கள் கேள்வியை புரிந்துகொள்கிறேன்..."
          : "Understanding your question..."
        : stage === "speaking"
          ? language === "ta-IN"
            ? "பதில் சொல்கிறேன்..."
            : "Speaking the answer..."
          : language === "ta-IN"
            ? "அடுத்த கேள்விக்கு தயாராக உள்ளது"
            : "Ready for your next question";

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-[#146c43]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf5ec]">
              <Bot className="h-[18px] w-[18px]" />
            </div>
            VazhaiGuard AI Copilot
          </div>
          <h1 className="vg-heading mt-3 text-3xl font-bold tracking-[-0.04em] text-[#13271d] sm:text-4xl">
            {language === "ta-IN" ? "பேசுங்கள். பதில் கேளுங்கள்." : "Talk naturally with your farm assistant."}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {language === "ta-IN"
              ? "விவசாயி ஒரு கேள்வி கேட்பார். AI பதில் சொல்வது முடிந்ததும் அடுத்த கேள்விக்காக தானாகவே கேட்கும்."
              : "Ask one question by voice. After the answer finishes, the assistant automatically listens for the next question."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      <div className="grid gap-5 lg:grid-cols-[1fr_310px]">
        <section className="overflow-hidden rounded-3xl border border-[#dce9e0] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf5ec]">
                <Leaf className="h-5 w-5 text-[#146c43]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#13271d]">VazhaiGuard AI</p>
                <p className="text-[11px] text-muted-foreground">{languageName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setHandsFree((value) => !value);
                  if (handsFree) stopConversation();
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${handsFree ? "border-[#b8df4b] bg-[#f3f9dc] text-[#073b2a]" : "border-border"}`}
              >
                <Sparkles className="h-4 w-4" />
                {handsFree ? "Hands-free" : "Manual voice"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAutoSpeak((value) => !value);
                  if (autoSpeak) stopConversation();
                }}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold"
              >
                {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {autoSpeak ? "Voice on" : "Voice off"}
              </button>
            </div>
          </div>

          <div className="border-b border-[#dce9e0] bg-[#073b2a] px-5 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${stage === "listening" ? "animate-pulse bg-[#b8df4b]" : "bg-white/60"}`} />
              <div className="flex-1">
                <p className="text-xs font-bold">{statusText}</p>
                <p className="mt-0.5 text-[10px] text-white/60">
                  {handsFree && autoSpeak
                    ? language === "ta-IN"
                      ? "பதில் முடிந்ததும் அடுத்த கேள்விக்காக தானாக கேட்கும்"
                      : "Microphone reopens automatically after the spoken answer"
                    : language === "ta-IN"
                      ? "அடுத்த கேள்விக்கு microphone-ஐ அழுத்துங்கள்"
                      : "Press the microphone for the next question"}
                </p>
              </div>
              {stage === "speaking" && <Volume2 className="h-4 w-4 animate-pulse" />}
              {stage === "ready" && <CheckCircle2 className="h-4 w-4 text-[#b8df4b]" />}
            </div>
          </div>

          <div className="min-h-[460px] max-h-[58vh] overflow-y-auto bg-[#f8fbf9] px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="relative">
                  <ChatMessage
                    role={message.role}
                    text={message.text}
                    onSpeak={message.role === "assistant" ? () => replayMessage(message) : undefined}
                    isSpeaking={isSpeaking && message.id === lastAnswerId}
                  />
                  {message.id === lastQuestionId && (
                    <p className="mt-1 text-right text-[10px] font-medium text-[#7a8b82]">
                      {language === "ta-IN" ? "உங்கள் கேள்வி" : "Your question"}
                    </p>
                  )}
                  {message.id === lastAnswerId && (
                    <p className="mt-1 flex items-center justify-end gap-1 text-[10px] font-medium text-[#146c43]">
                      <CheckCircle2 className="h-3 w-3" />
                      {language === "ta-IN" ? "AI பதில்" : "AI answer"}
                    </p>
                  )}
                </div>
              ))}

              {liveTranscript && (
                <div className="flex justify-end gap-3">
                  <div className="max-w-[86%] rounded-2xl rounded-br-md border border-[#b8df4b] bg-[#f3f9dc] px-4 py-3 text-sm text-[#13271d] shadow-sm">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#5e7924]">
                      {language === "ta-IN" ? "நீங்கள் சொல்வது" : "You said"}
                    </p>
                    {liveTranscript}
                  </div>
                </div>
              )}

              {isProcessing && (
                <div className="flex items-center gap-2 rounded-2xl border border-[#dce9e0] bg-white px-4 py-3 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-[#146c43]" />
                  {language === "ta-IN" ? "உங்கள் கேள்வியை புரிந்துகொள்கிறேன்..." : "Understanding your question..."}
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
                placeholder={language === "ta-IN" ? "இங்கே type செய்யலாம்..." : "Type your question..."}
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
                onClick={isListening ? stopConversation : beginListening}
                disabled={isProcessing || isSpeaking}
                className={`flex h-11 min-w-11 items-center justify-center rounded-xl px-3 ${isListening ? "bg-red-600 text-white" : "bg-[#b8df4b] text-[#073b2a]"}`}
                aria-label={isListening ? "Stop listening" : "Start listening"}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
            </div>
            <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-muted-foreground">
              {statusText}
            </p>
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-[#dce9e0] bg-[#073b2a] p-5 text-white shadow-sm lg:sticky lg:top-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#b8df4b]">
              <Leaf className="h-5 w-5 text-[#073b2a]" />
            </div>
            <div>
              <p className="text-sm font-bold">Farmer Voice Assistant</p>
              <p className="text-[10px] text-white/55">{languageName} • VazhaiGuard AI</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className={`rounded-2xl p-3 ${stage === "listening" ? "bg-[#b8df4b] text-[#073b2a]" : "bg-white/[0.07]"}`}>
              <p className="text-xs font-bold">1. 🎙️ {language === "ta-IN" ? "பேசுங்கள்" : "Speak"}</p>
              <p className="mt-1 text-[11px] opacity-75">{language === "ta-IN" ? "விவசாயி தனது கேள்வியை இயல்பாக பேசலாம்." : "Ask your question naturally."}</p>
            </div>
            <div className={`rounded-2xl p-3 ${stage === "thinking" ? "bg-[#b8df4b] text-[#073b2a]" : "bg-white/[0.07]"}`}>
              <p className="text-xs font-bold">2. 🧠 {language === "ta-IN" ? "புரிந்துகொள்கிறது" : "Understand"}</p>
              <p className="mt-1 text-[11px] opacity-75">{language === "ta-IN" ? "AI உங்கள் farm context-ஐ பயன்படுத்துகிறது." : "AI uses the available farm context."}</p>
            </div>
            <div className={`rounded-2xl p-3 ${stage === "speaking" ? "bg-[#b8df4b] text-[#073b2a]" : "bg-white/[0.07]"}`}>
              <p className="text-xs font-bold">3. 🔊 {language === "ta-IN" ? "பதில் சொல்கிறது" : "Answer"}</p>
              <p className="mt-1 text-[11px] opacity-75">{language === "ta-IN" ? "பதில் திரையிலும் குரலிலும் கிடைக்கும்." : "The answer is shown and spoken."}</p>
            </div>
            <div className={`rounded-2xl p-3 ${stage === "ready" ? "bg-[#b8df4b] text-[#073b2a]" : "bg-white/[0.07]"}`}>
              <p className="text-xs font-bold">4. 🔁 {language === "ta-IN" ? "அடுத்த கேள்வி" : "Next question"}</p>
              <p className="mt-1 text-[11px] opacity-75">{language === "ta-IN" ? "Hands-free mode-ல் தானாக மீண்டும் கேட்கும்." : "Hands-free mode automatically listens again."}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={isListening || isSpeaking ? stopConversation : beginListening}
            disabled={isProcessing}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#b8df4b] px-4 py-3 text-sm font-bold text-[#073b2a] disabled:opacity-50"
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isListening
              ? language === "ta-IN" ? "பேசுவதை நிறுத்து" : "Stop listening"
              : isSpeaking
                ? language === "ta-IN" ? "குரலை நிறுத்து" : "Stop voice"
                : language === "ta-IN" ? "🎙️ இப்போது பேசுங்கள்" : "🎙️ Start speaking"}
          </button>
        </aside>
      </div>
    </div>
  );
}

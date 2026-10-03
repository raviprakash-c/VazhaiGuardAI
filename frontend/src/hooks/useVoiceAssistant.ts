import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { VoiceLanguage } from "../types/voice";

type RecognitionAlternative = {
  transcript: string;
  confidence: number;
};

type RecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: RecognitionAlternative;
};

type RecognitionResultList = {
  length: number;
  [index: number]: RecognitionResult;
};

type RecognitionEvent = Event & {
  resultIndex: number;
  results: RecognitionResultList;
};

type RecognitionErrorEvent = Event & {
  error: string;
  message?: string;
};

type RecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
};

type RecognitionConstructor = new () => RecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

function decodeHtmlEntities(text: string): string {
  if (!text || typeof document === "undefined") return text;

  let decoded = text;
  for (let pass = 0; pass < 3; pass += 1) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = decoded;
    const next = textarea.value;
    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
}

export function useVoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [tamilVoiceAvailable, setTamilVoiceAvailable] = useState(false);

  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const latestTranscriptRef = useRef("");
  const finalCallbackRef = useRef<((transcript: string) => void) | null>(null);
  const hasSubmittedRef = useRef(false);

  const checkVoices = useCallback(() => {
    if (!("speechSynthesis" in window)) {
      setTamilVoiceAvailable(false);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    const hasTamil = voices.some((voice) => {
      const lang = voice.lang.toLowerCase();
      return lang === "ta-in" || lang.startsWith("ta-") || lang === "ta";
    });

    setTamilVoiceAvailable(hasTamil);
  }, []);

  useEffect(() => {
    checkVoices();

    if (!("speechSynthesis" in window)) return;

    const handleVoicesChanged = () => checkVoices();
    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
    };
  }, [checkVoices]);

  const cancelSpeech = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  /**
   * Queue speech and return true only when a supported voice was selected.
   * Tamil is never silently spoken with an English voice.
   */
  const speak = useCallback(
    (rawText: string, language: VoiceLanguage): boolean => {
      setVoiceError("");

      const text = decodeHtmlEntities(rawText).trim();
      if (!text) return false;

      if (!("speechSynthesis" in window)) {
        setVoiceError(
          language === "ta-IN"
            ? "இந்த சாதனத்தில் குரல் வசதி ஆதரிக்கப்படவில்லை."
            : "Speech output is not supported on this device.",
        );
        return false;
      }

      window.speechSynthesis.cancel();

      // Some browsers populate the voice list asynchronously. Ask the browser
      // to refresh it before reading the list again.
      const voices = window.speechSynthesis.getVoices();
      const languagePrefix = language.split("-")[0].toLowerCase();
      const exactVoice = voices.find(
        (voice) => voice.lang.toLowerCase() === language.toLowerCase(),
      );
      const sameLanguageVoice = voices.find((voice) =>
        voice.lang.toLowerCase().startsWith(`${languagePrefix}-`),
      );
      const selectedVoice = exactVoice ?? sameLanguageVoice;

      if (language === "ta-IN" && !selectedVoice) {
        setTamilVoiceAvailable(false);
        setVoiceError(
          "இந்த சாதனத்தில் தமிழ் குரல் கிடைக்கவில்லை. Windows-ல் Tamil language speech pack-ஐ நிறுவி Chrome-ஐ மறுதொடக்கம் செய்யுங்கள்.",
        );
        return false;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = language === "ta-IN" ? 0.88 : 0.92;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (event) => {
        console.log("[Speech] error:", event.error);
        setIsSpeaking(false);

        if (event.error === "interrupted" || event.error === "canceled") return;

        if (event.error === "not-allowed") {
          setVoiceError(
            language === "ta-IN"
              ? "Browser தானாக குரல் இயக்க அனுமதிக்கவில்லை. Replay-ஐ ஒருமுறை அழுத்தி அனுமதியுங்கள்."
              : "The browser blocked automatic audio. Use Replay once to allow speech.",
          );
          return;
        }

        setVoiceError(
          language === "ta-IN"
            ? "குரலை இயக்க முடியவில்லை. மீண்டும் முயற்சி செய்யுங்கள்."
            : `Unable to play the voice response (${event.error}).`,
        );
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error("[Speech] queue error:", error);
        setIsSpeaking(false);
        setVoiceError(
          language === "ta-IN"
            ? "குரலை தொடங்க முடியவில்லை. Replay-ஐ முயற்சி செய்யுங்கள்."
            : "Unable to start speech. Please try again.",
        );
        return false;
      }

      return true;
    },
    [],
  );

  const submitFinalTranscript = useCallback(() => {
    if (hasSubmittedRef.current) return;

    const clean = latestTranscriptRef.current.trim();
    if (!clean) return;

    hasSubmittedRef.current = true;
    setLiveTranscript(clean);
    finalCallbackRef.current?.(clean);
  }, []);

  const startListening = useCallback(
    (language: VoiceLanguage, onFinal: (transcript: string) => void) => {
      setVoiceError("");
      setLiveTranscript("");
      latestTranscriptRef.current = "";
      finalCallbackRef.current = onFinal;
      hasSubmittedRef.current = false;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore cleanup errors.
        }
        recognitionRef.current = null;
      }

      const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;

      if (!Recognition) {
        setVoiceError(
          language === "ta-IN"
            ? "இந்த browser-ல் குரல் அடையாளம் காணும் வசதி இல்லை. Chrome பயன்படுத்தவும் அல்லது type செய்யும் option-ஐ பயன்படுத்தவும்."
            : "Voice recognition is not supported in this browser. Please use Chrome or type your question.",
        );
        return;
      }

      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      setIsSpeaking(false);

      const recognition = new Recognition();
      recognition.lang = language;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      let finalText = "";
      let interimText = "";

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError("");
      };

      recognition.onresult = (event: RecognitionEvent) => {
        interimText = "";

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const text = result[0]?.transcript ?? "";

          if (result.isFinal) finalText += `${text} `;
          else interimText += `${text} `;
        }

        const combined = `${finalText}${interimText}`.trim();
        latestTranscriptRef.current = combined;
        setLiveTranscript(combined);
      };

      recognition.onerror = (event: RecognitionErrorEvent) => {
        setIsListening(false);

        if (event.error === "aborted") return;

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setVoiceError(
            language === "ta-IN"
              ? "மைக்ரோஃபோன் அனுமதி தேவை. Browser-ல் Microphone permission-ஐ Allow செய்யுங்கள்."
              : "Microphone permission is required. Please allow microphone access.",
          );
          return;
        }

        if (event.error === "no-speech") {
          setVoiceError(
            language === "ta-IN"
              ? "உங்கள் குரல் கேட்கவில்லை. மீண்டும் பேசுங்கள்."
              : "I could not hear you. Please try again.",
          );
          return;
        }

        if (event.error === "audio-capture") {
          setVoiceError(
            language === "ta-IN"
              ? "மைக்ரோஃபோனை பயன்படுத்த முடியவில்லை. Microphone connection-ஐ சரிபார்க்கவும்."
              : "The microphone is unavailable. Please check your microphone.",
          );
          return;
        }

        if (event.error === "network") {
          setVoiceError(
            language === "ta-IN"
              ? "குரல் சேவையுடன் இணைக்க முடியவில்லை. Internet connection-ஐ சரிபார்க்கவும்."
              : "Unable to connect to the speech service. Please check your internet connection.",
          );
          return;
        }

        setVoiceError(
          language === "ta-IN"
            ? "உங்கள் குரலை புரிந்துகொள்ள முடியவில்லை. மீண்டும் முயற்சி செய்யுங்கள்."
            : "Voice recognition failed. Please try again.",
        );
      };

      recognition.onend = () => {
        setIsListening(false);

        const combined = `${finalText || interimText || latestTranscriptRef.current}`.trim();
        latestTranscriptRef.current = combined;

        if (combined) submitFinalTranscript();
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;

      try {
        recognition.start();
      } catch (error) {
        console.error("Speech recognition start error:", error);
        recognitionRef.current = null;
        setIsListening(false);
        setVoiceError(
          language === "ta-IN"
            ? "மைக்ரோஃபோனை தொடங்க முடியவில்லை. மீண்டும் முயற்சி செய்யுங்கள்."
            : "Unable to start microphone. Please try again.",
        );
      }
    },
    [submitFinalTranscript],
  );

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    try {
      recognition.stop();
    } catch (error) {
      console.error("Speech recognition stop error:", error);
      setIsListening(false);
    }
  }, []);

  const cancelListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        // Ignore cleanup errors.
      }
    }
    recognitionRef.current = null;
    setIsListening(false);
    setLiveTranscript("");
  }, []);

  return {
    isListening,
    isSpeaking,
    liveTranscript,
    voiceError,
    tamilVoiceAvailable,
    speak,
    startListening,
    stopListening,
    cancelListening,
    cancelSpeech,
    setLiveTranscript,
  };
}

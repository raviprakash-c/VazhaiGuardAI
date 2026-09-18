import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  VoiceLanguage,
} from "../types/voice";

/* =========================================================
   WEB SPEECH API TYPES
========================================================= */

type RecognitionAlternative = {
  transcript: string;
  confidence: number;
};

type RecognitionResult = {
  isFinal: boolean;
  length: number;

  [index: number]:
    RecognitionAlternative;
};

type RecognitionResultList = {
  length: number;

  [index: number]:
    RecognitionResult;
};

type RecognitionEvent = Event & {
  resultIndex: number;
  results: RecognitionResultList;
};

type RecognitionErrorEvent =
  Event & {
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

  onstart:
    | (() => void)
    | null;

  onend:
    | (() => void)
    | null;

  onresult:
    | ((
        event: RecognitionEvent
      ) => void)
    | null;

  onerror:
    | ((
        event: RecognitionErrorEvent
      ) => void)
    | null;
};

type RecognitionConstructor =
  new () => RecognitionInstance;

/* =========================================================
   EXTEND WINDOW FOR CHROME SPEECH RECOGNITION
========================================================= */

declare global {
  interface Window {
    SpeechRecognition?:
      RecognitionConstructor;

    webkitSpeechRecognition?:
      RecognitionConstructor;
  }
}

/* =========================================================
   HOOK
========================================================= */

export function useVoiceAssistant() {
  const [
    isListening,
    setIsListening,
  ] = useState(false);

  const [
    isSpeaking,
    setIsSpeaking,
  ] = useState(false);

  const [
    liveTranscript,
    setLiveTranscript,
  ] = useState("");

  const [
    voiceError,
    setVoiceError,
  ] = useState("");

  const [
    tamilVoiceAvailable,
    setTamilVoiceAvailable,
  ] = useState(false);

  const recognitionRef =
    useRef<
      RecognitionInstance | null
    >(null);

  const latestTranscriptRef =
    useRef("");

  const finalCallbackRef =
    useRef<
      | ((
          transcript: string
        ) => void)
      | null
    >(null);

  const hasSubmittedRef =
    useRef(false);

  /* =======================================================
     CHECK AVAILABLE TEXT-TO-SPEECH VOICES
  ======================================================== */

  const checkVoices =
    useCallback(() => {
      if (
        !(
          "speechSynthesis" in
          window
        )
      ) {
        setTamilVoiceAvailable(
          false
        );

        return;
      }

      const voices =
        window.speechSynthesis.getVoices();

      const tamilVoice =
        voices.some((voice) =>
          voice.lang
            .toLowerCase()
            .startsWith("ta")
        );

      setTamilVoiceAvailable(
        tamilVoice
      );
    }, []);

  useEffect(() => {
    checkVoices();

    if (
      !(
        "speechSynthesis" in
        window
      )
    ) {
      return;
    }

    const handleVoicesChanged =
      () => {
        checkVoices();
      };

    window.speechSynthesis.addEventListener(
      "voiceschanged",
      handleVoicesChanged
    );

    return () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        handleVoicesChanged
      );
    };
  }, [checkVoices]);

  /* =======================================================
     CANCEL SPEECH
  ======================================================== */

  const cancelSpeech =
    useCallback(() => {
      if (
        "speechSynthesis" in
        window
      ) {
        window.speechSynthesis.cancel();
      }

      setIsSpeaking(false);
    }, []);

  /* =======================================================
     SPEAK TEXT
  ======================================================== */

  const speak =
    useCallback(
      (
        text: string,
        language:
          VoiceLanguage
      ) => {
        setVoiceError("");

        if (
          !text.trim()
        ) {
          return;
        }

        if (
          !(
            "speechSynthesis" in
            window
          )
        ) {
          setVoiceError(
            language === "ta-IN"
              ? "இந்த சாதனத்தில் குரல் வசதி ஆதரிக்கப்படவில்லை."
              : "Speech output is not supported on this device."
          );

          return;
        }

        /*
         * Stop previously playing
         * voice before speaking
         * the new question.
         */
        window.speechSynthesis.cancel();

        const voices =
          window.speechSynthesis.getVoices();

        const languagePrefix =
          language
            .split("-")[0]
            .toLowerCase();

        /*
         * First try exact locale:
         * ta-IN / en-IN
         */
        const exactVoice =
          voices.find(
            (voice) =>
              voice.lang.toLowerCase() ===
              language.toLowerCase()
          );

        /*
         * Then any voice belonging
         * to the same language.
         */
        const sameLanguageVoice =
          voices.find((voice) =>
            voice.lang
              .toLowerCase()
              .startsWith(
                languagePrefix
              )
          );

        const selectedVoice =
          exactVoice ??
          sameLanguageVoice;

        /*
         * IMPORTANT:
         *
         * Do NOT allow Chrome/Windows
         * to read Tamil using its default
         * English voice.
         */
        if (
          language === "ta-IN" &&
          !selectedVoice
        ) {
          setTamilVoiceAvailable(
            false
          );

          setVoiceError(
            "இந்த சாதனத்தில் தமிழ் குரல் கிடைக்கவில்லை. கேள்வியை திரையில் பார்க்கலாம் அல்லது Tamil audio fallback பயன்படுத்தலாம்."
          );

          return;
        }

        const utterance =
          new SpeechSynthesisUtterance(
            text
          );

        utterance.lang =
          language;

        if (selectedVoice) {
          utterance.voice =
            selectedVoice;
        }

        /*
         * Slightly slower speaking
         * speed for farmer usability.
         */
        utterance.rate =
          language === "ta-IN"
            ? 0.88
            : 0.92;

        utterance.pitch =
          1;

        utterance.volume =
          1;

        utterance.onstart =
          () => {
            setIsSpeaking(
              true
            );
          };

        utterance.onend =
          () => {
            setIsSpeaking(
              false
            );
          };

        utterance.onerror =
          () => {
            setIsSpeaking(
              false
            );

            setVoiceError(
              language ===
                "ta-IN"
                ? "குரலை இயக்க முடியவில்லை. மீண்டும் முயற்சி செய்யுங்கள்."
                : "Unable to play the voice response."
            );
          };

        window.speechSynthesis.speak(
          utterance
        );
      },
      []
    );

  /* =======================================================
     SUBMIT FINAL TRANSCRIPT ONCE
  ======================================================== */

  const submitFinalTranscript =
    useCallback(() => {
      if (
        hasSubmittedRef.current
      ) {
        return;
      }

      const clean =
        latestTranscriptRef.current.trim();

      if (!clean) {
        return;
      }

      hasSubmittedRef.current =
        true;

      setLiveTranscript(
        clean
      );

      finalCallbackRef.current?.(
        clean
      );
    }, []);

  /* =======================================================
     START LISTENING
  ======================================================== */

  const startListening =
    useCallback(
      (
        language:
          VoiceLanguage,

        onFinal: (
          transcript:
            string
        ) => void
      ) => {
        setVoiceError("");
        setLiveTranscript("");

        latestTranscriptRef.current =
          "";

        finalCallbackRef.current =
          onFinal;

        hasSubmittedRef.current =
          false;

        /*
         * Avoid multiple recognition
         * sessions at the same time.
         */
        if (
          recognitionRef.current
        ) {
          try {
            recognitionRef.current.abort();
          } catch {
            // Ignore cleanup errors.
          }

          recognitionRef.current =
            null;
        }

        const Recognition =
          window.SpeechRecognition ??
          window.webkitSpeechRecognition;

        if (!Recognition) {
          setVoiceError(
            language === "ta-IN"
              ? "இந்த browser-ல் குரல் அடையாளம் காணும் வசதி இல்லை. Chrome பயன்படுத்தவும் அல்லது Type செய்யும் option-ஐ பயன்படுத்தவும்."
              : "Voice recognition is not supported in this browser. Please use Chrome or use the typing option."
          );

          return;
        }

        /*
         * Stop VazhaiGuard speaking
         * before microphone starts.
         *
         * Otherwise the microphone may
         * transcribe the AI's own voice.
         */
        if (
          "speechSynthesis" in
          window
        ) {
          window.speechSynthesis.cancel();
        }

        setIsSpeaking(false);

        const recognition =
          new Recognition();

        recognition.lang =
          language;

        /*
         * Farmer answers one question
         * at a time.
         */
        recognition.continuous =
          false;

        recognition.interimResults =
          true;

        recognition.maxAlternatives =
          1;

        let finalText =
          "";

        let interimText =
          "";

        recognition.onstart =
          () => {
            setIsListening(
              true
            );

            setVoiceError("");
          };

        recognition.onresult =
          (
            event:
              RecognitionEvent
          ) => {
            interimText =
              "";

            for (
              let index =
                event.resultIndex;
              index <
                event.results
                  .length;
              index++
            ) {
              const result =
                event.results[
                  index
                ];

              const text =
                result[0]
                  ?.transcript ??
                "";

              if (
                result.isFinal
              ) {
                finalText +=
                  `${text} `;
              } else {
                interimText +=
                  `${text} `;
              }
            }

            /*
             * Show farmer everything
             * currently recognised.
             */
            const combined =
              (
                finalText +
                interimText
              ).trim();

            latestTranscriptRef.current =
              combined;

            setLiveTranscript(
              combined
            );
          };

        recognition.onerror =
          (
            event:
              RecognitionErrorEvent
          ) => {
            setIsListening(
              false
            );

            /*
             * Some browsers fire
             * "aborted" during intentional
             * cleanup. Do not show an error.
             */
            if (
              event.error ===
              "aborted"
            ) {
              return;
            }

            if (
              event.error ===
              "not-allowed" ||
              event.error ===
              "service-not-allowed"
            ) {
              setVoiceError(
                language ===
                  "ta-IN"
                  ? "மைக்ரோஃபோன் அனுமதி தேவை. Browser-ல் Microphone permission-ஐ Allow செய்யுங்கள்."
                  : "Microphone permission is required. Please allow microphone access."
              );

              return;
            }

            if (
              event.error ===
              "no-speech"
            ) {
              setVoiceError(
                language ===
                  "ta-IN"
                  ? "உங்கள் குரல் கேட்கவில்லை. மைக்ரோஃபோனுக்கு அருகில் மீண்டும் பேசுங்கள்."
                  : "I could not hear you. Please try again."
              );

              return;
            }

            if (
              event.error ===
              "audio-capture"
            ) {
              setVoiceError(
                language ===
                  "ta-IN"
                  ? "மைக்ரோஃபோனை பயன்படுத்த முடியவில்லை. உங்கள் microphone connection-ஐ சரிபார்க்கவும்."
                  : "The microphone is unavailable. Please check your microphone."
              );

              return;
            }

            if (
              event.error ===
              "network"
            ) {
              setVoiceError(
                language ===
                  "ta-IN"
                  ? "குரல் சேவையுடன் இணைக்க முடியவில்லை. Internet connection-ஐ சரிபார்க்கவும்."
                  : "Unable to connect to the speech service. Please check your internet connection."
              );

              return;
            }

            setVoiceError(
              language ===
                "ta-IN"
                ? "உங்கள் குரலை புரிந்துகொள்ள முடியவில்லை. மீண்டும் முயற்சி செய்யுங்கள்."
                : "Voice recognition failed. Please try again."
            );
          };

        recognition.onend =
          () => {
            setIsListening(
              false
            );

            /*
             * Browser sometimes gives
             * useful interim text before
             * the farmer presses Stop.
             *
             * Keep it instead of throwing
             * the answer away.
             */
            const combined =
              (
                finalText ||
                interimText ||
                latestTranscriptRef.current
              ).trim();

            latestTranscriptRef.current =
              combined;

            if (combined) {
              submitFinalTranscript();
            }

            recognitionRef.current =
              null;
          };

        recognitionRef.current =
          recognition;

        try {
          recognition.start();
        } catch (error) {
          console.error(
            "Speech recognition start error:",
            error
          );

          recognitionRef.current =
            null;

          setIsListening(
            false
          );

          setVoiceError(
            language ===
              "ta-IN"
              ? "மைக்ரோஃபோனை தொடங்க முடியவில்லை. மீண்டும் முயற்சி செய்யுங்கள்."
              : "Unable to start microphone. Please try again."
          );
        }
      },
      [
        submitFinalTranscript,
      ]
    );

  /* =======================================================
     STOP LISTENING
  ======================================================== */

  const stopListening =
    useCallback(() => {
      const recognition =
        recognitionRef.current;

      if (!recognition) {
        return;
      }

      try {
        recognition.stop();
      } catch (error) {
        console.error(
          "Speech recognition stop error:",
          error
        );

        setIsListening(
          false
        );
      }
    }, []);

  /* =======================================================
     ABORT LISTENING
  ======================================================== */

  const cancelListening =
    useCallback(() => {
      const recognition =
        recognitionRef.current;

      if (recognition) {
        try {
          recognition.abort();
        } catch {
          // Ignore.
        }
      }

      recognitionRef.current =
        null;

      hasSubmittedRef.current =
        true;

      setIsListening(false);
    }, []);

  /* =======================================================
     CLEAR ERROR
  ======================================================== */

  const clearVoiceError =
    useCallback(() => {
      setVoiceError("");
    }, []);

  /* =======================================================
     CLEANUP WHEN PAGE UNMOUNTS
  ======================================================== */

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // Ignore cleanup errors.
      }

      if (
        "speechSynthesis" in
        window
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /* =======================================================
     RETURN
  ======================================================== */

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

    clearVoiceError,

    setLiveTranscript,
  };
}
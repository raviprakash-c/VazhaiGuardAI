import {
  Loader2,
  Mic,
  Square,
  Volume2,
  Waves,
} from "lucide-react";

import {
  motion,
} from "framer-motion";

import type {
  VoiceLanguage,
} from "../../types/voice";

type Props = {
  language:
    VoiceLanguage;

  question: string;

  transcript: string;

  isListening: boolean;

  isSpeaking: boolean;

  isProcessing: boolean;

  step: number;

  totalSteps: number;

  onListen: () => void;

  onStop: () => void;

  onReplay: () => void;
};

export default function VoiceAssistantCard({
  language,
  question,
  transcript,
  isListening,
  isSpeaking,
  isProcessing,
  step,
  totalSteps,
  onListen,
  onStop,
  onReplay,
}: Props) {
  const progress =
    Math.min(
      (step /
        totalSteps) *
        100,
      100
    );

  return (
    <div className="relative overflow-hidden rounded-[32px] bg-[#073b2a] p-6 text-white shadow-[0_24px_80px_rgba(7,59,42,0.18)] sm:p-8">
      {/* Glow */}

      <div className="absolute -right-20 -top-24 h-[280px] w-[280px] rounded-full bg-[#b8df4b]/15 blur-3xl" />

      <div className="absolute -bottom-28 left-16 h-[250px] w-[250px] rounded-full bg-[#22a35a]/20 blur-3xl" />

      <div className="relative z-10">
        {/* Top */}

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b8df4b]">
              VazhaiGuard Voice AI
            </p>

            <p className="mt-1 text-xs text-white/50">
              {language ===
              "ta-IN"
                ? `படி ${step} / ${totalSteps}`
                : `Step ${step} of ${totalSteps}`}
            </p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
            <Waves className="h-5 w-5 text-[#b8df4b]" />
          </div>
        </div>

        {/* Progress */}

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-[#b8df4b]"
            animate={{
              width: `${progress}%`,
            }}
            transition={{
              duration: 0.5,
            }}
          />
        </div>

        {/* AI status */}

        <div className="mt-8 flex justify-center">
          <div className="relative">
            {(isListening ||
              isSpeaking) && (
              <>
                <motion.div
                  className="absolute inset-[-18px] rounded-full border border-[#b8df4b]/25"
                  animate={{
                    scale: [
                      1,
                      1.18,
                      1,
                    ],
                    opacity: [
                      0.8,
                      0.2,
                      0.8,
                    ],
                  }}
                  transition={{
                    repeat:
                      Infinity,
                    duration:
                      1.5,
                  }}
                />

                <motion.div
                  className="absolute inset-[-34px] rounded-full border border-[#b8df4b]/10"
                  animate={{
                    scale: [
                      1,
                      1.18,
                      1,
                    ],
                  }}
                  transition={{
                    repeat:
                      Infinity,
                    duration:
                      1.8,
                  }}
                />
              </>
            )}

            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#b8df4b] shadow-[0_15px_50px_rgba(184,223,75,0.22)]">
              {isProcessing ? (
                <Loader2 className="h-9 w-9 animate-spin text-[#073b2a]" />
              ) : isListening ? (
                <Mic className="h-9 w-9 text-[#073b2a]" />
              ) : isSpeaking ? (
                <Volume2 className="h-9 w-9 text-[#073b2a]" />
              ) : (
                <Mic className="h-9 w-9 text-[#073b2a]" />
              )}
            </div>
          </div>
        </div>

        {/* Status */}

        <div className="mt-7 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#b8df4b]">
            {isProcessing
              ? language ===
                "ta-IN"
                ? "புரிந்துகொள்கிறேன்..."
                : "Understanding..."
              : isListening
                ? language ===
                  "ta-IN"
                  ? "கேட்டுக்கொண்டிருக்கிறேன்..."
                  : "Listening..."
                : isSpeaking
                  ? language ===
                    "ta-IN"
                    ? "வாழைகார்டு பேசுகிறது..."
                    : "VazhaiGuard is speaking..."
                  : language ===
                    "ta-IN"
                    ? "உங்களிடம் கேட்கிறேன்"
                    : "Question"}
          </p>
        </div>

        {/* Question */}

        <div className="mx-auto mt-4 max-w-[650px] rounded-[24px] border border-white/10 bg-white/[0.07] p-5 text-center backdrop-blur-xl">
          <p
            className={`font-semibold leading-relaxed ${
              language ===
              "ta-IN"
                ? "text-[20px] sm:text-[23px]"
                : "text-lg sm:text-xl"
            }`}
          >
            {question}
          </p>

          <button
            type="button"
            onClick={
              onReplay
            }
            className="mx-auto mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-[11px] font-semibold text-white/70 transition hover:bg-white/12"
          >
            <Volume2 className="h-4 w-4" />

            {language ===
            "ta-IN"
              ? "மீண்டும் கேள்"
              : "Replay question"}
          </button>
        </div>

        {/* Transcript */}

        {transcript && (
          <div className="mx-auto mt-4 max-w-[650px] rounded-[20px] bg-black/15 p-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40">
              {language ===
              "ta-IN"
                ? "நீங்கள் சொன்னது"
                : "You said"}
            </p>

            <p className="mt-2 text-sm font-medium leading-6 text-white/90">
              “{transcript}”
            </p>
          </div>
        )}

        {/* Mic button */}

        <div className="mt-6 flex justify-center">
          {!isListening ? (
            <button
              type="button"
              disabled={
                isProcessing ||
                isSpeaking
              }
              onClick={
                onListen
              }
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-[#b8df4b] px-7 text-sm font-bold text-[#073b2a] shadow-lg transition hover:bg-[#c9eb65] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mic className="h-5 w-5" />

              {language ===
              "ta-IN"
                ? "அழுத்தி பேசுங்கள்"
                : "Tap to speak"}
            </button>
          ) : (
            <button
              type="button"
              onClick={
                onStop
              }
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-7 text-sm font-bold text-[#073b2a]"
            >
              <Square className="h-4 w-4 fill-current" />

              {language ===
              "ta-IN"
                ? "பேசி முடித்தேன்"
                : "I'm done speaking"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
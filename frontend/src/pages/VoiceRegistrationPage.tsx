import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  CheckCircle2,
  Keyboard,
  Languages,
  Leaf,
  Mic,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import VoiceAssistantCard from "../components/voice/VoiceAssistantCard";

import {
  Button,
} from "../components/ui/button";

import {
  Input,
} from "../components/ui/input";

import {
  sendVoiceRegistrationTurn,
  startVoiceRegistration,
} from "../services/voiceApi";

import {
  useVoiceAssistant,
} from "../hooks/useVoiceAssistant";

import {
  playTamilAcceptedTurn,
  playTamilQuestion,
  playTamilRetry,
  stopTamilQuestion,
} from "../lib/tamilVoice";

import type {
  RegistrationField,
  VoiceFarmState,
  VoiceLanguage,
} from "../types/voice";

/* =========================================================
   TYPES
========================================================= */

type ConversationMessage = {
  role:
    | "assistant"
    | "user";

  text: string;
};

/* =========================================================
   STEP NUMBER
========================================================= */

const fieldNumber: Record<
  RegistrationField,
  number
> = {
  farm_name: 1,

  total_farm_acres: 2,

  banana_area_acres: 3,

  banana_variety: 4,

  planting_age: 5,

  approximate_plants: 6,

  drainage: 7,

  support: 8,

  accessibility: 9,

  complete: 9,
};

/* =========================================================
   PAGE
========================================================= */

export default function VoiceRegistrationPage() {
  const navigate = useNavigate();

  const [
    language,
    setLanguage,
  ] =
    useState<VoiceLanguage>(
      "ta-IN"
    );

  const [
    sessionId,
    setSessionId,
  ] = useState("");

  const [
    currentField,
    setCurrentField,
  ] =
    useState<RegistrationField>(
      "farm_name"
    );

  const [
    question,
    setQuestion,
  ] = useState("");

  const [
    farmState,
    setFarmState,
  ] =
    useState<VoiceFarmState>(
      {}
    );

  const [
    isProcessing,
    setIsProcessing,
  ] = useState(false);

  const [
    complete,
    setComplete,
  ] = useState(false);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    typedAnswer,
    setTypedAnswer,
  ] = useState("");

  const [
    showTyping,
    setShowTyping,
  ] = useState(false);

  const [
    conversation,
    setConversation,
  ] = useState<
    ConversationMessage[]
  >([]);

  const {
    isListening,

    isSpeaking,

    liveTranscript,

    voiceError,

    tamilVoiceAvailable,

    speak,

    startListening,

    stopListening,

    cancelSpeech,

    setLiveTranscript,
  } = useVoiceAssistant();

  /* =======================================================
     SPEAK CURRENT QUESTION

     Tamil:
     Native recorded MP3.

     English:
     Browser speech synthesis.
  ======================================================== */

  const speakCurrentQuestion =
    useCallback(
      (
        field:
          RegistrationField,

        text: string
      ) => {
        /*
         * Stop anything already
         * speaking before next audio.
         */
        cancelSpeech();

        stopTamilQuestion();

        if (
          language ===
          "ta-IN"
        ) {
          void playTamilQuestion(
            field
          );

          return;
        }

        speak(
          text,
          language
        );
      },
      [
        cancelSpeech,
        language,
        speak,
      ]
    );

  /* =======================================================
     START REGISTRATION SESSION
  ======================================================== */

  const initialise =
    useCallback(
      async () => {
        try {
          setPageError("");

          setComplete(false);

          setFarmState({});

          setConversation([]);

          setLiveTranscript("");

          stopTamilQuestion();

          cancelSpeech();

          const response =
            await startVoiceRegistration(
              language
            );

          setSessionId(
            response.session_id
          );

          setCurrentField(
            response.current_field
          );

          setQuestion(
            response.question
          );

          setFarmState(
            response.farm_state
          );

          setConversation([
            {
              role:
                "assistant",

              text:
                response.question,
            },
          ]);

          /*
           * Give React time to
           * render the page first.
           */
          window.setTimeout(
            () => {
              speakCurrentQuestion(
                response.current_field,
                response.question
              );
            },
            500
          );
        } catch (
          error
        ) {
          console.error(
            "VOICE START ERROR:",
            error
          );

          setPageError(
            language ===
              "ta-IN"
              ? "குரல் பதிவை தொடங்க முடியவில்லை."
              : "Unable to start voice registration."
          );
        }
      },
      [
        language,
        speakCurrentQuestion,
        cancelSpeech,
        setLiveTranscript,
      ]
    );

  /* =======================================================
     INITIALISE WHEN LANGUAGE CHANGES
  ======================================================== */

  useEffect(() => {
    void initialise();

    return () => {
      stopTamilQuestion();

      cancelSpeech();
    };
  }, [
    initialise,
    cancelSpeech,
  ]);

  /* =======================================================
     PROCESS FARMER ANSWER
  ======================================================== */

  const processAnswer =
    useCallback(
      async (
        transcript: string
      ) => {
        const clean =
          transcript.trim();

        if (!clean) {
          return;
        }

        setIsProcessing(
          true
        );

        setPageError("");

        /*
         * Stop all voice while
         * backend understands answer.
         */
        stopTamilQuestion();

        cancelSpeech();

        setConversation(
          (previous) => [
            ...previous,

            {
              role:
                "user",

              text:
                clean,
            },
          ]
        );

        try {
          const response =
            await sendVoiceRegistrationTurn(
              {
                session_id:
                  sessionId,

                language,

                current_field:
                  currentField,

                transcript:
                  clean,

                farm_state:
                  farmState,
              }
            );

          setFarmState(
            response.farm_state
          );

          setCurrentField(
            response.next_field
          );

          setQuestion(
            response.next_question
          );

          setComplete(
            response.complete
          );

          if (
            response.complete
          ) {
            localStorage.setItem(
              "vazhaiguard_farm_profile",
              JSON.stringify(
                response.farm_state
              )
            );
          }

          setConversation(
            (previous) => [
              ...previous,

              {
                role:
                  "assistant",

                text:
                  response.reply_text,
              },
            ]
          );

          /* ===============================================
             TAMIL RESPONSE
          ================================================ */

          if (
            language ===
            "ta-IN"
          ) {
            if (
              response.accepted
            ) {
              /*
               * Natural Tamil:
               *
               * "சரி, பதிவு பண்ணிக்கிறேன்"
               *          ↓
               * next question
               */
              void playTamilAcceptedTurn(
                response.next_field
              );
            } else {
              /*
               * Natural Tamil:
               *
               * "சரியாக புரியல..."
               *          ↓
               * repeat current question
               */
              void playTamilRetry(
                response.current_field
              );
            }
          }

          /* ===============================================
             ENGLISH RESPONSE
          ================================================ */

          else {
            speak(
              response.reply_text,
              language
            );
          }
        } catch (
          error: unknown
        ) {
          console.error(
            "VOICE REGISTRATION ERROR:",
            error
          );

          /*
           * If using Axios,
           * safely retrieve backend
           * error without using any.
           */
          let backendMessage =
            "";

          if (
            typeof error ===
              "object" &&
            error !== null &&
            "response" in
              error
          ) {
            const axiosError =
              error as {
                response?: {
                  data?: {
                    detail?:
                      string;
                  };
                };
              };

            backendMessage =
              axiosError
                .response
                ?.data
                ?.detail ??
              "";
          }

          if (
            backendMessage
          ) {
            setPageError(
              backendMessage
            );
          } else {
            setPageError(
              language ===
                "ta-IN"
                ? "உங்கள் பதிலை செயலாக்க முடியவில்லை. மீண்டும் முயற்சி செய்யுங்கள்."
                : "Unable to process your answer. Please try again."
            );
          }

          /*
           * Let farmer hear retry
           * message naturally.
           */
          if (
            language ===
            "ta-IN"
          ) {
            void playTamilRetry(
              currentField
            );
          }
        } finally {
          setIsProcessing(
            false
          );
        }
      },
      [
        cancelSpeech,
        currentField,
        farmState,
        language,
        sessionId,
        speak,
      ]
    );

  /* =======================================================
     START MICROPHONE
  ======================================================== */

  const beginListening =
    () => {
      /*
       * VERY IMPORTANT:
       *
       * Stop Tamil question before
       * microphone starts.
       *
       * Otherwise microphone could
       * capture VazhaiGuard voice.
       */
      stopTamilQuestion();

      cancelSpeech();

      startListening(
        language,

        (
          finalTranscript
        ) => {
          void processAnswer(
            finalTranscript
          );
        }
      );
    };

  /* =======================================================
     STOP MICROPHONE
  ======================================================== */

  const handleStopListening =
    () => {
      stopListening();
    };

  /* =======================================================
     REPLAY QUESTION
  ======================================================== */

  const replayQuestion =
    () => {
      if (
        isListening ||
        isProcessing
      ) {
        return;
      }

      speakCurrentQuestion(
        currentField,
        question
      );
    };

  /* =======================================================
     TYPE FALLBACK
  ======================================================== */

  const submitTypedAnswer =
    () => {
      const answer =
        typedAnswer.trim();

      if (!answer) {
        return;
      }

      setLiveTranscript(
        answer
      );

      void processAnswer(
        answer
      );

      setTypedAnswer("");
    };

  /* =======================================================
     LANGUAGE CHANGE
  ======================================================== */

  const changeLanguage =
    (
      newLanguage:
        VoiceLanguage
    ) => {
      stopTamilQuestion();

      cancelSpeech();

      setLanguage(
        newLanguage
      );
    };

  /* =======================================================
     UI
  ======================================================== */

  return (
    <div className="mx-auto w-full max-w-[1350px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

      {/* ===================================================
          HEADER
      ==================================================== */}

      <section className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

        <div>

          <div className="flex items-center gap-2">

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf5ec]">

              <Mic className="h-[18px] w-[18px] text-[#146c43]" />

            </div>

            <span className="text-xs font-semibold uppercase tracking-[0.13em] text-[#146c43]">
              Voice Farm Registration
            </span>

          </div>

          <h1 className="vg-heading mt-3 text-3xl font-bold tracking-[-0.04em] text-[#13271d] sm:text-4xl">
            பேசுங்கள். VazhaiGuard புரிந்துகொள்ளும்.
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            படிக்கவோ type செய்யவோ தேவையில்லை.
            கேள்வியை கேட்டு, உங்கள் பதிலை
            சாதாரணமாக பேசுங்கள்.
          </p>

        </div>

        {/* ===============================================
            LANGUAGE SWITCH
        ================================================ */}

        <div className="flex w-fit rounded-2xl border border-border bg-white p-1 shadow-sm">

          <button
            type="button"
            onClick={() =>
              changeLanguage(
                "ta-IN"
              )
            }
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
              language ===
              "ta-IN"
                ? "bg-[#073b2a] text-white"
                : "text-muted-foreground"
            }`}
          >
            <Languages className="h-4 w-4" />

            தமிழ்
          </button>

          <button
            type="button"
            onClick={() =>
              changeLanguage(
                "en-IN"
              )
            }
            className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
              language ===
              "en-IN"
                ? "bg-[#073b2a] text-white"
                : "text-muted-foreground"
            }`}
          >
            English
          </button>

        </div>

      </section>

      {/* ===================================================
          TAMIL VOICE INFORMATION

          Because native MP3 is now being used,
          missing browser Tamil TTS is no longer fatal.
      ==================================================== */}

      {language ===
        "ta-IN" &&
        !tamilVoiceAvailable && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#cfe7d5] bg-[#f5fbf6] p-4">

            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#22a35a]" />

            <div>

              <p className="text-xs font-semibold text-[#146c43]">
                இயல்பான தமிழ் குரல் செயல்பாட்டில் உள்ளது
              </p>

              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                இந்த சாதனத்தில் browser Tamil voice இல்லாவிட்டாலும்,
                VazhaiGuard native Tamil audio மூலம் கேள்விகளை பேசும்.
              </p>

            </div>

          </div>
        )}

      {/* ===================================================
          ERRORS
      ==================================================== */}

      {(pageError ||
        voiceError) && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">

            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <p className="text-xs leading-5 text-red-700">
              {pageError ||
                voiceError}
            </p>

          </div>
        )}

      {/* ===================================================
          MAIN CONTENT
      ==================================================== */}

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">

        {/* ===============================================
            VOICE ASSISTANT
        ================================================ */}

        <VoiceAssistantCard
          language={
            language
          }

          question={
            complete
              ? language ===
                "ta-IN"
                ? "அடிப்படை தோட்ட பதிவு முடிந்தது."
                : "Basic farm registration is complete."
              : question
          }

          transcript={
            liveTranscript
          }

          isListening={
            isListening
          }

          isSpeaking={
            isSpeaking
          }

          isProcessing={
            isProcessing
          }

          step={
            fieldNumber[
              currentField
            ]
          }

          totalSteps={9}

          onListen={
            beginListening
          }

          onStop={
            handleStopListening
          }

          onReplay={
            replayQuestion
          }
        />

        {/* ===============================================
            LIVE FARM PROFILE
        ================================================ */}

        <aside className="vg-card p-5 sm:p-6">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#146c43]">
                Live Farm Profile
              </p>

              <h2 className="vg-heading mt-1 text-xl font-bold">
                பதிவு செய்யப்பட்ட தகவல்
              </h2>

            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf5ec]">

              <Leaf className="h-5 w-5 text-[#146c43]" />

            </div>

          </div>

          <div className="mt-5 space-y-2.5">

            <ProfileValue
              label="தோட்டத்தின் பெயர்"
              value={
                farmState.farm_name
              }
            />

            <ProfileValue
              label="மொத்த நிலப்பரப்பு"
              value={
                farmState.total_farm_acres !== undefined
                  ? `${farmState.total_farm_acres} acres`
                  : undefined
              }
            />

            <ProfileValue
              label="வாழை பயிரிடப்பட்ட பரப்பு"
              value={
                farmState.banana_area_acres !== undefined
                  ? `${farmState.banana_area_acres} acres`
                  : undefined
              }
            />

            <ProfileValue
              label="வாழை வகை"
              value={
                farmState.banana_variety
              }
            />

            <ProfileValue
              label="நடவு வயது"
              value={
                farmState.planting_age
              }
            />

            <ProfileValue
              label="சுமார் மரங்கள்"
              value={
                farmState.approximate_plants ??
                undefined
              }
            />

            <ProfileValue
              label="வடிகால்"
              value={
                farmState.drainage
              }
            />

            <ProfileValue
              label="ஆதரவு கம்பு"
              value={
                farmState.support
              }
            />

            <ProfileValue
              label="தொழிலாளர் அணுகல்"
              value={
                farmState.accessibility
              }
            />

          </div>

          {/* =============================================
              COMPLETED
          ============================================== */}

          {complete && (
            <div className="mt-5 rounded-[20px] border border-[#cae5d1] bg-[#f3fbf5] p-4">

              <div className="flex gap-3">

                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#22a35a]" />

                <div>

                  <p className="text-sm font-semibold text-[#13271d]">
                    அடிப்படை பதிவு முடிந்தது
                  </p>

                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    அடுத்து GPS இடத்தையும்
                    தோட்ட எல்லையையும்
                    satellite வரைபடத்தில் உறுதி செய்வோம்.
                  </p>

                  <Button
                    type="button"
                    onClick={() => {
                      localStorage.setItem(
                        "vazhaiguard_farm_profile",
                        JSON.stringify(
                          farmState
                        )
                      );

                      navigate(
                        "/farm/location"
                      );
                    }}
                    className="mt-4 h-10 rounded-xl bg-[#073b2a] px-4 text-white hover:bg-[#0b4d36]"
                  >
                    Satellite Map-க்கு தொடரவும்
                  </Button>

                </div>

              </div>

            </div>
          )}

        </aside>

      </div>

      {/* ===================================================
          TYPING FALLBACK
      ==================================================== */}

      {!complete && (
        <section className="mt-5">

          {!showTyping ? (
            <button
              type="button"
              onClick={() =>
                setShowTyping(
                  true
                )
              }
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-[#073b2a]"
            >
              <Keyboard className="h-4 w-4" />

              பேச முடியவில்லையா? Type செய்யலாம்
            </button>
          ) : (
            <div className="vg-card flex flex-col gap-3 p-4 sm:flex-row">

              <Input
                value={
                  typedAnswer
                }
                onChange={(
                  event
                ) =>
                  setTypedAnswer(
                    event.target.value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    submitTypedAnswer();
                  }
                }}
                placeholder="உங்கள் பதிலை இங்கே எழுதலாம்..."
                className="h-11 rounded-xl"
              />

              <Button
                onClick={
                  submitTypedAnswer
                }
                className="h-11 rounded-xl bg-[#073b2a] px-5 hover:bg-[#0b4d36]"
              >
                அனுப்பு
              </Button>

            </div>
          )}

        </section>
      )}

      {/* ===================================================
          PRIVACY
      ==================================================== */}

      <div className="mt-5 flex items-start gap-2 rounded-2xl bg-[#f5f8f5] p-4">

        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#146c43]" />

        <p className="text-[10px] leading-5 text-muted-foreground">
          இந்த registration-க்கு தேவையான structured farm
          information மட்டும் சேமிக்கப்படும். தேவையில்லாமல் raw
          voice recording சேமிக்கப்படாது.
        </p>

      </div>

    </div>
  );
}

/* =========================================================
   PROFILE VALUE
========================================================= */

function ProfileValue({
  label,
  value,
}: {
  label: string;

  value?:
    | string
    | number
    | null;
}) {
  const available =
    value !==
      undefined &&
    value !== null &&
    value !== "";

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-[#fafcfb] px-3.5 py-3">

      <p className="text-[11px] text-muted-foreground">
        {label}
      </p>

      {available ? (
        <div className="flex items-center gap-1.5">

          <CheckCircle2 className="h-3.5 w-3.5 text-[#22a35a]" />

          <p className="max-w-[160px] truncate text-xs font-semibold text-[#13271d]">
            {String(value)}
          </p>

        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground/50">
          இன்னும் இல்லை
        </span>
      )}

    </div>
  );
}
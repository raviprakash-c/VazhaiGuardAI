import type {
  RegistrationField,
} from "../types/voice";

/* =========================================================
   BACKEND TAMIL TTS
========================================================= */

const TAMIL_AUDIO_BASE_URL =
  "http://127.0.0.1:8000/voice/tamil-audio";

let activeAudio:
  | HTMLAudioElement
  | null = null;

let pendingResolve:
  | (() => void)
  | null = null;

function audioUrl(
  field: string
) {
  return `${TAMIL_AUDIO_BASE_URL}/${encodeURIComponent(field)}`;
}

function getTamilPlayer(): HTMLAudioElement {
  if (!activeAudio) {
    activeAudio =
      new Audio();

    activeAudio.preload =
      "auto";

    activeAudio.volume =
      1;
  }

  return activeAudio;
}

export function stopTamilQuestion() {
  if (!activeAudio) {
    return;
  }

  activeAudio.pause();

  activeAudio.currentTime =
    0;

  activeAudio.onended =
    null;

  activeAudio.onerror =
    null;

  if (pendingResolve) {
    pendingResolve();

    pendingResolve =
      null;
  }
}

function playAudio(
  source: string
): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      stopTamilQuestion();

      const audio =
        getTamilPlayer();

      pendingResolve =
        resolve;

      audio.onended =
        () => {
          pendingResolve =
            null;

          resolve();
        };

      audio.onerror =
        () => {
          pendingResolve =
            null;

          console.error(
            "Unable to load Tamil audio:",
            source
          );

          reject(
            new Error(
              `Unable to load ${source}`
            )
          );
        };

      audio.src =
        source;

      audio.load();

      console.log(
        "[TamilVoice] Playing:",
        source
      );

      audio.play().catch(
        (error) => {
          pendingResolve =
            null;

          console.error(
            "Unable to play Tamil audio:",
            error
          );

          reject(error);
        }
      );
    }
  );
}

export async function playTamilQuestion(
  field: RegistrationField
) {
  try {
    await playAudio(
      audioUrl(field)
    );
  } catch (error) {
    console.error(
      "Tamil question playback failed:",
      error
    );
  }
}

export async function playTamilAcceptedTurn(
  nextField: RegistrationField
) {
  try {
    if (
      nextField ===
      "complete"
    ) {
      await playTamilQuestion(
        "complete"
      );

      return;
    }

    await playAudio(
      audioUrl(
        "confirmed"
      )
    );

    await playTamilQuestion(
      nextField
    );
  } catch (error) {
    console.error(
      "Tamil accepted turn failed:",
      error
    );
  }
}

export async function playTamilRetry(
  currentField: RegistrationField
) {
  try {
    await playAudio(
      audioUrl(
        "retry"
      )
    );

    await playTamilQuestion(
      currentField
    );
  } catch (error) {
    console.error(
      "Tamil retry playback failed:",
      error
    );
  }
}

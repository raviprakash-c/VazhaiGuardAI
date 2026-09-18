import type {
  RegistrationField,
} from "../types/voice";

/* =========================================================
   TAMIL AUDIO FILES
========================================================= */

const questionAudio: Record<
  RegistrationField,
  string
> = {
  farm_name:
    "/audio/ta/farm-name.mp3",

  banana_variety:
    "/audio/ta/banana-variety.mp3",

  planting_age:
    "/audio/ta/planting-age.mp3",

  approximate_plants:
    "/audio/ta/plant-count.mp3",

  drainage:
    "/audio/ta/drainage.mp3",

  support:
    "/audio/ta/support.mp3",

  accessibility:
    "/audio/ta/accessibility.mp3",

  complete:
    "/audio/ta/complete.mp3",
};

/*
 * These are reusable natural
 * Tamil responses.
 */
const systemAudio = {
  confirmed:
    "/audio/ta/confirmed.mp3",

  retry:
    "/audio/ta/retry.mp3",
};

/* =========================================================
   CURRENT AUDIO
========================================================= */

let activeAudio:
  | HTMLAudioElement
  | null = null;

/* =========================================================
   PLAY A SINGLE AUDIO FILE
========================================================= */

function playAudio(
  source: string
): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      stopTamilQuestion();

      const audio =
        new Audio(source);

      activeAudio =
        audio;

      audio.preload =
        "auto";

      audio.volume =
        1;

      audio.onended =
        () => {
          activeAudio =
            null;

          resolve();
        };

      audio.onerror =
        () => {
          activeAudio =
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

      audio.play().catch(
        (error) => {
          activeAudio =
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

/* =========================================================
   PLAY QUESTION
========================================================= */

export async function playTamilQuestion(
  field: RegistrationField
) {
  const source =
    questionAudio[field];

  if (!source) {
    console.error(
      "Tamil question audio missing:",
      field
    );

    return;
  }

  try {
    await playAudio(
      source
    );
  } catch (error) {
    console.error(
      "Tamil question playback failed:",
      error
    );
  }
}

/* =========================================================
   ACCEPTED ANSWER
   "சரி, பதிவு பண்ணிக்கிறேன்"
   → then next question
========================================================= */

export async function playTamilAcceptedTurn(
  nextField: RegistrationField
) {
  try {
    /*
     * Don't play the generic confirmation
     * before the final completion message.
     */
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
      systemAudio.confirmed
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

/* =========================================================
   FAILED / UNCLEAR ANSWER
========================================================= */

export async function playTamilRetry(
  currentField: RegistrationField
) {
  try {
    await playAudio(
      systemAudio.retry
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

/* =========================================================
   STOP AUDIO
========================================================= */

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

  activeAudio =
    null;
}
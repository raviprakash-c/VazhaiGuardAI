export type VoiceLanguage = "ta-IN" | "en-IN";

export type TamilVoiceField =
  | "farm_name"
  | "total_farm_acres"
  | "banana_area_acres"
  | "banana_variety"
  | "planting_age"
  | "approximate_plants"
  | "drainage"
  | "support"
  | "accessibility";

export type RegistrationField =
  | "farm_name"
  | "total_farm_acres"
  | "banana_area_acres"
  | "banana_variety"
  | "planting_age"
  | "approximate_plants"
  | "drainage"
  | "support"
  | "accessibility"
  | "complete";

const API_BASE_URL = "http://127.0.0.1:8000";

let currentAudio: HTMLAudioElement | null = null;

/**
 * Stop currently playing Tamil audio.
 */
export const stopTamilQuestion = (): void => {
  if (!currentAudio) {
    return;
  }

  try {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.removeAttribute("src");
    currentAudio.load();
  } catch (error) {
    console.warn(
      "[TamilVoice] Could not stop current audio:",
      error,
    );
  }

  currentAudio = null;
};

/**
 * Check whether a registration field has Tamil audio.
 */
const isTamilVoiceField = (
  field: RegistrationField | string | null | undefined,
): field is TamilVoiceField => {
  return (
    field === "farm_name" ||
    field === "total_farm_acres" ||
    field === "banana_area_acres" ||
    field === "banana_variety" ||
    field === "planting_age" ||
    field === "approximate_plants" ||
    field === "drainage" ||
    field === "support" ||
    field === "accessibility"
  );
};

/**
 * Play Tamil question audio for a registration field.
 */
export const playTamilQuestion = async (
  field: RegistrationField | string,
): Promise<void> => {
  if (!isTamilVoiceField(field)) {
    console.warn(
      "[TamilVoice] No Tamil audio available for field:",
      field,
    );
    return;
  }

  stopTamilQuestion();

  const url =
    `${API_BASE_URL}/voice/tamil-audio/${encodeURIComponent(field)}` +
    `?t=${Date.now()}`;

  console.log("[TamilVoice] Playing:", url);

  const audio = new Audio();

  currentAudio = audio;

  audio.preload = "auto";

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      audio.onloadeddata = null;
      audio.oncanplay = null;
      audio.oncanplaythrough = null;
      audio.onerror = null;
      audio.onended = null;
    };

    const finishSuccess = () => {
      if (settled) {
        return;
      }

      settled = true;

      cleanup();

      if (currentAudio === audio) {
        currentAudio = null;
      }

      resolve();
    };

    const finishError = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;

      cleanup();

      if (currentAudio === audio) {
        currentAudio = null;
      }

      reject(error);
    };

    audio.onloadeddata = () => {
      console.log(
        "[TamilVoice] Audio loaded:",
        url,
      );
    };

    audio.oncanplay = () => {
      console.log(
        "[TamilVoice] Audio can play:",
        url,
      );
    };

    audio.oncanplaythrough = async () => {
      if (settled) {
        return;
      }

      try {
        console.log(
          "[TamilVoice] Starting playback:",
          url,
        );

        await audio.play();

        console.log(
          "[TamilVoice] Playback started:",
          url,
        );
      } catch (error) {
        console.error(
          "[TamilVoice] Browser blocked playback:",
          error,
        );

        finishError(
          new Error(
            `Tamil audio playback failed: ${
              error instanceof Error
                ? error.message
                : String(error)
            }`,
          ),
        );
      }
    };

    audio.onerror = () => {
      console.error(
        "[TamilVoice] Audio load failed:",
        url,
        audio.error,
      );

      finishError(
        new Error(
          "Tamil audio could not be loaded. " +
            "Check that the FastAPI endpoint exists " +
            "and returns a valid audio file.",
        ),
      );
    };

    audio.onended = () => {
      console.log(
        "[TamilVoice] Playback finished:",
        field,
      );

      finishSuccess();
    };

    audio.src = url;

    audio.load();
  });
};

/**
 * Play Tamil audio after an answer was accepted.
 */
export const playTamilAcceptedTurn = async (
  field: RegistrationField | string,
): Promise<void> => {
  if (field === "complete") {
    console.log(
      "[TamilVoice] Registration complete. No next question.",
    );
    return;
  }

  if (!isTamilVoiceField(field)) {
    console.warn(
      "[TamilVoice] Invalid accepted field:",
      field,
    );
    return;
  }

  return playTamilQuestion(field);
};

/**
 * Play Tamil audio when the user's answer needs to be retried.
 */
export const playTamilRetry = async (
  field: RegistrationField | string,
): Promise<void> => {
  if (field === "complete") {
    console.log(
      "[TamilVoice] Cannot retry completed registration.",
    );
    return;
  }

  if (!isTamilVoiceField(field)) {
    console.warn(
      "[TamilVoice] Invalid retry field:",
      field,
    );
    return;
  }

  return playTamilQuestion(field);
};
import type {
  RegistrationField,
} from "../types/voice";


const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");


const TAMIL_AUDIO_BASE_URL =
  `${API_BASE_URL}/voice/tamil-audio`;


let activeAudio:
  | HTMLAudioElement
  | null = null;


function audioUrl(
  field: string
) {
  return (
    `${TAMIL_AUDIO_BASE_URL}/` +
    encodeURIComponent(field) +
    `?t=${Date.now()}`
  );
}


function stopCurrentAudio() {
  if (!activeAudio) {
    return;
  }

  activeAudio.pause();

  activeAudio.currentTime = 0;

  activeAudio.src = "";

  activeAudio = null;
}


export function stopTamilQuestion() {
  stopCurrentAudio();
}


function playAudio(
  source: string
): Promise<void> {

  return new Promise(
    (resolve, reject) => {

      stopCurrentAudio();

      const audio =
        new Audio(source);

      activeAudio =
        audio;

      audio.preload =
        "auto";

      audio.volume =
        1;

      audio.oncanplay = () => {
        console.log(
          "[TamilVoice] Audio ready:",
          source
        );
      };

      audio.onplay = () => {
        console.log(
          "[TamilVoice] Playing:",
          source
        );
      };

      audio.onended = () => {
        activeAudio =
          null;

        resolve();
      };

      audio.onerror = () => {

        console.error(
          "[TamilVoice] Audio load failed:",
          source,
          audio.error
        );

        activeAudio =
          null;

        reject(
          new Error(
            "Tamil audio could not be loaded"
          )
        );
      };


      audio
        .play()
        .catch(
          (error) => {

            console.error(
              "[TamilVoice] Browser blocked playback:",
              error
            );

            activeAudio =
              null;

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

    throw error;
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
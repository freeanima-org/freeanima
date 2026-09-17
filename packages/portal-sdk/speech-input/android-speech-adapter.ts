import {
  listenSpeechRecognitionResult,
  startNativeSpeechRecognition,
  stopNativeSpeechRecognition,
  isVoiceWakeSupported,
} from "../voice-wake/index.ts";
import type { SpeechInputAdapter, SpeechInputResult } from "./types.ts";

const ANDROID_LISTEN_TIMEOUT_MS = 14_000;

export function createAndroidSpeechInputAdapter(): SpeechInputAdapter {
  return {
    id: "android",
    isSupported: () => isVoiceWakeSupported(),
    transcribe: async () => {
      if (!isVoiceWakeSupported()) {
        throw new Error("Android 系统语音识别不可用");
      }
      return await new Promise<SpeechInputResult>((resolve, reject) => {
        let settled = false;
        let listener: Awaited<ReturnType<typeof listenSpeechRecognitionResult>> | undefined;
        const timer = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          void stopNativeSpeechRecognition();
          void listener?.unregister();
          reject(new Error("语音识别超时"));
        }, ANDROID_LISTEN_TIMEOUT_MS);

        void listenSpeechRecognitionResult((event) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          void listener?.unregister();
          if (!event.ok) {
            reject(new Error(event.error));
            return;
          }
          resolve({
            text: event.text,
            confidence: event.confidence ?? 0.85,
            source: "android",
          });
        })
          .then((handle) => {
            listener = handle;
            return startNativeSpeechRecognition();
          })
          .catch((err) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            void listener?.unregister();
            reject(err instanceof Error ? err : new Error(String(err)));
          });
      });
    },
  };
}

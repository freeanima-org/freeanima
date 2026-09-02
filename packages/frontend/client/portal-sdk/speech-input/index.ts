import { createAndroidSpeechInputAdapter } from "./android-speech-adapter.ts";
import { createHabitatAsrAdapter } from "./habitat-asr-adapter.ts";
import {
  SPEECH_INPUT_MIN_CONFIDENCE,
  type SpeechInputAdapter,
  type SpeechInputResult,
} from "./types.ts";

export type SpeechInputOptions = {
  /** 强制走 Hub ASR */
  preferCloud?: boolean;
  minConfidence?: number;
};

const androidAdapter = createAndroidSpeechInputAdapter();
const habitatAdapter = createHabitatAsrAdapter();

function pickAdapters(opts?: SpeechInputOptions): SpeechInputAdapter[] {
  if (opts?.preferCloud) return [habitatAdapter];
  const list: SpeechInputAdapter[] = [];
  if (androidAdapter.isSupported()) list.push(androidAdapter);
  list.push(habitatAdapter);
  return list;
}

export async function transcribeSpeechInput(opts?: SpeechInputOptions): Promise<SpeechInputResult> {
  const minConfidence = opts?.minConfidence ?? SPEECH_INPUT_MIN_CONFIDENCE;
  const adapters = pickAdapters(opts);
  let lastError: Error | null = null;
  for (const adapter of adapters) {
    if (!adapter.isSupported()) continue;
    try {
      const result = await adapter.transcribe();
      if (result.text.trim() && result.confidence >= minConfidence) {
        return result;
      }
      lastError = new Error("识别置信度过低");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error("没有可用的语音识别适配器");
}

export { SPEECH_INPUT_MIN_CONFIDENCE };

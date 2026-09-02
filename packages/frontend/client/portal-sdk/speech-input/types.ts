export type SpeechInputResult = {
  text: string;
  confidence: number;
  source: "android" | "habitat" | "web";
};

export type SpeechInputAdapter = {
  readonly id: string;
  isSupported(): boolean;
  transcribe(opts?: { maxDurationMs?: number }): Promise<SpeechInputResult>;
};

export const SPEECH_INPUT_MIN_CONFIDENCE = 0.35;

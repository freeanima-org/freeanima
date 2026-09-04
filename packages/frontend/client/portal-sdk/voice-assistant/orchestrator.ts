import { enqueueSpeechPlayback, stopSpeechPlayback } from "../speech/speech-playback-service.ts";
import { transcribeSpeechInput } from "../speech-input/index.ts";
import type { SpeechInputOptions } from "../speech-input/index.ts";
import { executeVoiceIntent } from "../voice-actions/execute-intent.ts";
import { parseVoiceIntent } from "./intent-parser.ts";
import { runVoiceLlmFallback } from "./llm-fallback.ts";

export type VoiceAssistantPhase = "idle" | "listening" | "processing" | "speaking";

export type VoiceAssistantSnapshot = {
  phase: VoiceAssistantPhase;
  transcript: string | null;
  resultMessage: string | null;
  error: string | null;
};

type Listener = () => void;

let phase: VoiceAssistantPhase = "idle";
let transcript: string | null = null;
let resultMessage: string | null = null;
let error: string | null = null;
/** 缓存快照：useSyncExternalStore 的 getSnapshot 必须引用稳定，否则 mount 即 #185 */
let snapshot: VoiceAssistantSnapshot = {
  phase,
  transcript,
  resultMessage,
  error,
};
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l();
}

function setState(patch: Partial<VoiceAssistantSnapshot>): void {
  if (patch.phase !== undefined) phase = patch.phase;
  if (patch.transcript !== undefined) transcript = patch.transcript;
  if (patch.resultMessage !== undefined) resultMessage = patch.resultMessage;
  if (patch.error !== undefined) error = patch.error;
  snapshot = { phase, transcript, resultMessage, error };
  emit();
}

export function getVoiceAssistantSnapshot(): VoiceAssistantSnapshot {
  return snapshot;
}

export function subscribeVoiceAssistant(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function speakFeedback(message: string): Promise<void> {
  setState({ phase: "speaking", resultMessage: message, error: null });
  await new Promise<void>((resolve) => {
    enqueueSpeechPlayback("voice-assistant-feedback", message, "zh-CN");
    window.setTimeout(resolve, Math.min(6000, message.length * 220 + 800));
  });
}

export async function runVoiceAssistantTurn(opts?: SpeechInputOptions): Promise<void> {
  if (phase === "listening" || phase === "processing") return;
  setState({
    phase: "listening",
    transcript: null,
    resultMessage: null,
    error: null,
  });
  try {
    const input = await transcribeSpeechInput(opts);
    setState({ phase: "processing", transcript: input.text });
    const intent = parseVoiceIntent(input.text);
    const result =
      intent.kind === "unknown"
        ? await runVoiceLlmFallback(input.text)
        : await executeVoiceIntent(intent);
    if (!result.ok) {
      setState({ phase: "idle", error: result.message });
      await speakFeedback(result.message);
      return;
    }
    setState({ phase: "idle", resultMessage: result.message, error: null });
    await speakFeedback(result.message);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setState({ phase: "idle", error: message });
    await speakFeedback(message);
  }
}

export function resetVoiceAssistant(): void {
  stopSpeechPlayback();
  setState({
    phase: "idle",
    transcript: null,
    resultMessage: null,
    error: null,
  });
}

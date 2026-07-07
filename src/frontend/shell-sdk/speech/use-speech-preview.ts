import { useCallback, useEffect, useRef, useState } from "react";
import type { SpeechPlaybackConfig } from "./types.ts";
import { createSpeechAdapter, stopSpeechPreview } from "./create-adapter.ts";
import { consumeLastHubSpeechError, primeHubSpeechOutput } from "./hub-adapter.ts";

let previewAdapter: ReturnType<typeof createSpeechAdapter> | null = null;

export function useSpeechPreview(config: SpeechPlaybackConfig, locale: string) {
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(
    () => () => {
      previewAdapter?.stop();
      previewAdapter = null;
      stopSpeechPreview(configRef.current);
    },
    [],
  );

  const prime = useCallback(() => {
    if (configRef.current.provider === "edge-tts") {
      primeHubSpeechOutput();
    }
  }, []);

  const runPreview = useCallback(
    (text: string) => {
      setError("");
      previewAdapter?.stop();
      stopSpeechPreview(configRef.current);

      const trimmed = text.trim();
      if (!trimmed) {
        setError("试听文本不能为空");
        return;
      }

      const adapter = createSpeechAdapter(configRef.current);
      if (!adapter.isSupported()) {
        setError("当前环境不支持所选朗读方式");
        return;
      }

      previewAdapter = adapter;
      setPreviewing(true);
      primeHubSpeechOutput();

      adapter.speak(
        trimmed,
        locale,
        () => setPreviewing(false),
        () => {
          setPreviewing(false);
          setError(consumeLastHubSpeechError() ?? "语音播放失败");
        },
      );
    },
    [locale],
  );

  const stop = useCallback(() => {
    previewAdapter?.stop();
    previewAdapter = null;
    stopSpeechPreview(configRef.current);
    setPreviewing(false);
  }, []);

  return { previewing, error, setError, runPreview, stop, prime };
}

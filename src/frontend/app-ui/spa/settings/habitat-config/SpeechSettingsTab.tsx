import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, Input } from "@freeanima/frontend/ui-kit";
import { Label } from "@freeanima/frontend/ui-kit/components/ui";
import { StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import { FormToggle } from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";
import { patchHabitatConfigSection } from "@freeanima/frontend/portal-sdk/habitat-config-api";
import { EDGE_TTS_VOICE_OPTIONS } from "@freeanima/frontend/portal-sdk/speech/edge-voices";
import {
  parseSpeechConfigFromHub,
  readSpeechConfigDraft,
  speechConfigDraftToPatch,
  type SpeechConfigDraft,
  type TtsProvider,
} from "@freeanima/frontend/portal-sdk/speech/types";
import { useSpeechPreview } from "@freeanima/frontend/portal-sdk/speech/use-speech-preview";
import {
  listWebSpeechVoices,
  type WebSpeechVoiceInfo,
} from "@freeanima/frontend/portal-sdk/speech/web-speech";
import {
  getWebSpeechUnsupportedReason,
  isWebSpeechApiAvailable,
} from "@freeanima/frontend/portal-sdk/speech/web-speech-support";

const LANG_OPTIONS = [
  { value: "", label: "跟随应用语言" },
  { value: "zh-CN", label: "中文（zh-CN）" },
  { value: "en-US", label: "English（en-US）" },
];

const PROVIDER_OPTIONS: Array<{ value: TtsProvider; label: string }> = [
  { value: "edge-tts", label: "Edge TTS（栖息地合成，推荐）" },
  { value: "web-speech", label: "浏览器 Web Speech（本机离线）" },
];

const selectClassName =
  "border-input flex h-8 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function numberField(
  label: string,
  value: number,
  onChange: (v: number) => void,
  opts?: { min?: number; max?: number; step?: number; hint?: string },
): ReactNode {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Input
        type="number"
        min={opts?.min}
        max={opts?.max}
        step={opts?.step ?? 0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {opts?.hint ? <p className="text-xs text-muted-foreground">{opts.hint}</p> : null}
    </div>
  );
}

type Props = {
  config: Record<string, unknown>;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onError: (message: string) => void;
  onSaved: () => Promise<void>;
};

export function SpeechSettingsTab({ config, saving, onSavingChange, onError, onSaved }: Props) {
  const [draft, setDraft] = useState<SpeechConfigDraft>(() => readSpeechConfigDraft(config.tts));
  const [voices, setVoices] = useState<WebSpeechVoiceInfo[]>([]);

  const previewOptions = useMemo(() => parseSpeechConfigFromHub(draft), [draft]);
  const previewLocale = draft.lang.trim() || navigator.language || "zh-CN";
  const {
    previewing,
    error: localError,
    setError: setLocalError,
    runPreview,
    stop,
    prime,
  } = useSpeechPreview(previewOptions, previewLocale);

  useEffect(() => {
    setDraft(readSpeechConfigDraft(config.tts));
  }, [config.tts]);

  useEffect(() => {
    const refresh = () => setVoices(listWebSpeechVoices());
    refresh();
    const synth = typeof speechSynthesis !== "undefined" ? speechSynthesis : undefined;
    if (!synth) return;
    synth.addEventListener("voiceschanged", refresh);
    return () => synth.removeEventListener("voiceschanged", refresh);
  }, []);

  const webSpeechIssue = getWebSpeechUnsupportedReason(true);
  const previewSupported =
    draft.enabled &&
    (draft.provider === "edge-tts" || (isWebSpeechApiAvailable() && webSpeechIssue === null));

  const save = useCallback(async () => {
    onSavingChange(true);
    onError("");
    setLocalError("");
    try {
      await patchHabitatConfigSection("tts", speechConfigDraftToPatch(draft));
      await onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onSavingChange(false);
    }
  }, [draft, onError, onSaved, onSavingChange, setLocalError]);

  const preview = useCallback(() => {
    stop();
    runPreview(draft.preview_text);
  }, [draft.preview_text, runPreview, stop]);

  return (
    <Card className="bg-muted py-0">
      <CardContent className="gap-4 py-4">
        <FormToggle
          className="w-full"
          label="启用消息朗读"
          hint="关闭后聊天室隐藏朗读按钮；配置仍保存在 Habitat。"
          checked={draft.enabled}
          onChange={(enabled) => setDraft((d) => ({ ...d, enabled }))}
        />

        <div className="space-y-1">
          <Label className="text-sm">合成方式</Label>
          <select
            className={selectClassName}
            value={draft.provider}
            onChange={(e) => setDraft((d) => ({ ...d, provider: e.target.value as TtsProvider }))}
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {draft.provider === "edge-tts" ? (
          <StatusAlert variant="info">
            朗读文本经 Habitat 发送至 Microsoft Edge 语音服务合成；Habitat 需能访问外网。
          </StatusAlert>
        ) : null}

        {draft.provider === "web-speech" && webSpeechIssue === "insecure_context" ? (
          <StatusAlert variant="warning">
            当前页面非安全上下文（HTTP 局域网），浏览器 Web Speech 不可用。请改用 Edge TTS 或 HTTPS
            访问 Habitat。
          </StatusAlert>
        ) : null}

        {draft.provider === "web-speech" && webSpeechIssue === "no_api" ? (
          <StatusAlert variant="warning">
            当前环境不支持 Web Speech API，无法朗读或试听。
          </StatusAlert>
        ) : null}

        <div className="space-y-1">
          <Label className="text-sm">语言</Label>
          <select
            className={selectClassName}
            value={draft.lang}
            onChange={(e) => setDraft((d) => ({ ...d, lang: e.target.value }))}
          >
            {LANG_OPTIONS.map((opt) => (
              <option key={opt.value || "auto"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-sm">语音名称</Label>
          {draft.provider === "edge-tts" ? (
            <>
              <select
                className={selectClassName}
                value={draft.voice_name}
                onChange={(e) => setDraft((d) => ({ ...d, voice_name: e.target.value }))}
              >
                <option value="">跟随语言默认</option>
                {EDGE_TTS_VOICE_OPTIONS.map((voice: (typeof EDGE_TTS_VOICE_OPTIONS)[number]) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.label}（{voice.name}）
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Microsoft Edge Neural 语音；留空则按语言自动选择。
              </p>
            </>
          ) : (
            <>
              <Input
                list="speech-voice-options"
                value={draft.voice_name}
                placeholder="留空则按语言自动选择"
                onChange={(e) => setDraft((d) => ({ ...d, voice_name: e.target.value }))}
              />
              <datalist id="speech-voice-options">
                {voices.map((voice) => (
                  <option key={`${voice.name}:${voice.lang}`} value={voice.name}>
                    {voice.lang}
                  </option>
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                可选本机已安装的语音包；名称因浏览器/系统而异。
              </p>
            </>
          )}
        </div>

        {draft.provider === "web-speech" ? (
          <FormToggle
            className="w-full"
            label="优先本机语音"
            checked={draft.prefer_local}
            onChange={(prefer_local) => setDraft((d) => ({ ...d, prefer_local }))}
          />
        ) : null}

        {numberField("语速", draft.rate, (rate) => setDraft((d) => ({ ...d, rate })), {
          min: 0.1,
          max: 10,
          step: 0.1,
          hint: "0.1–10，默认 1",
        })}
        {numberField("音调", draft.pitch, (pitch) => setDraft((d) => ({ ...d, pitch })), {
          min: 0,
          max: 2,
          step: 0.1,
          hint: "0–2，默认 1",
        })}
        {numberField("音量", draft.volume, (volume) => setDraft((d) => ({ ...d, volume })), {
          min: 0,
          max: 1,
          step: 0.05,
          hint: "0–1，默认 1",
        })}

        <div className="space-y-1">
          <Label className="text-sm">试听文本</Label>
          <Input
            value={draft.preview_text}
            onChange={(e) => setDraft((d) => ({ ...d, preview_text: e.target.value }))}
          />
        </div>

        {localError ? <StatusAlert variant="error">{localError}</StatusAlert> : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!previewSupported || previewing}
            onPointerDown={prime}
            onClick={preview}
          >
            {previewing ? "播放中…" : "试听"}
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            保存语音配置
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          默认 Edge TTS 由服务端合成，手机浏览器与 APK 均可播放；Web Speech 适合离线或隐私场景（需
          HTTPS）。
        </p>
      </CardContent>
    </Card>
  );
}

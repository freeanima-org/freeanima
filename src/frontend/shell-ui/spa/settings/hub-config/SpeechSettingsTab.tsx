import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, Input } from "@freeanima/ui-kit";
import { Label } from "@freeanima/ui-kit/components/ui";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { FormToggle } from "@freeanima/ui-kit/form";
import { patchHubConfigSection } from "@freeanima/shell-sdk/hub-config-api";
import {
  parseSpeechConfigFromHub,
  readSpeechConfigDraft,
  speechConfigDraftToPatch,
  type SpeechConfigDraft,
} from "@freeanima/shell-sdk/speech/types";
import {
  listWebSpeechVoices,
  previewWebSpeech,
  stopWebSpeechPreview,
  type WebSpeechVoiceInfo,
} from "@freeanima/shell-sdk/speech/web-speech";

const LANG_OPTIONS = [
  { value: "", label: "跟随应用语言" },
  { value: "zh-CN", label: "中文（zh-CN）" },
  { value: "en-US", label: "English（en-US）" },
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
  const [previewing, setPreviewing] = useState(false);
  const [localError, setLocalError] = useState("");

  const previewOptions = useMemo(() => parseSpeechConfigFromHub(draft), [draft]);

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

  const save = useCallback(async () => {
    onSavingChange(true);
    onError("");
    setLocalError("");
    try {
      await patchHubConfigSection("tts", speechConfigDraftToPatch(draft));
      await onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onSavingChange(false);
    }
  }, [draft, onError, onSaved, onSavingChange]);

  const preview = useCallback(async () => {
    setLocalError("");
    stopWebSpeechPreview();
    setPreviewing(true);
    try {
      await previewWebSpeech(
        draft.preview_text,
        previewOptions,
        draft.lang.trim() || navigator.language || "zh-CN",
      );
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewing(false);
    }
  }, [draft.lang, draft.preview_text, previewOptions]);

  useEffect(() => () => stopWebSpeechPreview(), []);

  const webSpeechSupported = typeof speechSynthesis !== "undefined";

  return (
    <Card className="bg-muted py-0">
      <CardContent className="gap-4 py-4">
        {!webSpeechSupported ? (
          <StatusAlert variant="warning">
            当前环境不支持 Web Speech API，无法朗读或试听。
          </StatusAlert>
        ) : null}

        <FormToggle
          className="w-full"
          label="启用消息朗读"
          hint="关闭后聊天室隐藏朗读按钮；配置仍保存在 Hub。"
          checked={draft.enabled}
          onChange={(enabled) => setDraft((d) => ({ ...d, enabled }))}
        />

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
        </div>

        <FormToggle
          className="w-full"
          label="优先本机语音"
          checked={draft.prefer_local}
          onChange={(prefer_local) => setDraft((d) => ({ ...d, prefer_local }))}
        />

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
            disabled={!webSpeechSupported || previewing || !draft.enabled}
            onClick={() => void preview()}
          >
            {previewing ? "播放中…" : "试听"}
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            保存语音配置
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          使用浏览器 Web Speech API 朗读，无需 Hub 额外服务；修改后各客户端刷新即可生效。
        </p>
      </CardContent>
    </Card>
  );
}

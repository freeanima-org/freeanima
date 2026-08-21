import type { ReactNode } from "react";
import { useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@freeanima/ui-kit";
import { Label } from "@freeanima/ui-kit/components/ui";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import { useCompactLayout } from "@freeanima/ui-kit/layout";
import {
  habitatConfigNumberField,
  habitatConfigSelectClassName,
  hubConfigTextField,
} from "./habitat-config-field-helpers.tsx";
import { LlmModelPicker } from "./LlmModelPicker.tsx";
import { LlmVoicePicker } from "./LlmVoicePicker.tsx";
import { hubConfigVaultField } from "./habitat-config-vault-field.tsx";
import { HabitatConfigConnectionTestButton } from "./HabitatConfigConnectionTestButton.tsx";
import { LlmConnectionModelsTable } from "./LlmConnectionModelsTable.tsx";
import {
  applyCustomKindToConnectionEntry,
  connectionDefaultBaseUrl,
  CONNECTION_LAYERS,
  connectionIdsForLayer,
  LLM_SETTINGS_FORMATS,
  LLM_SETTINGS_GENERIC_AUDIO_PROTOCOLS,
  LLM_SETTINGS_GENERIC_EMBEDDINGS_PROTOCOLS,
  LLM_SETTINGS_GENERIC_IMAGE_PROTOCOLS,
  LLM_SETTINGS_PRESETS,
  applyPresetToConnectionEntry,
  presetModalitySuiteSummary,
  purposeRowsForFocus,
  readTimeoutDraft,
  sceneDraftVoice,
  validateTimeoutDraft,
  withSceneDraftVoice,
  type CapabilityPanelFocus,
  type ConnectionLayerId,
  type SceneBindingDraft,
  type TimeoutDraft,
} from "./llm-settings-draft.ts";
import { coerceString } from "@freeanima/shared/coerce-string";
import {
  ALIBABA_TOKEN_PLAN_ANTHROPIC_BASE_URL,
  effectiveProviderModalities,
  presetAllowsBaseUrlOverride,
} from "@freeanima/habitat/core/llm/presets";
import {
  DEFAULT_EDGE_TTS_BASE_URL,
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_PRESET_ALIBABA_TOKEN_PLAN,
  LLM_PRESET_CUSTOM,
  LLM_PRESET_IDS,
  LLM_PRESET_OPENCODE_GO,
  AUDIO_PROTOCOL_EDGE_TTS,
  type LlmPresetId,
} from "@freeanima/habitat/core/config";
import { voiceProtocolSeparatesModelAndVoice } from "@freeanima/habitat/core/tts/voice-catalog";

function isBuiltinPresetId(value: string): value is Exclude<LlmPresetId, "custom"> {
  return (LLM_PRESET_IDS as readonly string[]).includes(value) && value !== LLM_PRESET_CUSTOM;
}

function LabelControlRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string | undefined;
  children: ReactNode;
}): ReactNode {
  const compact = useCompactLayout();
  return (
    <div className={compact ? "space-y-1" : "flex items-start gap-3"}>
      <Label
        className={`text-sm ${compact ? "" : "flex h-8 w-28 shrink-0 items-center"}`}
        {...(htmlFor ? { htmlFor } : {})}
      >
        {label}
      </Label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function FormGroupCard({ title, children }: { title?: string; children: ReactNode }): ReactNode {
  return (
    <Card className="gap-3 py-4 shadow-none">
      {title ? (
        <CardHeader className="px-4">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className="space-y-4 px-4">{children}</CardContent>
    </Card>
  );
}

function ConnectionSelect({
  value,
  connectionIds,
  connectionLabels,
  onChange,
  id,
}: {
  value: string;
  connectionIds: string[];
  connectionLabels?: Record<string, string>;
  onChange: (id: string) => void;
  id?: string;
}) {
  const missing = value && !connectionIds.includes(value);
  return (
    <LabelControlRow label="连接" {...(id ? { htmlFor: id } : {})}>
      <div className="space-y-1">
        <select
          id={id}
          className={habitatConfigSelectClassName}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={connectionIds.length === 0 && !missing}
        >
          <option value="">选择连接…</option>
          {missing ? (
            <option value={value}>{(connectionLabels?.[value] ?? value) + "（已删除）"}</option>
          ) : null}
          {connectionIds.map((cid) => (
            <option key={cid} value={cid}>
              {connectionLabels?.[cid] ?? cid}
            </option>
          ))}
        </select>
        {connectionIds.length === 0 ? (
          <p className="text-xs text-muted-foreground">请先在「连接」页添加本层连接。</p>
        ) : null}
      </div>
    </LabelControlRow>
  );
}

function TimeoutAdvancedFields({
  entry,
  patch,
}: {
  entry: Record<string, unknown>;
  patch: (part: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(() => {
    const t = readTimeoutDraft(entry);
    return (
      t.timeout_ms !== "" ||
      t.connect_timeout_ms !== "" ||
      t.first_byte_timeout_ms !== "" ||
      t.idle_timeout_ms !== ""
    );
  });
  const draft = readTimeoutDraft(entry);
  const error = validateTimeoutDraft(draft);

  const commit = (next: TimeoutDraft) => {
    patch({
      timeout_ms: next.timeout_ms === "" ? undefined : next.timeout_ms,
      connect_timeout_ms: next.connect_timeout_ms === "" ? undefined : next.connect_timeout_ms,
      first_byte_timeout_ms:
        next.first_byte_timeout_ms === "" ? undefined : next.first_byte_timeout_ms,
      idle_timeout_ms: next.idle_timeout_ms === "" ? undefined : next.idle_timeout_ms,
    });
  };

  return (
    <div className="space-y-3">
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
        {open ? "收起高级超时" : "高级超时…"}
      </Button>
      {open ? (
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            单位毫秒；连接 / 首字节 / 空闲须 ≤ 整体。留空使用服务端默认。
          </p>
          {habitatConfigNumberField(
            "整体超时",
            draft.timeout_ms,
            (timeout_ms) => commit({ ...draft, timeout_ms }),
            { hint: "默认 600000（10 分钟）" },
          )}
          {habitatConfigNumberField(
            "连接超时",
            draft.connect_timeout_ms,
            (connect_timeout_ms) => commit({ ...draft, connect_timeout_ms }),
            { hint: "默认 10000（直到 HTTP 响应头，不是首 token）" },
          )}
          {habitatConfigNumberField(
            "首字节超时",
            draft.first_byte_timeout_ms,
            (first_byte_timeout_ms) => commit({ ...draft, first_byte_timeout_ms }),
            { hint: "默认 30000" },
          )}
          {habitatConfigNumberField(
            "空闲超时（流式）",
            draft.idle_timeout_ms,
            (idle_timeout_ms) => commit({ ...draft, idle_timeout_ms }),
            { hint: "默认 120000" },
          )}
          {error ? <StatusAlert variant="warning">{error}</StatusAlert> : null}
        </div>
      ) : null}
    </div>
  );
}

/** 连接编辑表单（放在 ModalSheetPresent 内）；新建与编辑同一面板，先选预设。 */
function isConnectionLayerId(value: string): value is ConnectionLayerId {
  return CONNECTION_LAYERS.some((l) => l.id === value);
}

export function LlmConnectionEditorForm({
  connectionId,
  entry,
  onChange,
  testDisabled,
}: {
  connectionId: string;
  entry: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  testDisabled?: boolean;
}) {
  const preset = coerceString(entry.preset ?? LLM_PRESET_CUSTOM);
  const isCustom = preset === LLM_PRESET_CUSTOM;
  const isGateway = preset === LLM_PRESET_OPENCODE_GO;
  const isAlibabaTokenPlan = preset === LLM_PRESET_ALIBABA_TOKEN_PLAN;
  const allowsBaseUrlOverride = isBuiltinPresetId(preset) && presetAllowsBaseUrlOverride(preset);
  const defaultUrl = connectionDefaultBaseUrl(preset);
  const kindRaw = coerceString(entry.custom_kind) || "text";
  const kind: ConnectionLayerId = isConnectionLayerId(kindRaw) ? kindRaw : "text";
  const isEdgeVoice = coerceString(entry.audio_protocol ?? "") === AUDIO_PROTOCOL_EDGE_TTS;

  const patch = (part: Record<string, unknown>) => {
    onChange({ ...entry, ...part });
  };

  const presetField = (
    <LabelControlRow label="预设" htmlFor="llm-connection-preset">
      <select
        id="llm-connection-preset"
        className={habitatConfigSelectClassName}
        value={preset}
        onChange={(e) => {
          onChange(applyPresetToConnectionEntry(entry, e.target.value));
        }}
      >
        {LLM_SETTINGS_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label} — {p.hint}
          </option>
        ))}
      </select>
    </LabelControlRow>
  );

  const kindField = isCustom ? (
    <LabelControlRow label="能力层" htmlFor="llm-connection-kind">
      <select
        id="llm-connection-kind"
        className={habitatConfigSelectClassName}
        value={kind}
        onChange={(e) => {
          const layer = e.target.value;
          if (!isConnectionLayerId(layer)) return;
          onChange(applyCustomKindToConnectionEntry(entry, layer));
        }}
      >
        {CONNECTION_LAYERS.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </LabelControlRow>
  ) : (
    <p className="text-xs text-muted-foreground">
      能力层由本预设的协议套件决定；一条内置连接可出现在多个能力页。
    </p>
  );

  const protocolField =
    isCustom && kind === "text" ? (
      <LabelControlRow label="文本协议" htmlFor="llm-connection-format">
        <select
          id="llm-connection-format"
          className={habitatConfigSelectClassName}
          value={coerceString(entry.text_protocol ?? LLM_FORMAT_OPENAI_COMPATIBLE)}
          onChange={(e) => patch({ text_protocol: e.target.value })}
        >
          {LLM_SETTINGS_FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}（{f.code}）
            </option>
          ))}
        </select>
      </LabelControlRow>
    ) : isCustom && kind === "image" ? (
      <LabelControlRow label="文生图协议" htmlFor="llm-connection-image-protocol">
        <select
          id="llm-connection-image-protocol"
          className={habitatConfigSelectClassName}
          value={coerceString(entry.image_protocol ?? "openai_images")}
          onChange={(e) => patch({ image_protocol: e.target.value })}
        >
          {LLM_SETTINGS_GENERIC_IMAGE_PROTOCOLS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}（{f.code}）
            </option>
          ))}
        </select>
      </LabelControlRow>
    ) : isCustom && kind === "embeddings" ? (
      <LabelControlRow label="向量协议" htmlFor="llm-connection-embeddings-protocol">
        <select
          id="llm-connection-embeddings-protocol"
          className={habitatConfigSelectClassName}
          value={coerceString(entry.embeddings_protocol ?? "openai_embeddings")}
          onChange={(e) => patch({ embeddings_protocol: e.target.value })}
        >
          {LLM_SETTINGS_GENERIC_EMBEDDINGS_PROTOCOLS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}（{f.code}）
            </option>
          ))}
        </select>
      </LabelControlRow>
    ) : isCustom && kind === "audio" ? (
      <LabelControlRow label="语音协议" htmlFor="llm-connection-audio-protocol">
        <select
          id="llm-connection-audio-protocol"
          className={habitatConfigSelectClassName}
          value={coerceString(entry.audio_protocol ?? "openai_audio_speech")}
          onChange={(e) => {
            const audio_protocol = e.target.value;
            patch({
              audio_protocol,
              ...(audio_protocol === AUDIO_PROTOCOL_EDGE_TTS && !coerceString(entry.base_url)
                ? { base_url: DEFAULT_EDGE_TTS_BASE_URL }
                : {}),
            });
          }}
        >
          {LLM_SETTINGS_GENERIC_AUDIO_PROTOCOLS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}（{f.code}）
            </option>
          ))}
        </select>
      </LabelControlRow>
    ) : isCustom && kind === "video" ? (
      <p className="text-xs text-muted-foreground">
        视频层目前只保存连接（URL / 密钥）；协议可空，不会接入调用。
      </p>
    ) : null;

  const identityFields = (
    <>
      {hubConfigTextField("显示名称", coerceString(entry.title ?? ""), (v) =>
        patch({ title: v.trim() ? v : undefined }),
      )}
      <div className="space-y-1">
        <Label className="text-sm">连接 id</Label>
        <p className="font-mono text-xs text-muted-foreground">{connectionId}</p>
      </div>
    </>
  );

  const builtinAlerts = (
    <>
      {isGateway ? (
        <StatusAlert variant="info">
          多格式对话网关：同一连接按模型自动选择 Chat Completions / Responses /
          Messages。文生图/向量/语音由预设声明（本预设为无）。
        </StatusAlert>
      ) : null}
      {isAlibabaTokenPlan ? (
        <StatusAlert variant="info">
          本预设使用厂商协议（对话 / 文生图 / 语音合成），不必是 OpenAI 封装。Anthropic Messages
          在另一 API 根（{ALIBABA_TOKEN_PLAN_ANTHROPIC_BASE_URL}），请另建「自定义」文本连接并选
          Messages。
        </StatusAlert>
      ) : null}
      {presetModalitySuiteSummary(preset) ? (
        <div className="space-y-1">
          <Label className="text-sm">协议套件</Label>
          <p className="text-xs text-muted-foreground">{presetModalitySuiteSummary(preset)}</p>
          <p className="text-xs text-muted-foreground">
            内置预设已定好各模态协议；改协议请选「自定义」。
          </p>
        </div>
      ) : null}
    </>
  );

  const endpointFields = (
    <>
      {isCustom || allowsBaseUrlOverride ? (
        hubConfigTextField(
          "Base URL",
          coerceString(entry.base_url ?? ""),
          (v) => patch({ base_url: v || undefined }),
          {
            hint: isEdgeVoice
              ? `Edge TTS 服务根或反代；留空则用 ${DEFAULT_EDGE_TTS_BASE_URL}。密钥可空。`
              : allowsBaseUrlOverride
                ? `自建 API 根（须含 /v1）；留空则用默认 ${defaultUrl ?? ""}`
                : "API 根（含 /v1 等前缀，勿写到具体 operation 端点）",
            placeholder: isEdgeVoice ? DEFAULT_EDGE_TTS_BASE_URL : (defaultUrl ?? "https://…"),
          },
        )
      ) : (
        <div className="space-y-1">
          <Label className="text-sm">Base URL</Label>
          <p className="break-all font-mono text-xs text-muted-foreground">
            {defaultUrl ?? "（预设未声明）"}
          </p>
          <p className="text-xs text-muted-foreground">
            云厂商预设固定 API 根，不可改；自建请选 Ollama 或「自定义」。
          </p>
        </div>
      )}
      {hubConfigVaultField(
        "API 密钥",
        coerceString(entry.api_key ?? ""),
        (v) => patch({ api_key: v }),
        {
          hint: isEdgeVoice
            ? "Edge TTS 通常无需密钥；可留空"
            : allowsBaseUrlOverride
              ? "Ollama 本地通常无鉴权，可填占位如 ollama；或 vault(…) / env(…)"
              : "明文，或 vault(…) / env(…)；推荐从 Vault 选择写入引用",
        },
      )}
      <TimeoutAdvancedFields entry={entry} patch={patch} />
    </>
  );

  const probeFields = (
    <div className="space-y-4">
      {connectionId.trim() ? (
        <HabitatConfigConnectionTestButton
          service="llm_provider"
          providerId={connectionId.trim()}
          config={entry}
          disabled={testDisabled ?? false}
        />
      ) : (
        <HabitatConfigConnectionTestButton
          service="llm_provider"
          config={entry}
          disabled={testDisabled ?? false}
        />
      )}
      <LlmConnectionModelsTable providerId={connectionId} disabled={testDisabled ?? false} />
    </div>
  );

  if (isCustom) {
    return (
      <div className="space-y-4">
        <FormGroupCard title="能力">
          {presetField}
          {kindField}
          {protocolField}
        </FormGroupCard>
        <FormGroupCard title="接入">
          {identityFields}
          {endpointFields}
        </FormGroupCard>
        <FormGroupCard title="探测">{probeFields}</FormGroupCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {presetField}
      {kindField}
      {identityFields}
      {builtinAlerts}
      {endpointFields}
      {probeFields}
    </div>
  );
}

function connectionModalityProtocol(
  entry: Record<string, unknown> | undefined,
  kind: "image" | "embeddings" | "audio",
): string | null {
  if (!entry) return null;
  const modalities = effectiveProviderModalities(entry);
  const proto =
    kind === "image"
      ? modalities.image_protocol
      : kind === "embeddings"
        ? modalities.embeddings_protocol
        : modalities.audio_protocol;
  return typeof proto === "string" && proto.length > 0 ? proto : null;
}

function layerForPurpose(purposeId: string): ConnectionLayerId {
  if (purposeId === "image_generate") return "image";
  if (purposeId === "embedding") return "embeddings";
  if (purposeId === "video_generate") return "video";
  if (purposeId === "voice_generate" || purposeId === "tts" || purposeId === "voice_realtime") {
    return "audio";
  }
  return "text";
}

function modelPurposeForScene(
  purposeId: string,
): "chat" | "image_generate" | "embedding" | "voice_generate" | undefined {
  if (purposeId === "image_generate") return "image_generate";
  if (purposeId === "embedding") return "embedding";
  if (purposeId === "voice_generate" || purposeId === "tts" || purposeId === "voice_realtime") {
    return "voice_generate";
  }
  if (purposeId === "video_generate") return undefined;
  // 文本主场景 / summary / reflect / goal_judge / skill_review
  return "chat";
}

function SceneConnectionModelFields({
  fieldId,
  purposeId,
  value,
  connectionIds,
  connectionLabels,
  providersById,
  onChange,
  disabled,
}: {
  fieldId: string;
  purposeId: string;
  value: SceneBindingDraft;
  connectionIds: string[];
  connectionLabels: Record<string, string>;
  providersById: Record<string, Record<string, unknown>>;
  onChange: (next: SceneBindingDraft) => void;
  disabled?: boolean;
}): ReactNode {
  const modelPurpose = modelPurposeForScene(purposeId);
  const isVoiceScene =
    purposeId === "voice_generate" || purposeId === "tts" || purposeId === "voice_realtime";
  const voiceProtocol = isVoiceScene
    ? connectionModalityProtocol(providersById[value.connection], "audio")
    : null;
  const splitVoice = voiceProtocolSeparatesModelAndVoice(voiceProtocol);

  return (
    <div className={`space-y-3 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      <ConnectionSelect
        id={`${fieldId}-connection`}
        value={value.connection}
        connectionIds={connectionIds}
        connectionLabels={connectionLabels}
        onChange={(connection) => onChange({ connection, model: "" })}
      />
      {isVoiceScene && voiceProtocol === AUDIO_PROTOCOL_EDGE_TTS ? (
        <LabelControlRow label="音色" htmlFor={`${fieldId}-voice`}>
          <LlmVoicePicker
            id={`${fieldId}-voice`}
            hideLabel
            providerId={value.connection}
            value={value.model}
            onChange={(model) => onChange({ ...value, model })}
          />
        </LabelControlRow>
      ) : (
        <LabelControlRow label="模型" htmlFor={`${fieldId}-model`}>
          <LlmModelPicker
            id={`${fieldId}-model`}
            hideLabel
            providerId={value.connection}
            value={value.model}
            onChange={(model) => onChange({ ...value, model })}
            {...(modelPurpose ? { purpose: modelPurpose } : {})}
          />
        </LabelControlRow>
      )}
      {isVoiceScene && splitVoice ? (
        <LabelControlRow label="音色" htmlFor={`${fieldId}-split-voice`}>
          <LlmVoicePicker
            id={`${fieldId}-split-voice`}
            hideLabel
            providerId={value.connection}
            model={value.model}
            value={sceneDraftVoice(value)}
            onChange={(voice) => onChange(withSceneDraftVoice(value, voice))}
          />
        </LabelControlRow>
      ) : null}
    </div>
  );
}

/** 能力层：主场景 + 可选子场景（省略 = 同 main） */
export function LlmSystemScenesPanel({
  purposeFocus,
  scenesDraft,
  onSceneChange,
  connectionIds,
  connectionLabels,
  providersById = {},
}: {
  purposeFocus: CapabilityPanelFocus;
  scenesDraft: Record<string, SceneBindingDraft | null>;
  onSceneChange: (purposeId: string, value: SceneBindingDraft | null) => void;
  connectionIds: string[];
  connectionLabels: Record<string, string>;
  providersById?: Record<string, Record<string, unknown>>;
}): ReactNode {
  const purposeRows = purposeRowsForFocus(purposeFocus);
  const mainRow = purposeRows[0];
  if (!mainRow) return null;
  const subsystemRows = purposeRows.slice(1);
  const mainDraft = scenesDraft[mainRow.id] ?? { connection: "", model: "" };
  const idsFor = (purposeId: string) =>
    connectionIdsForLayer(layerForPurpose(purposeId), connectionIds, providersById);

  const mainHint =
    purposeFocus === "text_generate"
      ? "日常对话默认的连接与模型；子用途选「同主场景」时回退到这里。"
      : purposeFocus === "audio_generate"
        ? "文生声所用连接、合成模型与音色。Edge 音色写在模型字段；OpenAI / 阿里音色单独选择。"
        : purposeFocus === "video_generate"
          ? "仅保存配置，本轮不接入工具与引擎。"
          : "所用连接与模型。";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">主场景</p>
          <p className="text-xs text-muted-foreground">{mainHint}</p>
        </div>
        <SceneConnectionModelFields
          fieldId="capability-main-scene"
          purposeId={mainRow.id}
          value={mainDraft}
          connectionIds={idsFor(mainRow.id)}
          connectionLabels={connectionLabels}
          providersById={providersById}
          onChange={(v) => onSceneChange(mainRow.id, v)}
        />
        {idsFor(mainRow.id).length === 0 && connectionIds.length > 0 ? (
          <StatusAlert variant="info">
            {purposeFocus === "image_generate"
              ? "没有带图片协议的连接。请先在「连接」中新建图片层连接，或使用带文生图套件的内置预设。"
              : purposeFocus === "audio_generate"
                ? "没有带语音协议的连接。请先在「连接」中新建音频层连接，或使用带语音套件的内置预设。"
                : purposeFocus === "embedding"
                  ? "没有带向量协议的连接。请先在「连接」中新建嵌入层连接，或使用带向量套件的内置预设。"
                  : purposeFocus === "video_generate"
                    ? "没有视频层连接。请先在「连接」中新建自定义视频连接。"
                    : "请先在「连接」中创建文本层连接。"}
          </StatusAlert>
        ) : null}
      </div>

      {subsystemRows.length > 0 ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">系统子场景</p>
            <p className="text-xs text-muted-foreground">可单独指定连接与模型，或与主场景相同。</p>
          </div>
          {subsystemRows.map((row) => {
            const binding = scenesDraft[row.id];
            const inherit = binding == null;
            return (
              <div key={row.id} className="space-y-2">
                <LabelControlRow label={row.label} htmlFor={`capability-purpose-mode-${row.id}`}>
                  <select
                    id={`capability-purpose-mode-${row.id}`}
                    className={habitatConfigSelectClassName}
                    value={inherit ? "inherit" : "custom"}
                    onChange={(e) => {
                      if (e.target.value === "inherit") {
                        onSceneChange(row.id, null);
                      } else {
                        onSceneChange(row.id, {
                          connection: mainDraft.connection,
                          model: mainDraft.model,
                          ...(mainDraft.params ? { params: mainDraft.params } : {}),
                        });
                      }
                    }}
                  >
                    <option value="inherit">同主场景</option>
                    <option value="custom">单独指定</option>
                  </select>
                </LabelControlRow>
                {!inherit && binding ? (
                  <FormGroupCard>
                    <SceneConnectionModelFields
                      fieldId={`capability-purpose-${row.id}`}
                      purposeId={row.id}
                      value={binding}
                      connectionIds={idsFor(row.id)}
                      connectionLabels={connectionLabels}
                      providersById={providersById}
                      onChange={(v) => onSceneChange(row.id, v)}
                    />
                  </FormGroupCard>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {connectionIds.length === 0 ? (
        <StatusAlert variant="info">请先在「连接」中创建至少一条连接。</StatusAlert>
      ) : null}
    </div>
  );
}

export {
  providersDraftToPatch,
  readProvidersDraft,
  llmEntryTitle,
  emptyConnectionEntry,
} from "./llm-settings-draft.ts";

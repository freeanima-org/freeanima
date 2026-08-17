import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@freeanima/ui-kit";
import { Label } from "@freeanima/ui-kit/components/ui";
import { StatusAlert } from "@freeanima/ui-kit/composite";
import {
  habitatConfigNumberField,
  habitatConfigSelectClassName,
  hubConfigTextField,
} from "./habitat-config-field-helpers.tsx";
import { LlmModelPicker } from "./LlmModelPicker.tsx";
import { hubConfigVaultField } from "./habitat-config-vault-field.tsx";
import { HabitatConfigConnectionTestButton } from "./HabitatConfigConnectionTestButton.tsx";
import { LlmConnectionModelsTable } from "./LlmConnectionModelsTable.tsx";
import {
  connectionDefaultBaseUrl,
  LLM_SETTINGS_FORMATS,
  LLM_SETTINGS_PRESETS,
  LLM_SETTINGS_IMAGE_PROTOCOLS,
  LLM_SETTINGS_EMBEDDINGS_PROTOCOLS,
  LLM_SETTINGS_VOICE_PROTOCOLS,
  applyPresetToConnectionEntry,
  presetModalitySuiteSummary,
  purposeRowsForFocus,
  readChain,
  readTimeoutDraft,
  validateTimeoutDraft,
  type RouteHop,
  type SceneBindingDraft,
  type TimeoutDraft,
} from "./llm-settings-draft.ts";
import { coerceString } from "@freeanima/shared/coerce-string";
import {
  DEFAULT_EDGE_TTS_BASE_URL,
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_PRESET_ALIBABA_TOKEN_PLAN,
  LLM_PRESET_CUSTOM,
  LLM_PRESET_OPENCODE_GO,
  VOICE_PROTOCOL_EDGE_TTS,
} from "@freeanima/habitat/core/config";
import { ALIBABA_TOKEN_PLAN_ANTHROPIC_BASE_URL } from "@freeanima/habitat/core/llm/presets";

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
    <div className="space-y-1">
      {id !== undefined ? (
        <Label className="text-sm" htmlFor={id}>
          连接
        </Label>
      ) : (
        <Label className="text-sm">连接</Label>
      )}
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
        <p className="text-xs text-muted-foreground">请先在「连接」页添加连接。</p>
      ) : null}
    </div>
  );
}

/** 单跳路由（已取消多跳备用） */
function LlmChainEditor({
  chain,
  connectionIds,
  connectionLabels,
  onChange,
}: {
  chain: RouteHop[];
  connectionIds: string[];
  connectionLabels?: Record<string, string>;
  onChange: (chain: RouteHop[]) => void;
}) {
  const primary = chain[0] ?? { provider: "", model: "" };

  const patchPrimary = (part: Partial<RouteHop>) => {
    let next: RouteHop = { ...primary, ...part };
    if ("params" in part && part.params === undefined) {
      const { params: _omit, ...rest } = next;
      void _omit;
      next = rest;
    }
    onChange([next]);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">路由</p>
        <p className="text-xs text-muted-foreground">选择连接与模型。</p>
      </div>
      <div className="space-y-3 rounded-md border p-3">
        <ConnectionSelect
          id="llm-hop-conn-0"
          value={primary.provider}
          connectionIds={connectionIds}
          {...(connectionLabels ? { connectionLabels } : {})}
          onChange={(provider) => patchPrimary({ provider, model: "" })}
        />
        <LlmModelPicker
          providerId={primary.provider}
          value={primary.model}
          onChange={(model) => patchPrimary({ model })}
        />
      </div>
    </div>
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
    return t.timeout_ms !== "" || t.first_byte_timeout_ms !== "" || t.idle_timeout_ms !== "";
  });
  const draft = readTimeoutDraft(entry);
  const error = validateTimeoutDraft(draft);

  const commit = (next: TimeoutDraft) => {
    patch({
      timeout_ms: next.timeout_ms === "" ? undefined : next.timeout_ms,
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
            单位毫秒；首字节 / 空闲须 ≤ 整体。留空使用服务端默认。
          </p>
          {habitatConfigNumberField(
            "整体超时",
            draft.timeout_ms,
            (timeout_ms) => commit({ ...draft, timeout_ms }),
            { hint: "默认 600000（10 分钟）" },
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

/** 连接编辑表单（放在 ModalSheetPresent 内） */
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
  const defaultUrl = connectionDefaultBaseUrl(preset);
  const isEdgeVoice = coerceString(entry.voice_protocol ?? "") === VOICE_PROTOCOL_EDGE_TTS;

  const patch = (part: Record<string, unknown>) => {
    onChange({ ...entry, ...part });
  };

  return (
    <div className="space-y-4">
      {hubConfigTextField("显示名称", coerceString(entry.title ?? ""), (v) =>
        patch({ title: v.trim() ? v : undefined }),
      )}
      <div className="space-y-1">
        <Label className="text-sm">连接 id</Label>
        <p className="font-mono text-xs text-muted-foreground">{connectionId}</p>
      </div>

      <div className="space-y-1">
        <Label className="text-sm" htmlFor="llm-connection-preset">
          预设
        </Label>
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
      </div>

      {isGateway ? (
        <StatusAlert variant="info">
          多格式对话网关：同一连接按模型自动选择 Chat Completions / Responses /
          Messages。文生图/向量/语音由预设声明（本预设为无）。
        </StatusAlert>
      ) : null}

      {isAlibabaTokenPlan ? (
        <StatusAlert variant="info">
          本预设使用 OpenAI 兼容根（对话 / 文生图）。Anthropic Messages 在另一 API 根（
          {ALIBABA_TOKEN_PLAN_ANTHROPIC_BASE_URL}
          ），请另建「自定义」连接并选 Messages。模型名从上游目录拉取，不写死在预设里。
        </StatusAlert>
      ) : null}

      {!isCustom && presetModalitySuiteSummary(preset) ? (
        <div className="space-y-1">
          <Label className="text-sm">协议套件</Label>
          <p className="text-xs text-muted-foreground">{presetModalitySuiteSummary(preset)}</p>
          <p className="text-xs text-muted-foreground">
            内置预设已定好各模态协议；改协议请选「自定义」。
          </p>
        </div>
      ) : null}

      {isCustom ? (
        <>
          <div className="space-y-1">
            <Label className="text-sm" htmlFor="llm-connection-format">
              文本协议
            </Label>
            <select
              id="llm-connection-format"
              className={habitatConfigSelectClassName}
              value={coerceString(entry.format ?? LLM_FORMAT_OPENAI_COMPATIBLE)}
              onChange={(e) => patch({ format: e.target.value, text_protocol: e.target.value })}
            >
              {LLM_SETTINGS_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}（{f.code}）
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm" htmlFor="llm-connection-image-protocol">
              文生图协议
            </Label>
            <select
              id="llm-connection-image-protocol"
              className={habitatConfigSelectClassName}
              value={coerceString(entry.image_protocol ?? "")}
              onChange={(e) => patch({ image_protocol: e.target.value ? e.target.value : null })}
            >
              {LLM_SETTINGS_IMAGE_PROTOCOLS.map((f) => (
                <option key={f.id || "none"} value={f.id}>
                  {f.label}
                  {"code" in f && f.code ? `（${f.code}）` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm" htmlFor="llm-connection-embeddings-protocol">
              向量协议
            </Label>
            <select
              id="llm-connection-embeddings-protocol"
              className={habitatConfigSelectClassName}
              value={coerceString(entry.embeddings_protocol ?? "")}
              onChange={(e) =>
                patch({ embeddings_protocol: e.target.value ? e.target.value : null })
              }
            >
              {LLM_SETTINGS_EMBEDDINGS_PROTOCOLS.map((f) => (
                <option key={f.id || "none"} value={f.id}>
                  {f.label}
                  {"code" in f && f.code ? `（${f.code}）` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm" htmlFor="llm-connection-voice-protocol">
              语音协议
            </Label>
            <select
              id="llm-connection-voice-protocol"
              className={habitatConfigSelectClassName}
              value={coerceString(entry.voice_protocol ?? "")}
              onChange={(e) => patch({ voice_protocol: e.target.value ? e.target.value : null })}
            >
              {LLM_SETTINGS_VOICE_PROTOCOLS.map((f) => (
                <option key={f.id || "none"} value={f.id}>
                  {f.label}
                  {"code" in f && f.code ? `（${f.code}）` : ""}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      {isCustom || isEdgeVoice ? (
        hubConfigTextField(
          "Base URL",
          coerceString(entry.base_url ?? ""),
          (v) => patch({ base_url: v || undefined }),
          {
            hint: isEdgeVoice
              ? `Edge TTS 服务根或反代；留空则用 ${DEFAULT_EDGE_TTS_BASE_URL}。密钥可空。`
              : "API 根（含 /v1 等前缀，勿写到具体 operation 端点）",
            placeholder: isEdgeVoice ? DEFAULT_EDGE_TTS_BASE_URL : "https://…",
          },
        )
      ) : (
        <div className="space-y-1">
          <Label className="text-sm">Base URL</Label>
          <p className="break-all font-mono text-xs text-muted-foreground">
            {defaultUrl ?? "（预设未声明）"}
          </p>
          <p className="text-xs text-muted-foreground">
            内置预设固定 API 根，不可改；反代或自建请选「自定义」。
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
            : "明文，或 vault(…) / env(…)；推荐从 Vault 选择写入引用",
        },
      )}

      <TimeoutAdvancedFields entry={entry} patch={patch} />

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
    </div>
  );
}

/** 方案（profile）编辑表单 */
export function LlmSceneEditorForm({
  sceneId,
  entry,
  connectionIds,
  connectionLabels,
  onChange,
}: {
  sceneId: string;
  entry: Record<string, unknown>;
  connectionIds: string[];
  connectionLabels?: Record<string, string>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const patch = (part: Record<string, unknown>) => onChange({ ...entry, ...part });

  return (
    <div className="space-y-4">
      {hubConfigTextField("显示名称", coerceString(entry.title ?? ""), (v) =>
        patch({ title: v.trim() ? v : undefined }),
      )}
      <div className="space-y-1">
        <Label className="text-sm">方案 id</Label>
        <p className="font-mono text-xs text-muted-foreground">{sceneId}</p>
      </div>
      <LlmChainEditor
        chain={readChain(entry.chain)}
        connectionIds={connectionIds}
        {...(connectionLabels ? { connectionLabels } : {})}
        onChange={(chain) => patch({ chain })}
      />
    </div>
  );
}

function connectionIdsForScenePurpose(
  purposeId: string,
  connectionIds: string[],
  providersById: Record<string, Record<string, unknown>>,
): string[] {
  if (purposeId === "image_generate") {
    return connectionIds.filter((id) => {
      const proto = providersById[id]?.image_protocol;
      return typeof proto === "string" && proto.length > 0;
    });
  }
  if (purposeId === "embedding") {
    return connectionIds.filter((id) => {
      const proto = providersById[id]?.embeddings_protocol;
      return typeof proto === "string" && proto.length > 0;
    });
  }
  if (purposeId === "voice_generate" || purposeId === "tts" || purposeId === "voice_realtime") {
    return connectionIds.filter((id) => {
      const proto = providersById[id]?.voice_protocol;
      return typeof proto === "string" && proto.length > 0;
    });
  }
  return connectionIds;
}

function modelPurposeForScene(
  purposeId: string,
): "chat" | "image_generate" | "embedding" | "voice_generate" | undefined {
  if (purposeId === "image_generate") return "image_generate";
  if (purposeId === "embedding") return "embedding";
  if (purposeId === "voice_generate" || purposeId === "tts" || purposeId === "voice_realtime") {
    return "voice_generate";
  }
  return undefined;
}

function SceneConnectionModelFields({
  fieldId,
  purposeId,
  value,
  connectionIds,
  connectionLabels,
  onChange,
  disabled,
}: {
  fieldId: string;
  purposeId: string;
  value: SceneBindingDraft;
  connectionIds: string[];
  connectionLabels: Record<string, string>;
  onChange: (next: SceneBindingDraft) => void;
  disabled?: boolean;
}): ReactNode {
  const modelPurpose = modelPurposeForScene(purposeId);
  return (
    <div className={`space-y-3 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      <ConnectionSelect
        id={`${fieldId}-connection`}
        value={value.connection}
        connectionIds={connectionIds}
        connectionLabels={connectionLabels}
        onChange={(connection) => onChange({ connection, model: "" })}
      />
      <LlmModelPicker
        providerId={value.connection}
        value={value.model}
        onChange={(model) => onChange({ ...value, model })}
        {...(modelPurpose ? { purpose: modelPurpose } : {})}
      />
    </div>
  );
}

/** 场景：直接选连接+模型，写入 llm.scenes（不再经「方案」） */
export function LlmSystemScenesPanel({
  purposeFocus = "all",
  scenesDraft,
  onSceneChange,
  connectionIds,
  connectionLabels,
  providersById = {},
}: {
  purposeFocus?: "connections" | "dialogue" | "image_gen" | "retrieval" | "voice" | "all";
  scenesDraft: Record<string, SceneBindingDraft | null>;
  onSceneChange: (purposeId: string, value: SceneBindingDraft | null) => void;
  connectionIds: string[];
  connectionLabels: Record<string, string>;
  /** 用于按协议过滤连接（图片 / 向量） */
  providersById?: Record<string, Record<string, unknown>>;
}): ReactNode {
  const purposeRows = purposeRowsForFocus(purposeFocus);
  const showDialogueMain = purposeFocus === "all" || purposeFocus === "dialogue";
  const capabilityMainPurpose =
    purposeFocus === "image_gen"
      ? "image_generate"
      : purposeFocus === "retrieval"
        ? "embedding"
        : purposeFocus === "voice"
          ? "voice_generate"
          : null;
  const capabilityMainRow = capabilityMainPurpose
    ? purposeRows.find((r) => r.id === capabilityMainPurpose)
    : null;
  const subsystemRows = capabilityMainPurpose
    ? purposeRows.filter((r) => r.id !== capabilityMainPurpose)
    : showDialogueMain
      ? purposeRows.filter((r) => r.id !== "chat")
      : purposeRows;

  const chatDraft = scenesDraft.chat ?? { connection: "", model: "" };
  const mainFallbackDraft =
    capabilityMainRow != null
      ? (scenesDraft[capabilityMainRow.id] ?? { connection: "", model: "" })
      : chatDraft;

  const idsFor = (purposeId: string) =>
    connectionIdsForScenePurpose(purposeId, connectionIds, providersById);

  return (
    <div className="space-y-6">
      {showDialogueMain ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">主场景</p>
            <p className="text-xs text-muted-foreground">
              日常对话默认的连接与模型；子用途选「同主场景」时回退到这里。
            </p>
          </div>
          <SceneConnectionModelFields
            fieldId="llm-main-scene"
            purposeId="chat"
            value={chatDraft}
            connectionIds={idsFor("chat")}
            connectionLabels={connectionLabels}
            onChange={(v) => onSceneChange("chat", v)}
          />
        </div>
      ) : null}

      {capabilityMainRow ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">主场景</p>
            <p className="text-xs text-muted-foreground">
              {capabilityMainRow.label}
              所用连接与模型；与对话主场景相互独立。
            </p>
          </div>
          <SceneConnectionModelFields
            fieldId={`llm-purpose-main-${capabilityMainRow.id}`}
            purposeId={capabilityMainRow.id}
            value={mainFallbackDraft}
            connectionIds={idsFor(capabilityMainRow.id)}
            connectionLabels={connectionLabels}
            onChange={(v) => onSceneChange(capabilityMainRow.id, v)}
          />
          {idsFor(capabilityMainRow.id).length === 0 && connectionIds.length > 0 ? (
            <StatusAlert variant="info">
              {capabilityMainRow.id === "image_generate"
                ? "没有带图片协议的连接。请先在「连接」中为连接启用文生图协议（如 openai_images）。"
                : capabilityMainRow.id === "voice_generate"
                  ? "没有带语音协议的连接。请先在「连接」中启用 voice_protocol（edge-tts / openai_audio_speech / alibaba_audio）。"
                  : "没有带向量协议的连接。请先在「连接」中启用 embeddings 协议。"}
            </StatusAlert>
          ) : null}
        </div>
      ) : null}

      {subsystemRows.length > 0 ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">系统子场景</p>
            <p className="text-xs text-muted-foreground">可单独指定连接与模型，或与主场景相同。</p>
          </div>
          {subsystemRows.map((row) => {
            const binding = scenesDraft[row.id];
            const inherit = binding == null;
            return (
              <div key={row.id} className="space-y-2 rounded-md border border-border/60 p-3">
                <div className="space-y-1">
                  <Label className="text-sm" htmlFor={`llm-purpose-mode-${row.id}`}>
                    {row.label}
                  </Label>
                  <select
                    id={`llm-purpose-mode-${row.id}`}
                    className={habitatConfigSelectClassName}
                    value={inherit ? "inherit" : "custom"}
                    onChange={(e) => {
                      if (e.target.value === "inherit") {
                        onSceneChange(row.id, null);
                      } else {
                        onSceneChange(row.id, {
                          connection: mainFallbackDraft.connection,
                          model: mainFallbackDraft.model,
                        });
                      }
                    }}
                  >
                    <option value="inherit">同主场景</option>
                    <option value="custom">单独指定</option>
                  </select>
                </div>
                {!inherit && binding ? (
                  <SceneConnectionModelFields
                    fieldId={`llm-purpose-${row.id}`}
                    purposeId={row.id}
                    value={binding}
                    connectionIds={idsFor(row.id)}
                    connectionLabels={connectionLabels}
                    onChange={(v) => onSceneChange(row.id, v)}
                  />
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
  profilesDraftToPatch,
  sceneListSubtitle,
  llmEntryTitle,
  systemPurposeSelectValue,
} from "./llm-settings-draft.ts";

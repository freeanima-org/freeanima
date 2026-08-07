import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Textarea } from "@freeanima/ui-kit";
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
import {
  callParamsDraftToValue,
  connectionDefaultBaseUrl,
  LLM_SETTINGS_FORMATS,
  LLM_SETTINGS_PRESETS,
  readCallParamsDraft,
  readChain,
  readTimeoutDraft,
  validateTimeoutDraft,
  type CallParamsDraft,
  type RouteHop,
  type TimeoutDraft,
} from "./llm-settings-draft.ts";
import {
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_PRESET_CUSTOM,
  LLM_PRESET_OPENCODE_GO,
} from "@freeanima/host/core/config";

function LlmCallParamsEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: unknown;
  onChange: (params: Record<string, unknown> | undefined) => void;
}) {
  const [draft, setDraft] = useState<CallParamsDraft>(() => readCallParamsDraft(value));
  const skipSyncRef = useRef(false);
  const valueKey = useMemo(() => {
    try {
      return JSON.stringify(value ?? null);
    } catch {
      return "";
    }
  }, [value]);

  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    setDraft(readCallParamsDraft(value));
  }, [value, valueKey]);

  const commit = (next: CallParamsDraft) => {
    setDraft(next);
    skipSyncRef.current = true;
    onChange(callParamsDraftToValue(next));
  };

  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">
        留空表示不覆盖；仅 temperature / topP / 输出上限 / stop。
      </p>
      {habitatConfigNumberField("温度 temperature", draft.temperature, (temperature) =>
        commit({ ...draft, temperature }),
      )}
      {habitatConfigNumberField("topP", draft.topP, (topP) => commit({ ...draft, topP }))}
      {habitatConfigNumberField(
        "输出上限 maxOutputTokens",
        draft.maxOutputTokens,
        (maxOutputTokens) => commit({ ...draft, maxOutputTokens }),
      )}
      <div className="space-y-1">
        <Label className="text-sm">stop（每行一个）</Label>
        <Textarea
          className="w-full font-mono text-xs min-h-16"
          value={draft.stop}
          onChange={(e) => commit({ ...draft, stop: e.target.value })}
        />
      </div>
    </div>
  );
}

function ConnectionSelect({
  value,
  connectionIds,
  onChange,
  id,
}: {
  value: string;
  connectionIds: string[];
  onChange: (id: string) => void;
  id?: string;
}) {
  const missing = value && !connectionIds.includes(value);
  return (
    <div className="space-y-1">
      <Label className="text-sm" htmlFor={id}>
        连接
      </Label>
      <select
        id={id}
        className={habitatConfigSelectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={connectionIds.length === 0 && !missing}
      >
        <option value="">选择连接…</option>
        {missing ? <option value={value}>{value}（已删除）</option> : null}
        {connectionIds.map((cid) => (
          <option key={cid} value={cid}>
            {cid}
          </option>
        ))}
      </select>
      {connectionIds.length === 0 ? (
        <p className="text-xs text-muted-foreground">请先在「连接」页添加连接。</p>
      ) : null}
    </div>
  );
}

function LlmRouteHopEditor({
  hop,
  index,
  connectionIds,
  canRemove,
  onChange,
  onRemove,
}: {
  hop: RouteHop;
  index: number;
  connectionIds: string[];
  canRemove: boolean;
  onChange: (part: Partial<RouteHop>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {index === 0 ? "主路由" : `备用步骤 ${index}`}
        </p>
        {canRemove ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={onRemove}
          >
            删除
          </Button>
        ) : null}
      </div>
      <ConnectionSelect
        id={`llm-hop-conn-${index}`}
        value={hop.provider}
        connectionIds={connectionIds}
        onChange={(provider) => onChange({ provider })}
      />
      <LlmModelPicker
        providerId={hop.provider}
        value={hop.model}
        onChange={(model) => onChange({ model })}
      />
      <LlmCallParamsEditor
        title="本步骤调用参数（可选）"
        value={hop.params}
        onChange={(params) => onChange({ params })}
      />
    </div>
  );
}

function LlmChainEditor({
  chain,
  connectionIds,
  onChange,
}: {
  chain: RouteHop[];
  connectionIds: string[];
  onChange: (chain: RouteHop[]) => void;
}) {
  const hops = chain.length > 0 ? chain : [{ provider: "", model: "" }];
  const [showBackup, setShowBackup] = useState(hops.length > 1);

  const patchHop = (index: number, part: Partial<RouteHop>) => {
    const next = hops.map((hop, i) => {
      if (i !== index) return hop;
      if ("params" in part && part.params === undefined) {
        const { params: _omit, ...rest } = { ...hop, ...part };
        void _omit;
        return rest;
      }
      return { ...hop, ...part };
    });
    onChange(next);
  };

  const addHop = () => {
    setShowBackup(true);
    onChange([...hops, { provider: "", model: "" }]);
  };

  const removeHop = (index: number) => {
    const next = hops.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [{ provider: "", model: "" }]);
  };

  const primary = hops[0] ?? { provider: "", model: "" };
  const backups = hops.slice(1);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">路由</p>
        <p className="text-xs text-muted-foreground">主路由必填；失败时可按顺序尝试备用步骤。</p>
      </div>
      <LlmRouteHopEditor
        hop={primary}
        index={0}
        connectionIds={connectionIds}
        canRemove={false}
        onChange={(part) => patchHop(0, part)}
        onRemove={() => undefined}
      />
      {showBackup || backups.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">备用路由</p>
          {backups.map((hop, i) => (
            <LlmRouteHopEditor
              key={i + 1}
              hop={hop}
              index={i + 1}
              connectionIds={connectionIds}
              canRemove
              onChange={(part) => patchHop(i + 1, part)}
              onRemove={() => removeHop(i + 1)}
            />
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addHop}>
            添加备用步骤
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setShowBackup(true)}>
          配置备用路由…
        </Button>
      )}
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
  idEditable,
  entry,
  onIdChange,
  onChange,
  testDisabled,
}: {
  connectionId: string;
  idEditable: boolean;
  entry: Record<string, unknown>;
  onIdChange: (id: string) => void;
  onChange: (next: Record<string, unknown>) => void;
  testDisabled?: boolean;
}) {
  const preset = String(entry.preset ?? LLM_PRESET_CUSTOM);
  const isCustom = preset === LLM_PRESET_CUSTOM;
  const isGateway = preset === LLM_PRESET_OPENCODE_GO;
  const defaultUrl = connectionDefaultBaseUrl(preset);

  const patch = (part: Record<string, unknown>) => {
    onChange({ ...entry, ...part });
  };

  return (
    <div className="space-y-4">
      {idEditable ? (
        hubConfigTextField("连接 id", connectionId, onIdChange, {
          hint: "配置键，保存后用于场景路由；建议小写字母与连字符",
        })
      ) : (
        <div className="space-y-1">
          <Label className="text-sm">连接 id</Label>
          <p className="font-mono text-sm">{connectionId}</p>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-sm" htmlFor="llm-connection-preset">
          预设
        </Label>
        <select
          id="llm-connection-preset"
          className={habitatConfigSelectClassName}
          value={preset}
          onChange={(e) => {
            const next = e.target.value;
            if (next === LLM_PRESET_CUSTOM) {
              patch({
                preset: next,
                format: entry.format ?? LLM_FORMAT_OPENAI_COMPATIBLE,
              });
            } else {
              const nextEntry: Record<string, unknown> = { ...entry, preset: next };
              delete nextEntry.format;
              onChange(nextEntry);
            }
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
          多格式网关：同一连接按模型自动选择 Chat Completions / Responses / Messages。
        </StatusAlert>
      ) : null}

      {isCustom ? (
        <div className="space-y-1">
          <Label className="text-sm" htmlFor="llm-connection-format">
            格式
          </Label>
          <select
            id="llm-connection-format"
            className={habitatConfigSelectClassName}
            value={String(entry.format ?? LLM_FORMAT_OPENAI_COMPATIBLE)}
            onChange={(e) => patch({ format: e.target.value })}
          >
            {LLM_SETTINGS_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}（{f.code}）
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {hubConfigTextField(
        "Base URL",
        String(entry.base_url ?? ""),
        (v) => patch({ base_url: v || undefined }),
        {
          hint: isCustom
            ? "自定义连接必填"
            : defaultUrl
              ? `可选；留空则使用 ${defaultUrl}`
              : "可选；留空则使用预设默认 URL",
          placeholder: defaultUrl ?? "https://…",
        },
      )}

      {hubConfigVaultField("API 密钥", String(entry.api_key ?? ""), (v) => patch({ api_key: v }), {
        hint: "明文，或 vault(…) / env(…)；推荐从 Vault 选择写入引用",
      })}

      <TimeoutAdvancedFields entry={entry} patch={patch} />

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
    </div>
  );
}

/** 场景编辑表单 */
export function LlmSceneEditorForm({
  sceneId,
  idEditable,
  entry,
  connectionIds,
  onIdChange,
  onChange,
}: {
  sceneId: string;
  idEditable: boolean;
  entry: Record<string, unknown>;
  connectionIds: string[];
  onIdChange: (id: string) => void;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const patch = (part: Record<string, unknown>) => onChange({ ...entry, ...part });

  return (
    <div className="space-y-4">
      {idEditable ? (
        hubConfigTextField("场景 id", sceneId, onIdChange, {
          hint: "例如 chat；调用方按 id 绑定场景",
        })
      ) : (
        <div className="space-y-1">
          <Label className="text-sm">场景 id</Label>
          <p className="font-mono text-sm">{sceneId}</p>
        </div>
      )}
      <LlmChainEditor
        chain={readChain(entry.chain)}
        connectionIds={connectionIds}
        onChange={(chain) => patch({ chain })}
      />
      <LlmCallParamsEditor
        title="场景级调用参数（可选）"
        value={entry.params}
        onChange={(params) => {
          if (params) patch({ params });
          else {
            const next = { ...entry };
            delete next.params;
            onChange(next);
          }
        }}
      />
    </div>
  );
}

export function LlmDefaultSceneForm({
  defaultProfile,
  sceneIds,
  onDefaultProfileChange,
}: {
  defaultProfile: string;
  sceneIds: string[];
  onDefaultProfileChange: (value: string) => void;
}): ReactNode {
  const missing = defaultProfile && !sceneIds.includes(defaultProfile);
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-sm" htmlFor="llm-default-scene">
          默认场景
        </Label>
        <select
          id="llm-default-scene"
          className={habitatConfigSelectClassName}
          value={defaultProfile}
          onChange={(e) => onDefaultProfileChange(e.target.value)}
        >
          <option value="">选择场景…</option>
          {missing ? <option value={defaultProfile}>{defaultProfile}（未在列表中）</option> : null}
          {sceneIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">未指定场景时的回退项。</p>
      </div>
      {sceneIds.length === 0 ? (
        <StatusAlert variant="info">请先在「场景」页创建至少一个场景。</StatusAlert>
      ) : null}
    </div>
  );
}

export {
  providersDraftToPatch,
  readProvidersDraft,
  profilesDraftToPatch,
  sceneListSubtitle,
} from "./llm-settings-draft.ts";

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
import {
  connectionDefaultBaseUrl,
  llmEntryTitle,
  LLM_SETTINGS_FORMATS,
  LLM_SETTINGS_PRESETS,
  LLM_SYSTEM_PURPOSE_ROWS,
  readChain,
  readTimeoutDraft,
  systemPurposeSelectValue,
  validateTimeoutDraft,
  type RouteHop,
  type TimeoutDraft,
} from "./llm-settings-draft.ts";
import { coerceString } from "@freeanima/shared/coerce-string";
import {
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_PRESET_CUSTOM,
  LLM_PRESET_OPENCODE_GO,
} from "@freeanima/habitat/core/config";

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

function LlmRouteHopEditor({
  hop,
  index,
  connectionIds,
  connectionLabels,
  canRemove,
  onChange,
  onRemove,
}: {
  hop: RouteHop;
  index: number;
  connectionIds: string[];
  connectionLabels?: Record<string, string>;
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
        {...(connectionLabels ? { connectionLabels } : {})}
        onChange={(provider) => onChange({ provider })}
      />
      <LlmModelPicker
        providerId={hop.provider}
        value={hop.model}
        onChange={(model) => onChange({ model })}
      />
    </div>
  );
}

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
        {...(connectionLabels ? { connectionLabels } : {})}
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
              {...(connectionLabels ? { connectionLabels } : {})}
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
  const defaultUrl = connectionDefaultBaseUrl(preset);

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
            value={coerceString(entry.format ?? LLM_FORMAT_OPENAI_COMPATIBLE)}
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
        coerceString(entry.base_url ?? ""),
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

      {hubConfigVaultField(
        "API 密钥",
        coerceString(entry.api_key ?? ""),
        (v) => patch({ api_key: v }),
        {
          hint: "明文，或 vault(…) / env(…)；推荐从 Vault 选择写入引用",
        },
      )}

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

function ProfileSelectOptions({
  profileIds,
  profiles,
  includeEmpty,
  emptyLabel,
  missingId,
}: {
  profileIds: string[];
  profiles: Record<string, Record<string, unknown>>;
  includeEmpty?: boolean;
  emptyLabel?: string;
  missingId?: string;
}): ReactNode {
  return (
    <>
      {includeEmpty ? <option value="">{emptyLabel ?? "同主场景"}</option> : null}
      {missingId && !profileIds.includes(missingId) ? (
        <option value={missingId}>{missingId}（未在列表中）</option>
      ) : null}
      {profileIds.map((id) => (
        <option key={id} value={id}>
          {llmEntryTitle(id, profiles[id])}
        </option>
      ))}
    </>
  );
}

/** 场景 Tab：主场景 + 系统子场景用途指派 */
export function LlmSystemScenesPanel({
  defaultProfile,
  profileIds,
  profiles,
  bindings,
  onDefaultProfileChange,
  onBindingChange,
}: {
  defaultProfile: string;
  profileIds: string[];
  profiles: Record<string, Record<string, unknown>>;
  bindings: Record<string, string | null>;
  onDefaultProfileChange: (value: string) => void;
  onBindingChange: (purposeId: string, value: string) => void;
}): ReactNode {
  const missingDefault = defaultProfile && !profileIds.includes(defaultProfile);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Label className="text-sm" htmlFor="llm-main-scene">
          主场景
        </Label>
        <select
          id="llm-main-scene"
          className={habitatConfigSelectClassName}
          value={defaultProfile}
          onChange={(e) => onDefaultProfileChange(e.target.value)}
        >
          <option value="">选择方案…</option>
          <ProfileSelectOptions
            profileIds={profileIds}
            profiles={profiles}
            {...(missingDefault ? { missingId: defaultProfile } : {})}
          />
        </select>
        <p className="text-xs text-muted-foreground">
          未指定用途或用途选「同主场景」时的回退方案。
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">系统子场景</p>
          <p className="text-xs text-muted-foreground">
            各用途可单独指定方案；「同主场景」表示与主场景相同。
          </p>
        </div>
        {LLM_SYSTEM_PURPOSE_ROWS.map((row) => {
          const value = systemPurposeSelectValue(row.id, bindings, profiles);
          const missing = value !== "" && !profileIds.includes(value);
          return (
            <div key={row.id} className="space-y-1">
              <Label className="text-sm" htmlFor={`llm-purpose-${row.id}`}>
                {row.label}
              </Label>
              <select
                id={`llm-purpose-${row.id}`}
                className={habitatConfigSelectClassName}
                value={value}
                onChange={(e) => onBindingChange(row.id, e.target.value)}
              >
                <ProfileSelectOptions
                  profileIds={profileIds}
                  profiles={profiles}
                  includeEmpty
                  emptyLabel="同主场景"
                  {...(missing ? { missingId: value } : {})}
                />
              </select>
            </div>
          );
        })}
      </div>

      {profileIds.length === 0 ? (
        <StatusAlert variant="info">请先在「自定义」页创建至少一个方案。</StatusAlert>
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

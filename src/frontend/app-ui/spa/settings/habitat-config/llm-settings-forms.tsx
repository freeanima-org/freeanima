import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Textarea } from "@freeanima/frontend/ui-kit";
import { Label } from "@freeanima/frontend/ui-kit/components/ui";
import {
  HabitatConfigRecordEntryEditor,
  habitatConfigNumberField,
  habitatConfigSelectClassName,
  hubConfigTextField,
  readHabitatConfigRecord,
} from "./habitat-config-field-helpers.tsx";
import { HabitatConfigConnectionTestButton } from "./HabitatConfigConnectionTestButton.tsx";

const OPENAI_COMPATIBLE_BACKEND_ID = "openai_compatible";

type RouteHop = {
  provider: string;
  model: string;
  params?: Record<string, unknown> | undefined;
};

type CallParamsDraft = {
  temperature: number | "";
  topP: number | "";
  maxOutputTokens: number | "";
  stop: string;
  extraJson: string;
};

function emptyCallParamsDraft(): CallParamsDraft {
  return {
    temperature: "",
    topP: "",
    maxOutputTokens: "",
    stop: "",
    extraJson: "",
  };
}

function readCallParamsDraft(raw: unknown): CallParamsDraft {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyCallParamsDraft();
  const params = raw as Record<string, unknown>;
  const stop = params.stop;
  let stopText = "";
  if (typeof stop === "string") stopText = stop;
  else if (Array.isArray(stop)) stopText = stop.map(String).join("\n");

  let extraJson = "";
  if (params.extra && typeof params.extra === "object" && !Array.isArray(params.extra)) {
    try {
      extraJson = JSON.stringify(params.extra, null, 2);
    } catch {
      extraJson = "";
    }
  }

  return {
    temperature: typeof params.temperature === "number" ? params.temperature : "",
    topP: typeof params.topP === "number" ? params.topP : "",
    maxOutputTokens: typeof params.maxOutputTokens === "number" ? params.maxOutputTokens : "",
    stop: stopText,
    extraJson,
  };
}

function callParamsDraftToValue(draft: CallParamsDraft): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  if (draft.temperature !== "") out.temperature = draft.temperature;
  if (draft.topP !== "") out.topP = draft.topP;
  if (draft.maxOutputTokens !== "") out.maxOutputTokens = draft.maxOutputTokens;

  const stopLines = draft.stop
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (stopLines.length === 1) out.stop = stopLines[0];
  else if (stopLines.length > 1) out.stop = stopLines;

  const extraRaw = draft.extraJson.trim();
  if (extraRaw) {
    try {
      const parsed: unknown = JSON.parse(extraRaw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        out.extra = parsed;
      }
    } catch {
      // 保留无效 JSON 时不写入 extra，避免污染配置
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

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
        留空表示不覆盖；保存时写入 temperature / topP 等。
      </p>
      {habitatConfigNumberField("temperature", draft.temperature, (temperature) =>
        commit({ ...draft, temperature }),
      )}
      {habitatConfigNumberField("topP", draft.topP, (topP) => commit({ ...draft, topP }))}
      {habitatConfigNumberField("maxOutputTokens", draft.maxOutputTokens, (maxOutputTokens) =>
        commit({ ...draft, maxOutputTokens }),
      )}
      <div className="space-y-1">
        <Label className="text-sm">stop（每行一个）</Label>
        <Textarea
          className="w-full font-mono text-xs min-h-16"
          value={draft.stop}
          onChange={(e) => commit({ ...draft, stop: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">extra（JSON 对象）</Label>
        <Textarea
          className="w-full font-mono text-xs min-h-20"
          placeholder='{"foo": 1}'
          value={draft.extraJson}
          onChange={(e) => commit({ ...draft, extraJson: e.target.value })}
        />
      </div>
    </div>
  );
}

function readChain(raw: unknown): RouteHop[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const hop = item as Record<string, unknown>;
      const params =
        hop.params && typeof hop.params === "object" && !Array.isArray(hop.params)
          ? (hop.params as Record<string, unknown>)
          : undefined;
      return {
        provider: typeof hop.provider === "string" ? hop.provider : "",
        model: typeof hop.model === "string" ? hop.model : "",
        ...(params ? { params } : {}),
      };
    });
}

function normalizeHop(hop: RouteHop): RouteHop {
  const provider = hop.provider.trim();
  const model = hop.model.trim();
  const params = hop.params && Object.keys(hop.params).length > 0 ? hop.params : undefined;
  return {
    provider,
    model,
    ...(params ? { params } : {}),
  };
}

function LlmChainEditor({
  chain,
  onChange,
}: {
  chain: RouteHop[];
  onChange: (chain: RouteHop[]) => void;
}) {
  // 编辑中允许空 hop；勿在 onChange 时过滤，否则「添加 hop」会被立刻丢掉
  const hops = chain.length > 0 ? chain : [{ provider: "", model: "" }];

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

  const addHop = () => onChange([...hops, { provider: "", model: "" }]);

  const removeHop = (index: number) => {
    const next = hops.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [{ provider: "", model: "" }]);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">chain（路由链）</p>
        <p className="text-xs text-muted-foreground">
          每一步是一个 hop（provider + model）。多数场景只需一步；多步用于备用路由。
        </p>
      </div>
      {hops.map((hop, index) => (
        <div key={index} className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">步骤 {index + 1}</p>
            {hops.length > 1 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => removeHop(index)}
              >
                删除
              </Button>
            ) : null}
          </div>
          {hubConfigTextField("provider", hop.provider, (provider) =>
            patchHop(index, { provider }),
          )}
          {hubConfigTextField("model", hop.model, (model) => patchHop(index, { model }))}
          <LlmCallParamsEditor
            title="本步骤 params（可选）"
            value={hop.params}
            onChange={(params) => patchHop(index, { params })}
          />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={addHop}>
        添加备用步骤
      </Button>
    </div>
  );
}

export function LlmProvidersForm({
  value,
  onChange,
  testDisabled,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  testDisabled?: boolean;
}) {
  return (
    <HabitatConfigRecordEntryEditor
      label="provider"
      value={value}
      onChange={onChange}
      createEntry={() => ({ backend: OPENAI_COMPATIBLE_BACKEND_ID })}
      renderToolbar={({ activeKey, entry }) => (
        <HabitatConfigConnectionTestButton
          service="llm_provider"
          providerId={activeKey}
          config={entry}
          disabled={testDisabled ?? false}
        />
      )}
      renderFields={(entry, patch) => (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="llm-provider-backend">
              backend
            </label>
            <select
              id="llm-provider-backend"
              className={habitatConfigSelectClassName}
              value={String(entry.backend ?? OPENAI_COMPATIBLE_BACKEND_ID)}
              onChange={(e) => patch({ backend: e.target.value })}
            >
              <option value={OPENAI_COMPATIBLE_BACKEND_ID}>openai_compatible</option>
            </select>
          </div>
          {hubConfigTextField("base_url", String(entry.base_url ?? ""), (v) =>
            patch({ base_url: v }),
          )}
          {hubConfigTextField(
            "api_key",
            String(entry.api_key ?? ""),
            (v) => patch({ api_key: v }),
            { type: "password", hint: '可用 env("OPENAI_API_KEY") 或 vault 引用' },
          )}
          {habitatConfigNumberField(
            "timeout_ms",
            typeof entry.timeout_ms === "number" ? entry.timeout_ms : "",
            (v) => patch({ timeout_ms: v === "" ? undefined : v }),
          )}
        </div>
      )}
    />
  );
}

export function LlmProfilesForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <HabitatConfigRecordEntryEditor
      label="profile"
      value={value}
      onChange={onChange}
      renderFields={(entry, patch) => (
        <div className="space-y-4">
          <LlmChainEditor chain={readChain(entry.chain)} onChange={(chain) => patch({ chain })} />
          <LlmCallParamsEditor
            title="profile params（可选）"
            value={entry.params}
            onChange={(params) => patch({ params })}
          />
        </div>
      )}
    />
  );
}

export function LlmGeneralForm({
  defaultProfile,
  onDefaultProfileChange,
}: {
  defaultProfile: string;
  onDefaultProfileChange: (value: string) => void;
}): ReactNode {
  return (
    <div className="space-y-4">
      {hubConfigTextField("default_profile", defaultProfile, onDefaultProfileChange, {
        hint: "场景 profile 未配置时的回退项",
      })}
    </div>
  );
}

export function providersDraftToPatch(
  draft: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const entries = readHabitatConfigRecord(draft);
  const out: Record<string, unknown> = {};
  for (const [id, provider] of Object.entries(entries)) {
    out[id] = {
      ...provider,
      backend: String(provider.backend ?? OPENAI_COMPATIBLE_BACKEND_ID),
    };
  }
  return out;
}

/** 载入草稿时就把 UI 展示的默认 backend 写进对象，避免「看起来已配置、保存却没带上」 */
export function readProvidersDraft(
  draft: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return providersDraftToPatch(draft);
}

/** 保存前规范化：去掉空 hop，保留非空 params */
export function profilesDraftToPatch(
  draft: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const entries = readHabitatConfigRecord(draft);
  const out: Record<string, unknown> = {};
  for (const [id, profile] of Object.entries(entries)) {
    const chain = readChain(profile.chain)
      .map(normalizeHop)
      .filter((hop) => hop.provider && hop.model);
    const params =
      profile.params && typeof profile.params === "object" && !Array.isArray(profile.params)
        ? (profile.params as Record<string, unknown>)
        : undefined;
    const next: Record<string, unknown> = { ...profile, chain };
    if (params && Object.keys(params).length > 0) next.params = params;
    else delete next.params;
    out[id] = next;
  }
  return out;
}

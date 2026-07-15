import { Label, Textarea } from "@freeanima/frontend/ui-kit";
import {
  HubConfigRecordEntryEditor,
  hubConfigBoolField,
  hubConfigNumberField,
  hubConfigTextField,
  hubConfigTransportField,
} from "./hub-config-field-helpers.tsx";

export const ADVANCED_SECTIONS = [
  "firecrawl",
  "browser",
  "embedding",
  "cjk",
  "fts",
  "models",
  "mcp_servers",
  "acp_agents",
  "worlds",
  "auto_llm",
] as const;

/** 以条目名为 key 的 record 段；保存时需整段替换才能删除条目。 */
export const HUB_CONFIG_RECORD_SECTIONS = ["models", "mcp_servers", "acp_agents"] as const;

export type AdvancedSectionId = (typeof ADVANCED_SECTIONS)[number];

export type HubConfigRecordSectionId = (typeof HUB_CONFIG_RECORD_SECTIONS)[number];

export function isHubConfigRecordSection(
  section: AdvancedSectionId,
): section is HubConfigRecordSectionId {
  return (HUB_CONFIG_RECORD_SECTIONS as readonly string[]).includes(section);
}

function FirecrawlForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return hubConfigTextField("api_url", String(value.api_url ?? ""), (api_url) =>
    onChange({ ...value, api_url }),
  );
}

function BrowserForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const camofox = (value.camofox ?? {}) as Record<string, unknown>;
  const setCamofox = (patch: Record<string, unknown>) =>
    onChange({ ...value, camofox: { ...camofox, ...patch } });

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">camofox</p>
      {hubConfigTextField("base_url", String(camofox.base_url ?? ""), (v) =>
        setCamofox({ base_url: v }),
      )}
      {hubConfigNumberField(
        "timeout_ms",
        typeof camofox.timeout_ms === "number" ? camofox.timeout_ms : "",
        (v) => setCamofox({ timeout_ms: v === "" ? undefined : v }),
      )}
      {hubConfigBoolField("managed_persistence", camofox.managed_persistence !== false, (v) =>
        setCamofox({ managed_persistence: v }),
      )}
      {hubConfigBoolField("adopt_existing_tab", Boolean(camofox.adopt_existing_tab), (v) =>
        setCamofox({ adopt_existing_tab: v }),
      )}
      {hubConfigTextField("user_id", String(camofox.user_id ?? ""), (v) =>
        setCamofox({ user_id: v }),
      )}
      {hubConfigTextField("session_key", String(camofox.session_key ?? ""), (v) =>
        setCamofox({ session_key: v }),
      )}
    </div>
  );
}

function EmbeddingForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      {hubConfigBoolField("enabled", value.enabled !== false, (enabled) =>
        onChange({ ...value, enabled }),
      )}
      {hubConfigTextField("base_url", String(value.base_url ?? ""), (v) =>
        onChange({ ...value, base_url: v }),
      )}
      {hubConfigTextField(
        "api_key",
        String(value.api_key ?? ""),
        (v) => onChange({ ...value, api_key: v }),
        {
          type: "password",
        },
      )}
      {hubConfigTextField("model", String(value.model ?? ""), (v) =>
        onChange({ ...value, model: v }),
      )}
      {hubConfigNumberField(
        "dimensions",
        typeof value.dimensions === "number" ? value.dimensions : "",
        (v) => onChange({ ...value, dimensions: v === "" ? undefined : v }),
      )}
      {hubConfigNumberField(
        "timeout_ms",
        typeof value.timeout_ms === "number" ? value.timeout_ms : "",
        (v) => onChange({ ...value, timeout_ms: v === "" ? undefined : v }),
      )}
    </div>
  );
}

function CjkForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      {hubConfigBoolField("enabled", value.enabled !== false, (enabled) =>
        onChange({ ...value, enabled }),
      )}
      {hubConfigTextField("dict_path", String(value.dict_path ?? ""), (v) =>
        onChange({ ...value, dict_path: v }),
      )}
    </div>
  );
}

function FtsForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const trgm = (value.trgm ?? {}) as Record<string, unknown>;
  const setTrgm = (patch: Record<string, unknown>) =>
    onChange({ ...value, trgm: { ...trgm, ...patch } });

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">trgm</p>
      {hubConfigNumberField(
        "min_similarity",
        typeof trgm.min_similarity === "number" ? trgm.min_similarity : "",
        (v) => setTrgm({ min_similarity: v === "" ? undefined : v }),
        { hint: "0–1" },
      )}
      {hubConfigNumberField(
        "fallback_when_hits_lt",
        typeof trgm.fallback_when_hits_lt === "number" ? trgm.fallback_when_hits_lt : "",
        (v) => setTrgm({ fallback_when_hits_lt: v === "" ? undefined : v }),
      )}
    </div>
  );
}

function ModelsForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <HubConfigRecordEntryEditor
      label="model"
      value={value}
      onChange={onChange}
      renderFields={(entry, patch) =>
        hubConfigNumberField(
          "context_window",
          typeof entry.context_window === "number" ? entry.context_window : "",
          (v) => patch({ context_window: v === "" ? undefined : v }),
        )
      }
    />
  );
}

function McpServersForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <HubConfigRecordEntryEditor
      label="MCP"
      value={value}
      onChange={onChange}
      renderFields={(entry, patch) => (
        <div className="space-y-4">
          {hubConfigBoolField("enabled", entry.enabled !== false, (v) => patch({ enabled: v }))}
          {hubConfigTextField("command", String(entry.command ?? ""), (v) => patch({ command: v }))}
          {hubConfigTextField("url", String(entry.url ?? ""), (v) => patch({ url: v }))}
          {hubConfigTransportField(String(entry.transport ?? ""), (v) =>
            patch({ transport: v || undefined }),
          )}
          {hubConfigTextField("cwd", String(entry.cwd ?? ""), (v) => patch({ cwd: v }))}
          {hubConfigTextField("api_key_env", String(entry.api_key_env ?? ""), (v) =>
            patch({ api_key_env: v }),
          )}
          {hubConfigNumberField(
            "connect_timeout_ms",
            typeof entry.connect_timeout_ms === "number" ? entry.connect_timeout_ms : "",
            (v) => patch({ connect_timeout_ms: v === "" ? undefined : v }),
          )}
          <div className="space-y-1">
            <Label className="text-sm">args（每行一个）</Label>
            <Textarea
              className="w-full font-mono text-xs min-h-24"
              value={Array.isArray(entry.args) ? entry.args.map(String).join("\n") : ""}
              onChange={(e) => {
                const args = e.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean);
                patch({ args: args.length > 0 ? args : undefined });
              }}
            />
          </div>
        </div>
      )}
    />
  );
}

function AcpAgentsForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <HubConfigRecordEntryEditor
      label="ACP"
      value={value}
      onChange={onChange}
      renderFields={(entry, patch) => (
        <div className="space-y-4">
          {hubConfigBoolField("enabled", entry.enabled !== false, (v) => patch({ enabled: v }))}
          {hubConfigTextField("command", String(entry.command ?? ""), (v) => patch({ command: v }))}
          {hubConfigTextField("url", String(entry.url ?? ""), (v) => patch({ url: v }))}
          {hubConfigTransportField(String(entry.transport ?? ""), (v) =>
            patch({ transport: v || undefined }),
          )}
          {hubConfigTextField("adapter", String(entry.adapter ?? ""), (v) => patch({ adapter: v }))}
          {hubConfigTextField("model", String(entry.model ?? ""), (v) => patch({ model: v }))}
          {hubConfigTextField("cwd", String(entry.cwd ?? ""), (v) => patch({ cwd: v }))}
          {hubConfigNumberField(
            "connect_timeout_ms",
            typeof entry.connect_timeout_ms === "number" ? entry.connect_timeout_ms : "",
            (v) => patch({ connect_timeout_ms: v === "" ? undefined : v }),
          )}
          {hubConfigNumberField(
            "prompt_timeout_ms",
            typeof entry.prompt_timeout_ms === "number" ? entry.prompt_timeout_ms : "",
            (v) => patch({ prompt_timeout_ms: v === "" ? undefined : v }),
          )}
          {hubConfigBoolField("auto_restart", entry.auto_restart !== false, (v) =>
            patch({ auto_restart: v }),
          )}
        </div>
      )}
    />
  );
}

function WorldsForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      {hubConfigNumberField(
        "user_subject_id",
        typeof value.user_subject_id === "number" ? value.user_subject_id : "",
        (v) => onChange({ ...value, user_subject_id: v === "" ? undefined : v }),
      )}
      {hubConfigNumberField(
        "agent_subject_id",
        typeof value.agent_subject_id === "number" ? value.agent_subject_id : "",
        (v) => onChange({ ...value, agent_subject_id: v === "" ? undefined : v }),
      )}
    </div>
  );
}

function AutoLlmForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      {hubConfigNumberField(
        "retention_days",
        typeof value.retention_days === "number" ? value.retention_days : "",
        (v) => onChange({ ...value, retention_days: v === "" ? undefined : v }),
      )}
      {hubConfigNumberField(
        "per_run_kind_keep",
        typeof value.per_run_kind_keep === "number" ? value.per_run_kind_keep : "",
        (v) => onChange({ ...value, per_run_kind_keep: v === "" ? undefined : v }),
      )}
    </div>
  );
}

export function AdvancedSectionForm({
  section,
  value,
  onChange,
}: {
  section: AdvancedSectionId;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  switch (section) {
    case "firecrawl":
      return <FirecrawlForm value={value} onChange={onChange} />;
    case "browser":
      return <BrowserForm value={value} onChange={onChange} />;
    case "embedding":
      return <EmbeddingForm value={value} onChange={onChange} />;
    case "cjk":
      return <CjkForm value={value} onChange={onChange} />;
    case "fts":
      return <FtsForm value={value} onChange={onChange} />;
    case "models":
      return <ModelsForm value={value} onChange={onChange} />;
    case "mcp_servers":
      return <McpServersForm value={value} onChange={onChange} />;
    case "acp_agents":
      return <AcpAgentsForm value={value} onChange={onChange} />;
    case "worlds":
      return <WorldsForm value={value} onChange={onChange} />;
    case "auto_llm":
      return <AutoLlmForm value={value} onChange={onChange} />;
    default:
      return null;
  }
}

function cloneSectionValue(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return structuredClone(raw) as Record<string, unknown>;
}

export function readAdvancedSectionDraft(raw: unknown): Record<string, unknown> {
  return cloneSectionValue(raw);
}

export function readLlmRecordDraft(raw: unknown): Record<string, unknown> {
  return cloneSectionValue(raw);
}

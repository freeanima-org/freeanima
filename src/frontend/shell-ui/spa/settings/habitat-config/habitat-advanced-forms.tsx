import { Label } from "@freeanima/frontend/ui-kit";
import {
  HabitatConfigRecordEntryEditor,
  habitatConfigBoolField,
  habitatConfigNumberField,
  habitatConfigSelectClassName,
  hubConfigTextField,
  hubConfigTransportField,
} from "./habitat-config-field-helpers.tsx";

export const ADVANCED_SECTIONS = [
  "gateway",
  "discord",
  "weixin",
  "firecrawl",
  "browser",
  "embedding",
  "cjk",
  "fts",
  "models",
  "acp_agents",
  "worlds",
  "auto_llm",
] as const;

/** 以条目名为 key 的 record 段；保存时需整段替换才能删除条目。 */
export const HABITAT_CONFIG_RECORD_SECTIONS = ["models", "acp_agents"] as const;

export type AdvancedSectionId = (typeof ADVANCED_SECTIONS)[number];

/** Shell 侧边栏标题；未列出的段用 section id */
export const ADVANCED_SECTION_TITLES: Partial<Record<AdvancedSectionId, string>> = {
  gateway: "网关",
  discord: "Discord",
  weixin: "微信",
};

export type HabitatConfigRecordSectionId = (typeof HABITAT_CONFIG_RECORD_SECTIONS)[number];

export function isHabitatConfigRecordSection(
  section: AdvancedSectionId,
): section is HabitatConfigRecordSectionId {
  return (HABITAT_CONFIG_RECORD_SECTIONS as readonly string[]).includes(section);
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
      <p className="text-xs text-muted-foreground">
        Profile ≈ userId（登录态）；Session ≈
        session_key（同一档案下的任务线）。关闭持久化则每次临时档案。
      </p>
      {hubConfigTextField("base_url", String(camofox.base_url ?? ""), (v) =>
        setCamofox({ base_url: v }),
      )}
      {habitatConfigNumberField(
        "timeout_ms",
        typeof camofox.timeout_ms === "number" ? camofox.timeout_ms : 30_000,
        (v) => setCamofox({ timeout_ms: v === "" ? undefined : v }),
        { hint: "单次 HTTP 超时（毫秒），默认 30000" },
      )}
      {habitatConfigBoolField(
        "managed_persistence",
        camofox.managed_persistence !== false,
        (v) => setCamofox({ managed_persistence: v }),
        "默认开。本机复用稳定 userId，登录态可跨对话保留；关闭则每次临时档案。",
      )}
      {habitatConfigBoolField(
        "adopt_existing_tab",
        camofox.adopt_existing_tab !== false,
        (v) => setCamofox({ adopt_existing_tab: v }),
        "默认开。重启后尝试认领同档案已有 tab",
      )}
      {hubConfigTextField(
        "user_id",
        String(camofox.user_id ?? ""),
        (v) => setCamofox({ user_id: v }),
        {
          hint: "显式档案 ID；一旦填写则优先于 managed_persistence",
        },
      )}
      {hubConfigTextField(
        "session_key",
        String(camofox.session_key ?? ""),
        (v) => setCamofox({ session_key: v }),
        {
          hint: "仅在填写 user_id 时生效；同一档案下的会话键，缺省按对话派生",
        },
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
      {habitatConfigBoolField("enabled", value.enabled !== false, (enabled) =>
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
      {habitatConfigNumberField(
        "dimensions",
        typeof value.dimensions === "number" ? value.dimensions : "",
        (v) => onChange({ ...value, dimensions: v === "" ? undefined : v }),
      )}
      {habitatConfigNumberField(
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
      {habitatConfigBoolField("enabled", value.enabled !== false, (enabled) =>
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
      {habitatConfigNumberField(
        "min_similarity",
        typeof trgm.min_similarity === "number" ? trgm.min_similarity : "",
        (v) => setTrgm({ min_similarity: v === "" ? undefined : v }),
        { hint: "0–1" },
      )}
      {habitatConfigNumberField(
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
    <HabitatConfigRecordEntryEditor
      label="model"
      value={value}
      onChange={onChange}
      renderFields={(entry, patch) =>
        habitatConfigNumberField(
          "context_window",
          typeof entry.context_window === "number" ? entry.context_window : "",
          (v) => patch({ context_window: v === "" ? undefined : v }),
        )
      }
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
    <HabitatConfigRecordEntryEditor
      label="ACP"
      value={value}
      onChange={onChange}
      renderFields={(entry, patch) => (
        <div className="space-y-4">
          {habitatConfigBoolField("enabled", entry.enabled !== false, (v) => patch({ enabled: v }))}
          {hubConfigTextField("command", String(entry.command ?? ""), (v) => patch({ command: v }))}
          {hubConfigTextField("url", String(entry.url ?? ""), (v) => patch({ url: v }))}
          {hubConfigTransportField(String(entry.transport ?? ""), (v) =>
            patch({ transport: v || undefined }),
          )}
          {hubConfigTextField("adapter", String(entry.adapter ?? ""), (v) => patch({ adapter: v }))}
          {hubConfigTextField("model", String(entry.model ?? ""), (v) => patch({ model: v }))}
          {hubConfigTextField("cwd", String(entry.cwd ?? ""), (v) => patch({ cwd: v }))}
          {habitatConfigNumberField(
            "connect_timeout_ms",
            typeof entry.connect_timeout_ms === "number" ? entry.connect_timeout_ms : "",
            (v) => patch({ connect_timeout_ms: v === "" ? undefined : v }),
          )}
          {habitatConfigNumberField(
            "prompt_timeout_ms",
            typeof entry.prompt_timeout_ms === "number" ? entry.prompt_timeout_ms : "",
            (v) => patch({ prompt_timeout_ms: v === "" ? undefined : v }),
          )}
          {habitatConfigBoolField("auto_restart", entry.auto_restart !== false, (v) =>
            patch({ auto_restart: v }),
          )}
        </div>
      )}
    />
  );
}

function formatWorldSubjectId(value: unknown): string {
  return typeof value === "number" && value > 0 ? String(value) : "启动后自动绑定";
}

function WorldsForm({
  value,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">由 Habitat 启动自动绑定；无需手动维护。</p>
      <div className="space-y-1">
        <Label className="text-sm">user_subject_id</Label>
        <p className="text-sm font-mono">{formatWorldSubjectId(value.user_subject_id)}</p>
      </div>
      <div className="space-y-1">
        <Label className="text-sm">agent_subject_id</Label>
        <p className="text-sm font-mono">{formatWorldSubjectId(value.agent_subject_id)}</p>
      </div>
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
      {habitatConfigNumberField(
        "retention_days",
        typeof value.retention_days === "number" ? value.retention_days : "",
        (v) => onChange({ ...value, retention_days: v === "" ? undefined : v }),
      )}
      {habitatConfigNumberField(
        "per_run_kind_keep",
        typeof value.per_run_kind_keep === "number" ? value.per_run_kind_keep : "",
        (v) => onChange({ ...value, per_run_kind_keep: v === "" ? undefined : v }),
      )}
    </div>
  );
}

const GATEWAY_TOOL_DISPLAY_OPTIONS = [
  "",
  "hidden",
  "count",
  "name",
  "name_args_truncated",
  "name_args_full",
  "name_args_result_full",
] as const;

function GatewayForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-sm">tool_display</Label>
        <select
          className={habitatConfigSelectClassName}
          value={String(value.tool_display ?? "")}
          onChange={(e) =>
            onChange({
              ...value,
              tool_display: e.target.value || undefined,
            })
          }
        >
          {GATEWAY_TOOL_DISPLAY_OPTIONS.map((opt) => (
            <option key={opt || "default"} value={opt}>
              {opt || "（默认 name）"}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">网关通道工具消息展示模式；会话 slash 可覆盖</p>
      </div>
    </div>
  );
}

function DiscordForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      {habitatConfigBoolField("启用", value.enabled !== false, (enabled) =>
        onChange({ ...value, enabled }),
      )}
      {hubConfigTextField(
        "token",
        String(value.token ?? ""),
        (v) => onChange({ ...value, token: v }),
        {
          type: "password",
          hint: '明文、vault("id","field") 或 env("KEY")',
        },
      )}
      {habitatConfigBoolField("require_mention", value.require_mention !== false, (v) =>
        onChange({ ...value, require_mention: v }),
      )}
      {hubConfigTextField(
        "free_response_channels",
        String(value.free_response_channels ?? ""),
        (v) => onChange({ ...value, free_response_channels: v }),
        { hint: "频道 ID，逗号分隔；这些频道可不 @ 就回复" },
      )}
      {hubConfigTextField(
        "allowed_channels",
        String(value.allowed_channels ?? ""),
        (v) => onChange({ ...value, allowed_channels: v }),
        { hint: "白名单频道 ID，逗号分隔；空=不限制" },
      )}
      {habitatConfigBoolField("auto_thread", value.auto_thread !== false, (v) =>
        onChange({ ...value, auto_thread: v }),
      )}
      {habitatConfigBoolField(
        "thread_require_mention",
        Boolean(value.thread_require_mention),
        (v) => onChange({ ...value, thread_require_mention: v }),
      )}
      {habitatConfigBoolField("slash_commands", value.slash_commands !== false, (v) =>
        onChange({ ...value, slash_commands: v }),
      )}
      {hubConfigTextField(
        "slash_commands_guild_id",
        String(value.slash_commands_guild_id ?? ""),
        (v) => onChange({ ...value, slash_commands_guild_id: v }),
        { hint: "空=全局注册（传播较慢）；填 guild 则即时生效" },
      )}
      {habitatConfigBoolField(
        "session_handoff_on_new",
        value.session_handoff_on_new !== false,
        (v) => onChange({ ...value, session_handoff_on_new: v }),
      )}
      {hubConfigTextField("home_channel", String(value.home_channel ?? ""), (v) =>
        onChange({ ...value, home_channel: v }),
      )}
      {hubConfigTextField("home_thread_id", String(value.home_thread_id ?? ""), (v) =>
        onChange({ ...value, home_thread_id: v }),
      )}
    </div>
  );
}

function WeixinForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      {habitatConfigBoolField("启用", value.enabled !== false, (enabled) =>
        onChange({ ...value, enabled }),
      )}
      {hubConfigTextField(
        "token",
        String(value.token ?? ""),
        (v) => onChange({ ...value, token: v }),
        {
          type: "password",
          hint: "明文、vault/env 引用，或环境变量 WEIXIN_ILINK_TOKEN",
        },
      )}
      {hubConfigTextField("base_url", String(value.base_url ?? ""), (v) =>
        onChange({ ...value, base_url: v }),
      )}
      {hubConfigTextField("user_id", String(value.user_id ?? ""), (v) =>
        onChange({ ...value, user_id: v }),
      )}
      {hubConfigTextField("account_id", String(value.account_id ?? ""), (v) =>
        onChange({ ...value, account_id: v }),
      )}
      {habitatConfigBoolField(
        "session_handoff_on_new",
        Boolean(value.session_handoff_on_new),
        (v) => onChange({ ...value, session_handoff_on_new: v }),
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
    case "gateway":
      return <GatewayForm value={value} onChange={onChange} />;
    case "discord":
      return <DiscordForm value={value} onChange={onChange} />;
    case "weixin":
      return <WeixinForm value={value} onChange={onChange} />;
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

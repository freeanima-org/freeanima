import { Label } from "@freeanima/ui-kit";
import {
  habitatConfigBoolField,
  habitatConfigNumberField,
  habitatConfigSelectClassName,
  hubConfigTextField,
} from "./habitat-config-field-helpers.tsx";
import { hubConfigVaultField } from "./habitat-config-vault-field.tsx";
import { coerceString } from "@freeanima/shared/coerce-string";

export const ADVANCED_SECTIONS = [
  "i18n",
  "gateway",
  "discord",
  "weixin",
  "firecrawl",
  "browser",
  "embedding",
  "cjk",
  "fts",
  "worlds",
  "auto_llm",
  "object_storage",
] as const;

export type AdvancedSectionId = (typeof ADVANCED_SECTIONS)[number];

/** 侧栏一等运维项：已并入对话/向量 Tab 的段不重复列出 */
export const SIDEBAR_OPS_SECTIONS = [
  "gateway",
  "discord",
  "weixin",
  "firecrawl",
  "browser",
  "worlds",
  "object_storage",
] as const satisfies ReadonlyArray<AdvancedSectionId>;

/** Shell 侧边栏标题；未列出的段用 section id。注意：这是运维段列表，不是名为「高级」的产品分类。 */
export const ADVANCED_SECTION_TITLES: Partial<Record<AdvancedSectionId, string>> = {
  i18n: "时区",
  gateway: "网关",
  discord: "Discord",
  weixin: "微信",
  firecrawl: "Firecrawl",
  browser: "浏览器",
  embedding: "Embedding",
  cjk: "中文分词",
  fts: "全文检索",
  worlds: "世界",
  auto_llm: "自动 LLM",
  object_storage: "对象存储",
};

function I18nForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const timezone = coerceString(value.timezone ?? "Asia/Shanghai") || "Asia/Shanghai";
  const common = [
    "Asia/Shanghai",
    "Asia/Hong_Kong",
    "Asia/Tokyo",
    "UTC",
    "America/Los_Angeles",
    "America/New_York",
    "Europe/London",
    "Europe/Berlin",
  ];
  const isCommon = common.includes(timezone);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        栖息地全局时区（IANA）。影响任务/日历日界、提醒扫描与写入 ISO 的 offset。默认
        Asia/Shanghai。改后立即生效，无需重启。
      </p>
      <div className="space-y-2">
        <Label htmlFor="i18n-timezone">时区</Label>
        <select
          id="i18n-timezone"
          className={habitatConfigSelectClassName}
          value={isCommon ? timezone : "__custom__"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") {
              onChange({ ...value, timezone: isCommon ? "" : timezone });
              return;
            }
            onChange({ ...value, timezone: v });
          }}
        >
          {common.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
          <option value="__custom__">其他（手动输入）</option>
        </select>
        {!isCommon
          ? hubConfigTextField("timezone", timezone, (tz) => onChange({ ...value, timezone: tz }), {
              hint: "例：Asia/Shanghai、Europe/Paris",
            })
          : null}
      </div>
    </div>
  );
}

function FirecrawlForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      {hubConfigTextField("api_url", coerceString(value.api_url ?? ""), (api_url) =>
        onChange({ ...value, api_url }),
      )}
      {hubConfigVaultField(
        "api_key",
        coerceString(value.api_key ?? ""),
        (api_key) => onChange({ ...value, api_key }),
        { hint: '明文、vault("id","field") 或 env("KEY")' },
      )}
    </div>
  );
}

function ObjectStorageForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        S3 兼容远端可选：填齐 endpoint/bucket/密钥后远端为权威存储（SSOT），Habitat 另用
        /tmp/anima/objects 作可丢缓存。全部留空则用本机持久库
        ~/.anima/object-store（与临时缓存目录分离）。密钥可用「从 Vault 选择」或手写
        vault()/env()。配远端时 Habitat 须能访问 endpoint 公网（或同 VPC 内网）；勿用仅 VPC
        可达却从公网 Habitat 去连。
      </p>
      {hubConfigTextField(
        "endpoint",
        coerceString(value.endpoint ?? ""),
        (endpoint) => onChange({ ...value, endpoint }),
        {
          hint: "例：https://s3.oss-cn-hangzhou.aliyuncs.com；内网域名带 -internal",
        },
      )}
      {hubConfigTextField("region", coerceString(value.region ?? ""), (region) =>
        onChange({ ...value, region }),
      )}
      {hubConfigTextField("bucket", coerceString(value.bucket ?? ""), (bucket) =>
        onChange({ ...value, bucket }),
      )}
      {hubConfigVaultField(
        "access_key_id",
        coerceString(value.access_key_id ?? ""),
        (access_key_id) => onChange({ ...value, access_key_id }),
        { type: "text" },
      )}
      {hubConfigVaultField(
        "secret_access_key",
        coerceString(value.secret_access_key ?? ""),
        (secret_access_key) => onChange({ ...value, secret_access_key }),
      )}
      {habitatConfigBoolField(
        "force_path_style",
        Boolean(value.force_path_style),
        (force_path_style) => onChange({ ...value, force_path_style }),
        "MinIO 等常需开启 path-style；阿里云 OSS S3 兼容域名一般关闭",
      )}
    </div>
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
      {hubConfigTextField("base_url", coerceString(camofox.base_url ?? ""), (v) =>
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
        coerceString(camofox.user_id ?? ""),
        (v) => setCamofox({ user_id: v }),
        {
          hint: "显式档案 ID；一旦填写则优先于 managed_persistence",
        },
      )}
      {hubConfigTextField(
        "session_key",
        coerceString(camofox.session_key ?? ""),
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
      {hubConfigTextField("base_url", coerceString(value.base_url ?? ""), (v) =>
        onChange({ ...value, base_url: v }),
      )}
      {hubConfigVaultField("api_key", coerceString(value.api_key ?? ""), (v) =>
        onChange({ ...value, api_key: v }),
      )}
      {hubConfigTextField("model", coerceString(value.model ?? ""), (v) =>
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
      {hubConfigTextField("dict_path", coerceString(value.dict_path ?? ""), (v) =>
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
  const subagent =
    value.subagent && typeof value.subagent === "object" && !Array.isArray(value.subagent)
      ? (value.subagent as Record<string, unknown>)
      : {};
  const patchSubagent = (patch: Record<string, unknown>) =>
    onChange({ ...value, subagent: { ...subagent, ...patch } });
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
      {habitatConfigNumberField(
        "subagent.max_loop_iterations",
        typeof subagent.max_loop_iterations === "number" ? subagent.max_loop_iterations : "",
        (v) => patchSubagent({ max_loop_iterations: v === "" ? undefined : v }),
      )}
      {habitatConfigNumberField(
        "subagent.max_parallel",
        typeof subagent.max_parallel === "number" ? subagent.max_parallel : "",
        (v) => patchSubagent({ max_parallel: v === "" ? undefined : v }),
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
          value={coerceString(value.tool_display ?? "")}
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
      {hubConfigVaultField(
        "token",
        coerceString(value.token ?? ""),
        (v) => onChange({ ...value, token: v }),
        {
          hint: '明文、vault("id","field") 或 env("KEY")',
        },
      )}
      {habitatConfigBoolField("require_mention", value.require_mention !== false, (v) =>
        onChange({ ...value, require_mention: v }),
      )}
      {hubConfigTextField(
        "free_response_channels",
        coerceString(value.free_response_channels ?? ""),
        (v) => onChange({ ...value, free_response_channels: v }),
        { hint: "频道 ID，逗号分隔；这些频道可不 @ 就回复" },
      )}
      {hubConfigTextField(
        "allowed_channels",
        coerceString(value.allowed_channels ?? ""),
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
        coerceString(value.slash_commands_guild_id ?? ""),
        (v) => onChange({ ...value, slash_commands_guild_id: v }),
        { hint: "空=全局注册（传播较慢）；填 guild 则即时生效" },
      )}
      {habitatConfigBoolField(
        "session_handoff_on_new",
        value.session_handoff_on_new !== false,
        (v) => onChange({ ...value, session_handoff_on_new: v }),
      )}
      {hubConfigTextField("home_channel", coerceString(value.home_channel ?? ""), (v) =>
        onChange({ ...value, home_channel: v }),
      )}
      {hubConfigTextField("home_thread_id", coerceString(value.home_thread_id ?? ""), (v) =>
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
      {hubConfigVaultField(
        "token",
        coerceString(value.token ?? ""),
        (v) => onChange({ ...value, token: v }),
        {
          hint: "明文、vault/env 引用，或环境变量 WEIXIN_ILINK_TOKEN",
        },
      )}
      {hubConfigTextField("base_url", coerceString(value.base_url ?? ""), (v) =>
        onChange({ ...value, base_url: v }),
      )}
      {hubConfigTextField("user_id", coerceString(value.user_id ?? ""), (v) =>
        onChange({ ...value, user_id: v }),
      )}
      {hubConfigTextField("account_id", coerceString(value.account_id ?? ""), (v) =>
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
    case "i18n":
      return <I18nForm value={value} onChange={onChange} />;
    case "gateway":
      return <GatewayForm value={value} onChange={onChange} />;
    case "discord":
      return <DiscordForm value={value} onChange={onChange} />;
    case "weixin":
      return <WeixinForm value={value} onChange={onChange} />;
    case "firecrawl":
      return <FirecrawlForm value={value} onChange={onChange} />;
    case "object_storage":
      return <ObjectStorageForm value={value} onChange={onChange} />;
    case "browser":
      return <BrowserForm value={value} onChange={onChange} />;
    case "embedding":
      return <EmbeddingForm value={value} onChange={onChange} />;
    case "cjk":
      return <CjkForm value={value} onChange={onChange} />;
    case "fts":
      return <FtsForm value={value} onChange={onChange} />;
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

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button, Input, Label, Textarea } from "@freeanima/frontend/ui-kit";
import { FormToggle } from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";
import { cn } from "@freeanima/frontend/ui-kit/lib/utils.ts";

export const ADVANCED_SECTIONS = [
  "firecrawl",
  "browser",
  "embedding",
  "cjk",
  "fts",
  "models",
  "mcp_servers",
  "acp_agents",
  "tunnel",
  "web",
  "worlds",
  "auto_llm",
] as const;

export type AdvancedSectionId = (typeof ADVANCED_SECTIONS)[number];

const selectClassName =
  "border-input flex h-8 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function textField(
  label: string,
  value: string,
  onChange: (v: string) => void,
  opts?: { type?: "text" | "password"; placeholder?: string; hint?: string },
): ReactNode {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Input
        type={opts?.type ?? "text"}
        className="w-full"
        placeholder={opts?.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {opts?.hint ? <p className="text-xs text-muted-foreground">{opts.hint}</p> : null}
    </div>
  );
}

function numberField(
  label: string,
  value: number | "",
  onChange: (v: number | "") => void,
  opts?: { hint?: string },
): ReactNode {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Input
        type="number"
        className="w-full"
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? "" : Number(raw));
        }}
      />
      {opts?.hint ? <p className="text-xs text-muted-foreground">{opts.hint}</p> : null}
    </div>
  );
}

function boolField(
  label: string,
  value: boolean,
  onChange: (v: boolean) => void,
  hint?: string,
): ReactNode {
  return (
    <FormToggle className="w-full" label={label} hint={hint} checked={value} onChange={onChange} />
  );
}

function transportField(value: string, onChange: (v: string) => void): ReactNode {
  return (
    <div className="space-y-1">
      <Label className="text-sm">transport</Label>
      <select className={selectClassName} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">（默认）</option>
        <option value="stdio">stdio</option>
        <option value="sse">sse</option>
      </select>
    </div>
  );
}

function readRecord(value: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      out[key] = raw as Record<string, unknown>;
    }
  }
  return out;
}

function RecordEntryEditor({
  label,
  value,
  onChange,
  renderFields,
}: {
  label: string;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  renderFields: (
    entry: Record<string, unknown>,
    patch: (part: Record<string, unknown>) => void,
  ) => ReactNode;
}) {
  const entries = useMemo(() => readRecord(value), [value]);
  const keys = useMemo(() => Object.keys(entries).toSorted(), [entries]);
  const [selected, setSelected] = useState(keys[0] ?? "");
  const [newName, setNewName] = useState("");

  const activeKey = keys.includes(selected) ? selected : (keys[0] ?? "");
  const entry = activeKey ? entries[activeKey] : null;

  useEffect(() => {
    if (selected && keys.includes(selected)) return;
    setSelected(keys[0] ?? "");
  }, [keys, selected]);

  const patchEntry = (part: Record<string, unknown>) => {
    if (!activeKey) return;
    onChange({ ...entries, [activeKey]: { ...entries[activeKey], ...part } });
  };

  const addEntry = () => {
    const name = newName.trim();
    if (!name || entries[name]) return;
    onChange({ ...entries, [name]: {} });
    setSelected(name);
    setNewName("");
  };

  const removeEntry = () => {
    if (!activeKey) return;
    const next = { ...entries };
    delete next[activeKey];
    onChange(next);
    setSelected(Object.keys(next).toSorted()[0] ?? "");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {keys.map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={activeKey === key ? "default" : "ghost"}
            onClick={() => setSelected(key)}
          >
            {key}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        {textField("新建条目", newName, setNewName, { placeholder: `${label} 名称` })}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!newName.trim()}
          onClick={addEntry}
        >
          添加
        </Button>
        {activeKey ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={removeEntry}
          >
            删除 {activeKey}
          </Button>
        ) : null}
      </div>
      {entry ? (
        renderFields(entry, patchEntry)
      ) : (
        <p className="text-sm text-muted-foreground">暂无条目，请先添加。</p>
      )}
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
  return textField("api_url", String(value.api_url ?? ""), (api_url) =>
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
      {textField("base_url", String(camofox.base_url ?? ""), (v) => setCamofox({ base_url: v }))}
      {numberField(
        "timeout_ms",
        typeof camofox.timeout_ms === "number" ? camofox.timeout_ms : "",
        (v) => setCamofox({ timeout_ms: v === "" ? undefined : v }),
      )}
      {boolField("managed_persistence", camofox.managed_persistence !== false, (v) =>
        setCamofox({ managed_persistence: v }),
      )}
      {boolField("adopt_existing_tab", Boolean(camofox.adopt_existing_tab), (v) =>
        setCamofox({ adopt_existing_tab: v }),
      )}
      {textField("user_id", String(camofox.user_id ?? ""), (v) => setCamofox({ user_id: v }))}
      {textField("session_key", String(camofox.session_key ?? ""), (v) =>
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
      {boolField("enabled", value.enabled !== false, (enabled) => onChange({ ...value, enabled }))}
      {textField("base_url", String(value.base_url ?? ""), (v) =>
        onChange({ ...value, base_url: v }),
      )}
      {textField(
        "api_key",
        String(value.api_key ?? ""),
        (v) => onChange({ ...value, api_key: v }),
        {
          type: "password",
        },
      )}
      {textField("model", String(value.model ?? ""), (v) => onChange({ ...value, model: v }))}
      {numberField(
        "dimensions",
        typeof value.dimensions === "number" ? value.dimensions : "",
        (v) => onChange({ ...value, dimensions: v === "" ? undefined : v }),
      )}
      {numberField(
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
      {boolField("enabled", value.enabled !== false, (enabled) => onChange({ ...value, enabled }))}
      {textField("dict_path", String(value.dict_path ?? ""), (v) =>
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
      {numberField(
        "min_similarity",
        typeof trgm.min_similarity === "number" ? trgm.min_similarity : "",
        (v) => setTrgm({ min_similarity: v === "" ? undefined : v }),
        { hint: "0–1" },
      )}
      {numberField(
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
    <RecordEntryEditor
      label="model"
      value={value}
      onChange={onChange}
      renderFields={(entry, patch) =>
        numberField(
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
    <RecordEntryEditor
      label="MCP"
      value={value}
      onChange={onChange}
      renderFields={(entry, patch) => (
        <div className="space-y-4">
          {boolField("enabled", entry.enabled !== false, (v) => patch({ enabled: v }))}
          {textField("command", String(entry.command ?? ""), (v) => patch({ command: v }))}
          {textField("url", String(entry.url ?? ""), (v) => patch({ url: v }))}
          {transportField(String(entry.transport ?? ""), (v) =>
            patch({ transport: v || undefined }),
          )}
          {textField("cwd", String(entry.cwd ?? ""), (v) => patch({ cwd: v }))}
          {textField("api_key_env", String(entry.api_key_env ?? ""), (v) =>
            patch({ api_key_env: v }),
          )}
          {numberField(
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
    <RecordEntryEditor
      label="ACP"
      value={value}
      onChange={onChange}
      renderFields={(entry, patch) => (
        <div className="space-y-4">
          {boolField("enabled", entry.enabled !== false, (v) => patch({ enabled: v }))}
          {textField("command", String(entry.command ?? ""), (v) => patch({ command: v }))}
          {textField("url", String(entry.url ?? ""), (v) => patch({ url: v }))}
          {transportField(String(entry.transport ?? ""), (v) =>
            patch({ transport: v || undefined }),
          )}
          {textField("adapter", String(entry.adapter ?? ""), (v) => patch({ adapter: v }))}
          {textField("model", String(entry.model ?? ""), (v) => patch({ model: v }))}
          {textField("cwd", String(entry.cwd ?? ""), (v) => patch({ cwd: v }))}
          {numberField(
            "connect_timeout_ms",
            typeof entry.connect_timeout_ms === "number" ? entry.connect_timeout_ms : "",
            (v) => patch({ connect_timeout_ms: v === "" ? undefined : v }),
          )}
          {numberField(
            "prompt_timeout_ms",
            typeof entry.prompt_timeout_ms === "number" ? entry.prompt_timeout_ms : "",
            (v) => patch({ prompt_timeout_ms: v === "" ? undefined : v }),
          )}
          {boolField("auto_restart", entry.auto_restart !== false, (v) =>
            patch({ auto_restart: v }),
          )}
        </div>
      )}
    />
  );
}

function TunnelForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const cloudflare = (value.cloudflare ?? {}) as Record<string, unknown>;
  const credentials = (value.credentials ?? {}) as Record<string, unknown>;
  const setCloudflare = (patch: Record<string, unknown>) =>
    onChange({ ...value, cloudflare: { ...cloudflare, ...patch } });
  const setCredentials = (patch: Record<string, unknown>) =>
    onChange({ ...value, credentials: { ...credentials, ...patch } });

  return (
    <div className="space-y-4">
      {boolField("enabled", Boolean(value.enabled), (enabled) => onChange({ ...value, enabled }))}
      {textField("hostname", String(value.hostname ?? ""), (v) =>
        onChange({ ...value, hostname: v }),
      )}
      <p className="text-sm font-medium">cloudflare</p>
      {textField("account_id", String(cloudflare.account_id ?? ""), (v) =>
        setCloudflare({ account_id: v }),
      )}
      {textField("tunnel_id", String(cloudflare.tunnel_id ?? ""), (v) =>
        setCloudflare({ tunnel_id: v }),
      )}
      {textField("tunnel_name", String(cloudflare.tunnel_name ?? ""), (v) =>
        setCloudflare({ tunnel_name: v }),
      )}
      {textField("zone_id", String(cloudflare.zone_id ?? ""), (v) => setCloudflare({ zone_id: v }))}
      <p className="text-sm font-medium">credentials</p>
      {textField(
        "api_token",
        String(credentials.api_token ?? ""),
        (v) => setCredentials({ api_token: v }),
        {
          type: "password",
          hint: '可用 env("CLOUDFLARE_API_TOKEN") 引用',
        },
      )}
      {textField(
        "tunnel_credentials",
        String(credentials.tunnel_credentials ?? ""),
        (v) => setCredentials({ tunnel_credentials: v }),
        { hint: "可用 env() 或 vault 引用" },
      )}
    </div>
  );
}

function WebForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      {boolField("enabled", Boolean(value.enabled), (enabled) => onChange({ ...value, enabled }))}
      {textField("host", String(value.host ?? ""), (v) => onChange({ ...value, host: v }))}
      {numberField("port", typeof value.port === "number" ? value.port : "", (v) =>
        onChange({ ...value, port: v === "" ? undefined : v }),
      )}
      {textField("public_url", String(value.public_url ?? ""), (v) =>
        onChange({ ...value, public_url: v }),
      )}
    </div>
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
      {numberField(
        "user_subject_id",
        typeof value.user_subject_id === "number" ? value.user_subject_id : "",
        (v) => onChange({ ...value, user_subject_id: v === "" ? undefined : v }),
      )}
      {numberField(
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
      {numberField(
        "retention_days",
        typeof value.retention_days === "number" ? value.retention_days : "",
        (v) => onChange({ ...value, retention_days: v === "" ? undefined : v }),
      )}
      {numberField(
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
    case "tunnel":
      return <TunnelForm value={value} onChange={onChange} />;
    case "web":
      return <WebForm value={value} onChange={onChange} />;
    case "worlds":
      return <WorldsForm value={value} onChange={onChange} />;
    case "auto_llm":
      return <AutoLlmForm value={value} onChange={onChange} />;
    default:
      return null;
  }
}

export function AdvancedSectionPicker({
  section,
  onSectionChange,
}: {
  section: AdvancedSectionId;
  onSectionChange: (id: AdvancedSectionId) => void;
}) {
  return (
    <nav className="flex flex-wrap gap-1" aria-label="高级配置段">
      {ADVANCED_SECTIONS.map((id) => (
        <Button
          key={id}
          type="button"
          size="sm"
          variant={section === id ? "default" : "ghost"}
          className={cn("font-mono text-xs")}
          onClick={() => onSectionChange(id)}
        >
          {id}
        </Button>
      ))}
    </nav>
  );
}

function cloneSectionValue(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return structuredClone(raw) as Record<string, unknown>;
}

export function readAdvancedSectionDraft(raw: unknown): Record<string, unknown> {
  return cloneSectionValue(raw);
}

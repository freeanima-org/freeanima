import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Input, Label, Textarea } from "@freeanima/frontend/ui-kit";
import { FormToggle } from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";
import { showConfirm, StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import {
  fetchHabitatConfigSection,
  replaceHabitatConfigSection,
  restartHabitatService,
} from "@freeanima/frontend/portal-sdk/habitat-config-api";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";
import {
  keyValueTextToRecord,
  recordToKeyValueText,
} from "@freeanima/features/habitat/ui/habitat/lib/mcp-key-value.ts";

const selectClassName =
  "border-input flex h-8 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function readRecord(
  value: Record<string, unknown> | null | undefined,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  if (value == null || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [key, raw] of Object.entries(value)) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      out[key] = raw as Record<string, unknown>;
    }
  }
  return out;
}

function textField(
  label: string,
  value: string,
  onChange: (v: string) => void,
  opts?: { hint?: string; placeholder?: string },
): ReactNode {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Input
        className="w-full"
        value={value}
        placeholder={opts?.placeholder}
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
    </div>
  );
}

/** 本地 draft，避免未写完 KEY=VALUE 时受控回写把输入清空 */
function KeyValueField({
  label,
  resetKey,
  value,
  onChange,
  hint,
}: {
  label: string;
  /** 切换条目时重置 draft（不要跟 value 同步，否则输入过程中会被 parse 清空） */
  resetKey: string;
  value: unknown;
  onChange: (next: Record<string, string> | undefined) => void;
  hint: string;
}) {
  const [draft, setDraft] = useState(() => recordToKeyValueText(value));

  useEffect(() => {
    setDraft(recordToKeyValueText(value));
    // 仅随条目切换重置；value 故意不进 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetKey 是条目身份
  }, [resetKey]);

  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Textarea
        className="w-full font-mono text-xs min-h-24"
        value={draft}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          const parsed = keyValueTextToRecord(next);
          // 未写完 KEY=VALUE 时不把父级 headers 清空，否则点保存会丢数据
          if (parsed !== undefined) onChange(parsed);
          else if (next.trim() === "") onChange(undefined);
        }}
        onBlur={() => {
          const parsed = keyValueTextToRecord(draft);
          onChange(parsed);
          setDraft(recordToKeyValueText(parsed));
        }}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function McpEntryFields({
  entryKey,
  entry,
  patch,
}: {
  entryKey: string;
  entry: Record<string, unknown>;
  patch: (part: Record<string, unknown>) => void;
}) {
  const transportRaw = String(entry.transport ?? "stdio");
  const transport = transportRaw === "sse" || transportRaw === "http" ? transportRaw : "stdio";
  const isRemote = transport === "sse" || transport === "http";

  return (
    <div className="space-y-4">
      <FormToggle
        className="w-full"
        label="enabled"
        checked={entry.enabled !== false}
        onChange={(v) => patch({ enabled: v })}
      />
      <div className="space-y-1">
        <Label className="text-sm">transport</Label>
        <select
          className={selectClassName}
          value={transport}
          onChange={(e) => {
            const v = e.target.value;
            patch({
              transport: v === "sse" || v === "http" || v === "stdio" ? v : "stdio",
            });
          }}
        >
          <option value="stdio">stdio</option>
          <option value="http">http（Streamable HTTP，连 Habitat /mcp）</option>
          <option value="sse">sse（旧 HTTP+SSE，已弃用）</option>
        </select>
      </div>
      {numberField(
        "connect_timeout_ms",
        typeof entry.connect_timeout_ms === "number" ? entry.connect_timeout_ms : "",
        (v) => patch({ connect_timeout_ms: v === "" ? undefined : v }),
      )}
      {!isRemote ? (
        <>
          {textField("command", String(entry.command ?? ""), (v) =>
            patch({ command: v || undefined }),
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
          {textField("cwd", String(entry.cwd ?? ""), (v) => patch({ cwd: v || undefined }))}
          <KeyValueField
            label="env"
            resetKey={`${entryKey}:env`}
            value={entry.env}
            onChange={(next) => patch({ env: next })}
            hint="每行 KEY=VALUE"
          />
        </>
      ) : (
        <>
          {textField("url", String(entry.url ?? ""), (v) => patch({ url: v || undefined }), {
            placeholder:
              transport === "http" ? "http://127.0.0.1:2658/mcp" : "https://example.com/sse",
          })}
          <KeyValueField
            label="headers"
            resetKey={`${entryKey}:headers`}
            value={entry.headers}
            onChange={(next) => patch({ headers: next })}
            hint="每行 KEY=VALUE，例如 Authorization=Bearer …"
          />
        </>
      )}
    </div>
  );
}

type Props = {
  onSaved: () => void | Promise<void>;
};

export function McpServersConfigEditor({ onSaved }: Props) {
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");

  const entries = useMemo(() => readRecord(draft), [draft]);
  const keys = useMemo(() => Object.keys(entries).toSorted(), [entries]);
  const [selected, setSelected] = useState("");
  const activeKey = keys.includes(selected) ? selected : (keys[0] ?? "");
  const entry = activeKey ? entries[activeKey] : null;

  useEffect(() => {
    if (selected && keys.includes(selected)) return;
    setSelected(keys[0] ?? "");
  }, [keys, selected]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const section = await fetchHabitatConfigSection("mcp_servers");
      const asRecord =
        section && typeof section === "object" && !Array.isArray(section)
          ? (section as Record<string, unknown>)
          : {};
      setDraft(asRecord);
    } catch (e) {
      logCaughtError("McpServersConfigEditor/load", e);
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchEntry = (part: Record<string, unknown>) => {
    if (!activeKey) return;
    setDraft({ ...entries, [activeKey]: { ...entries[activeKey], ...part } });
  };

  const addEntry = () => {
    const name = newName.trim();
    if (!name || entries[name]) return;
    setDraft({ ...entries, [name]: { transport: "stdio", enabled: true } });
    setSelected(name);
    setNewName("");
  };

  const removeEntry = () => {
    if (!activeKey) return;
    const next = { ...entries };
    delete next[activeKey];
    setDraft(next);
    setSelected(Object.keys(next).toSorted()[0] ?? "");
  };

  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await replaceHabitatConfigSection("mcp_servers", draft);
      const restart = await showConfirm({
        title: m.ui_habitat_config_saved_restart_title(),
        description: m.ui_habitat_config_saved_restart_description({ section: "mcp_servers" }),
        confirmLabel: m.habitat_common_restart_service(),
      });
      if (restart) {
        try {
          await restartHabitatService();
        } catch (e) {
          setSaveError(e instanceof Error ? e.message : String(e));
        }
      }
      await load();
      await onSaved();
    } catch (e) {
      logCaughtError("McpServersConfigEditor/save", e);
      setSaveError(
        m.habitat_mcp_save_failed({
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <details
      className="mb-6 rounded-md border border-border bg-muted/40 px-4 py-3"
      open={keys.length === 0}
    >
      <summary className="cursor-pointer text-sm font-medium select-none">
        {m.habitat_mcp_edit_config()}
      </summary>
      <div className="mt-4 space-y-4">
        {loadError ? <StatusAlert variant="error">{loadError}</StatusAlert> : null}
        {saveError ? <StatusAlert variant="error">{saveError}</StatusAlert> : null}
        {loading ? (
          <p className="text-sm text-muted-foreground">{m.habitat_common_loading()}</p>
        ) : (
          <>
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
              {textField("新建条目", newName, setNewName, { placeholder: "MCP 名称" })}
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
              <McpEntryFields entryKey={activeKey} entry={entry} patch={patchEntry} />
            ) : (
              <p className="text-sm text-muted-foreground">{m.habitat_mcp_empty_hint()}</p>
            )}
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {m.habitat_mcp_save_config()}
            </Button>
          </>
        )}
      </div>
    </details>
  );
}

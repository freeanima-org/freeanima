import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button, Input, Label } from "@freeanima/frontend/ui-kit";
import { FormToggle } from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";

export const hubConfigSelectClassName =
  "border-input flex h-8 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

export function hubConfigTextField(
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

export function hubConfigNumberField(
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

export function hubConfigBoolField(
  label: string,
  value: boolean,
  onChange: (v: boolean) => void,
  hint?: string,
): ReactNode {
  return (
    <FormToggle className="w-full" label={label} hint={hint} checked={value} onChange={onChange} />
  );
}

export function hubConfigTransportField(value: string, onChange: (v: string) => void): ReactNode {
  return (
    <div className="space-y-1">
      <Label className="text-sm">transport</Label>
      <select
        className={hubConfigSelectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">（默认）</option>
        <option value="stdio">stdio</option>
        <option value="sse">sse</option>
      </select>
    </div>
  );
}

export function readHubConfigRecord(
  value: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      out[key] = raw as Record<string, unknown>;
    }
  }
  return out;
}

export function HubConfigRecordEntryEditor({
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
  const entries = useMemo(() => readHubConfigRecord(value), [value]);
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
        {hubConfigTextField("新建条目", newName, setNewName, { placeholder: `${label} 名称` })}
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

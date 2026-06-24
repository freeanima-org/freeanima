import { useEffect, useState } from "react";
import type { SettingsPanelProps } from "@freeanima/satellite-sdk";
import { m } from "@/lib/i18n.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function maskSecret(key: string, value: unknown): string {
  const s = value == null ? "" : String(value);
  if (
    key.toLowerCase().includes("key") ||
    key.toLowerCase().includes("token") ||
    key.toLowerCase().includes("secret")
  ) {
    return s ? `${s.slice(0, 8)}…` : m.admin_common_empty();
  }
  return s || m.admin_common_empty();
}

function formatDisplayValue(key: string, value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return m.admin_common_empty();
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return maskSecret(key, value);
  if (Array.isArray(value)) {
    if (value.every((item) => !isPlainObject(item))) {
      return JSON.stringify(value);
    }
    return JSON.stringify(value, null, 2);
  }
  return JSON.stringify(value, null, 2);
}

function flattenConfigEntries(
  obj: Record<string, unknown>,
  prefix = "",
): Array<{ key: string; value: unknown }> {
  const rows: Array<{ key: string; value: unknown }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v)) {
      rows.push(...flattenConfigEntries(v, path));
      continue;
    }
    if (Array.isArray(v)) {
      const objectItems = v.filter(isPlainObject);
      if (objectItems.length === v.length && v.length > 0) {
        v.forEach((item, index) => {
          rows.push(...flattenConfigEntries(item as Record<string, unknown>, `${path}[${index}]`));
        });
        continue;
      }
    }
    rows.push({ key: path, value: v });
  }
  return rows;
}

function ConfigBlock({ name, value }: { name: string; value: unknown }) {
  if (isPlainObject(value)) {
    const rows = flattenConfigEntries(value);
    return (
      <section className="card bg-base-200">
        <div className="card-body gap-3">
          <h3 className="font-bold font-mono text-sm">{name}</h3>
          {rows.length === 0 ? (
            <p className="text-xs text-base-content/50">{m.admin_common_empty()}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th className="w-48">{m.admin_common_key_label()}</th>
                    <th>{m.admin_common_value_label()}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ key, value: rowValue }) => (
                    <tr key={key}>
                      <td className="font-mono text-xs align-top">{key}</td>
                      <td className="font-mono text-xs whitespace-pre-wrap break-all">
                        {formatDisplayValue(key, rowValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="card bg-base-200">
      <div className="card-body gap-2">
        <h3 className="font-bold font-mono text-sm">{name}</h3>
        <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-base-300 p-2 rounded">
          {formatDisplayValue(name, value)}
        </pre>
      </div>
    </section>
  );
}

export default function ConfigPanel({ store }: SettingsPanelProps) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await store.load();
        if (!cancelled) setConfig((data ?? {}) as Record<string, unknown>);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store]);

  if (failed || config === null) {
    return <div className="alert alert-error text-sm">{m.admin_common_load_failed_short()}</div>;
  }

  const blocks = Object.entries(config);

  return (
    <div>
      {blocks.length === 0 ? (
        <div className="alert alert-info text-sm">{m.admin_config_empty()}</div>
      ) : (
        <div className="space-y-4">
          {blocks.map(([name, value]) => (
            <ConfigBlock key={name} name={name} value={value} />
          ))}
        </div>
      )}
    </div>
  );
}

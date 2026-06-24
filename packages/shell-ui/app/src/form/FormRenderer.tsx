import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  FormFieldDescriptor,
  SettingsFormFields,
  SettingsStore,
} from "@freeanima/satellite-sdk";

type Props = {
  fields: SettingsFormFields;
  store: SettingsStore<unknown>;
  platform: "desktop" | "mobile";
  onDirty?: () => void;
};

function readFieldValue(data: Record<string, unknown>, key: string): unknown {
  return data[key];
}

export function FormRenderer({ fields, store, platform, onDirty }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const grouped = useMemo(() => groupFields(fields.items), [fields.items]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const raw = await store.load();
        if (!cancelled && raw && typeof raw === "object") {
          setValues({ ...(raw as Record<string, unknown>) });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store]);

  const setField = useCallback(
    (key: string, value: unknown) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      onDirty?.();
      setStatus(null);
    },
    [onDirty],
  );

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const parsed = fields.zodSchema.parse(values);
      await store.save(parsed);
      setStatus("已保存");
      if (window.satelliteShell?.emitConfigChanged) {
        await window.satelliteShell.emitConfigChanged();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [fields.zodSchema, store, values]);

  if (loading) {
    return <p className="text-sm text-base-content/60">加载中…</p>;
  }

  return (
    <div className={`space-y-4 ${platform === "mobile" ? "pb-8" : ""}`}>
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}
      {status ? <div className="alert alert-success text-sm">{status}</div> : null}
      {Object.entries(grouped).map(([group, items]) => (
        <section key={group} className="space-y-3">
          {group !== "" ? (
            <h3 className="text-sm font-semibold text-base-content/70">{group}</h3>
          ) : null}
          {items.map((item) => (
            <FieldInput
              key={item.key}
              item={item}
              value={readFieldValue(values, item.key)}
              platform={platform}
              onChange={(v) => setField(item.key, v)}
            />
          ))}
        </section>
      ))}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}

function groupFields(items: FormFieldDescriptor[]): Record<string, FormFieldDescriptor[]> {
  const out: Record<string, FormFieldDescriptor[]> = {};
  for (const item of items) {
    const group = item.group ?? "";
    if (!out[group]) out[group] = [];
    out[group].push(item);
  }
  return out;
}

function FieldInput({
  item,
  value,
  platform,
  onChange,
}: {
  item: FormFieldDescriptor;
  value: unknown;
  platform: "desktop" | "mobile";
  onChange: (value: unknown) => void;
}) {
  const inputClass =
    platform === "mobile"
      ? "input input-bordered w-full"
      : "input input-bordered input-sm w-full max-w-xl";

  if (item.type === "boolean") {
    return (
      <label className="label cursor-pointer justify-start gap-3 max-w-xl">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="label-text">{item.label}</span>
      </label>
    );
  }

  if (item.type === "select" && item.options) {
    return (
      <label className="form-control w-full max-w-xl">
        <span className="label-text text-sm">{item.label}</span>
        <select
          className={inputClass}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {item.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (item.type === "textarea") {
    return (
      <label className="form-control w-full max-w-xl">
        <span className="label-text text-sm">{item.label}</span>
        <textarea
          className="textarea textarea-bordered w-full"
          rows={4}
          placeholder={item.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }

  return (
    <label className="form-control w-full max-w-xl">
      <span className="label-text text-sm">{item.label}</span>
      <input
        type={item.type === "password" ? "password" : item.type === "number" ? "number" : "text"}
        className={inputClass}
        placeholder={item.placeholder}
        value={String(value ?? "")}
        onChange={(e) => onChange(item.type === "number" ? Number(e.target.value) : e.target.value)}
      />
      {item.description ? (
        <span className="label-text-alt text-base-content/50">{item.description}</span>
      ) : null}
    </label>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  FormFieldDescriptor,
  SettingsFormFields,
  SettingsPlatform,
  SettingsStore,
} from "@freeanima/satellite-sdk/settings";

import { notifyDebugConfigChanged } from "../bootstrap/sentry.ts";

type Props = {
  fields: SettingsFormFields;
  store: SettingsStore<unknown>;
  platform: SettingsPlatform;
  sectionId?: string;
  onDirty?: () => void;
};

function readFieldValue(data: Record<string, unknown>, key: string): unknown {
  return data[key];
}

export function FormRenderer({ fields, store, platform, sectionId, onDirty }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const canTest = Boolean(store.test);
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

  const persist = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const parsed = fields.zodSchema.parse(values);
      await store.save(parsed);
      setStatus("已保存");
      if (sectionId === "debug") notifyDebugConfigChanged();
      if (window.satelliteShell?.emitConfigChanged) {
        await window.satelliteShell.emitConfigChanged();
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, [fields.zodSchema, store, values]);

  const save = useCallback(async () => {
    await persist();
  }, [persist]);

  const saveAndEnter = useCallback(async () => {
    const ok = await persist();
    if (ok) window.location.href = "/chat";
  }, [persist]);

  const testConnection = useCallback(async () => {
    if (!store.test) return;
    setTesting(true);
    setError(null);
    setStatus(null);
    try {
      const parsed = fields.zodSchema.parse(values);
      await store.test(parsed);
      setStatus(sectionId === "debug" ? "测试事件已发送" : "连接成功");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  }, [fields.zodSchema, store, values]);

  if (loading) {
    return <p className="text-sm text-base-content/60">加载中…</p>;
  }

  const fieldWidthClass = platform === "mobile" ? "w-full" : "w-full max-w-xl";

  const testLabel =
    sectionId === "debug"
      ? testing
        ? "发送中…"
        : "发送测试事件"
      : testing
        ? "测试中…"
        : "测试连接";

  return (
    <div className={`space-y-4 ${platform === "mobile" ? "pb-8" : ""}`}>
      {sectionId === "hub" && error?.includes("连接") ? (
        <div className="alert alert-info text-sm">
          请确认 Hub 已启动（<code className="text-xs">anima service start --host 0.0.0.0</code>
          ）、远程 Token 与 <code className="text-xs">~/.anima/config.yaml</code> 中{" "}
          <code className="text-xs">remote_auth.token</code> 一致；详见项目文档 remote-access。
        </div>
      ) : null}
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
              widthClass={fieldWidthClass}
              onChange={(v) => setField(item.key, v)}
            />
          ))}
        </section>
      ))}
      <div className="flex flex-wrap gap-2 pt-2">
        {canTest ? (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={testing || saving}
            onClick={() => void testConnection()}
          >
            {testLabel}
          </button>
        ) : null}
        {platform === "mobile" ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving || testing}
            onClick={() => void saveAndEnter()}
          >
            {saving ? "保存中…" : "保存并进入"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving || testing}
            onClick={() => void save()}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        )}
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
  widthClass,
  onChange,
}: {
  item: FormFieldDescriptor;
  value: unknown;
  platform: SettingsPlatform;
  widthClass: string;
  onChange: (value: unknown) => void;
}) {
  const inputClass =
    platform === "mobile"
      ? "input input-bordered w-full"
      : "input input-bordered input-sm w-full max-w-xl";

  if (item.type === "boolean") {
    return (
      <label className={`label cursor-pointer justify-start gap-3 ${widthClass}`}>
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
      <label className={`form-control ${widthClass}`}>
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
      <label className={`form-control ${widthClass}`}>
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
    <label className={`form-control ${widthClass}`}>
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

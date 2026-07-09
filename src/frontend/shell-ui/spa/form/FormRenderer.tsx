import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Input, Textarea } from "@freeanima/frontend/ui-kit";
import { cn } from "@freeanima/frontend/ui-kit/lib/utils.ts";
import type {
  FormFieldDescriptor,
  SettingsFormFields,
  SettingsPlatform,
  SettingsStore,
} from "@freeanima/frontend/shell-sdk/settings";
import {
  FormField,
  FormFieldLabel,
  FormFieldset,
  FormToggle,
} from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";

import { notifyDebugConfigChanged } from "../bootstrap/sentry.ts";
import { resolveShellRouterBasepath } from "../router-basepath.ts";

type Props = {
  fields: SettingsFormFields;
  store: SettingsStore<unknown>;
  platform: SettingsPlatform;
  sectionId?: string;
  onDirty?: () => void;
  /** 保存成功后显示「保存并进入」；用于 Web 引导页等独立连接流程 */
  enterAfterSave?: boolean;
  onEnterAfterSave?: () => void;
};

function readFieldValue(data: Record<string, unknown>, key: string): unknown {
  return data[key];
}

export function FormRenderer({
  fields,
  store,
  platform,
  sectionId,
  onDirty,
  enterAfterSave = false,
  onEnterAfterSave,
}: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const navigate = useNavigate();

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
    if (!ok) return;
    if (onEnterAfterSave) {
      onEnterAfterSave();
      return;
    }
    if (platform === "mobile" || window.satelliteShell?.isNativeShell) {
      await navigate({ to: "/chat" as never });
      return;
    }
    const base = resolveShellRouterBasepath() ?? "";
    window.location.href = `${base}/chat`;
  }, [navigate, onEnterAfterSave, persist, platform]);

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
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  }

  const fieldWidthClass = "w-full lg:max-w-xl";

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
        <Alert variant="info" className="text-sm">
          请确认 Hub 已启动（<code className="text-xs">anima service start --host 0.0.0.0</code>
          ）、客户端 Hub 设置中的 Service API Token（<code className="text-xs">fa_at_...</code>
          ）有效；详见项目文档 remote-access。
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="error" className="text-sm">
          {error}
        </Alert>
      ) : null}
      {status ? (
        <Alert variant="success" className="text-sm">
          {status}
        </Alert>
      ) : null}
      {Object.entries(grouped).map(([group, items]) =>
        group !== "" ? (
          <FormFieldset key={group} legend={group} className="gap-3">
            {items.map((item) => (
              <GroupedFieldInput
                key={item.key}
                item={item}
                value={readFieldValue(values, item.key)}
                widthClass={fieldWidthClass}
                onChange={(v) => setField(item.key, v)}
              />
            ))}
          </FormFieldset>
        ) : (
          items.map((item) => (
            <FieldInput
              key={item.key}
              item={item}
              value={readFieldValue(values, item.key)}
              widthClass={fieldWidthClass}
              onChange={(v) => setField(item.key, v)}
            />
          ))
        ),
      )}
      <div className="flex flex-wrap gap-2 pt-2">
        {canTest ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={testing || saving}
            onClick={() => void testConnection()}
          >
            {testLabel}
          </Button>
        ) : null}
        {platform === "mobile" || enterAfterSave ? (
          <Button
            type="button"
            size="sm"
            disabled={saving || testing}
            onClick={() => void saveAndEnter()}
          >
            {saving ? "保存中…" : "保存并进入"}
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={saving || testing} onClick={() => void save()}>
            {saving ? "保存中…" : "保存"}
          </Button>
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

const selectClassName =
  "border-input flex h-8 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function GroupedFieldInput({
  item,
  value,
  widthClass,
  onChange,
}: {
  item: FormFieldDescriptor;
  value: unknown;
  widthClass: string;
  onChange: (value: unknown) => void;
}) {
  if (item.type === "boolean") {
    return (
      <FormToggle
        className={widthClass}
        label={item.label}
        hint={item.description}
        checked={Boolean(value)}
        onChange={onChange}
      />
    );
  }

  if (item.type === "select" && item.options) {
    return (
      <div className={widthClass}>
        <FormFieldLabel>{item.label}</FormFieldLabel>
        <select
          className={cn(selectClassName, widthClass)}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {item.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (item.type === "textarea") {
    return (
      <div className={widthClass}>
        <FormFieldLabel>{item.label}</FormFieldLabel>
        <Textarea
          className="w-full"
          rows={4}
          placeholder={item.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className={widthClass}>
      <FormFieldLabel>{item.label}</FormFieldLabel>
      <Input
        type={item.type === "password" ? "password" : item.type === "number" ? "number" : "text"}
        className={widthClass}
        placeholder={item.placeholder}
        value={String(value ?? "")}
        onChange={(e) => onChange(item.type === "number" ? Number(e.target.value) : e.target.value)}
      />
      {item.description ? (
        <p className="text-sm text-muted-foreground">{item.description}</p>
      ) : null}
    </div>
  );
}

function FieldInput({
  item,
  value,
  widthClass,
  onChange,
}: {
  item: FormFieldDescriptor;
  value: unknown;
  widthClass: string;
  onChange: (value: unknown) => void;
}) {
  if (item.type === "boolean") {
    return (
      <FormToggle
        className={widthClass}
        label={item.label}
        hint={item.description}
        checked={Boolean(value)}
        onChange={onChange}
      />
    );
  }

  if (item.type === "select" && item.options) {
    return (
      <FormField className={widthClass} label={item.label}>
        <select
          className={cn(selectClassName, widthClass)}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {item.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormField>
    );
  }

  if (item.type === "textarea") {
    return (
      <FormField className={widthClass} label={item.label}>
        <Textarea
          className="w-full"
          rows={4}
          placeholder={item.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      </FormField>
    );
  }

  return (
    <FormField className={widthClass} label={item.label} hint={item.description}>
      <Input
        type={item.type === "password" ? "password" : item.type === "number" ? "number" : "text"}
        className={widthClass}
        placeholder={item.placeholder}
        value={String(value ?? "")}
        onChange={(e) => onChange(item.type === "number" ? Number(e.target.value) : e.target.value)}
      />
    </FormField>
  );
}

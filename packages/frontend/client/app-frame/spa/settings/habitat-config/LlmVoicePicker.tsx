import { useEffect, useId, useRef, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Label,
} from "@freeanima/ui-kit";
import {
  listHabitatProviderVoices,
  type HabitatProviderVoiceEntry,
} from "@freeanima/client/portal-sdk/habitat-config-api";
import { ChevronDownIcon } from "lucide-react";

/** 按连接 voice_protocol 拉取静态音色目录（与合成模型分维） */
export function LlmVoicePicker({
  providerId,
  model,
  value,
  onChange,
  label = "音色",
  hideLabel = false,
  id,
}: {
  providerId: string;
  /** 合成模型；阿里用于过滤音色 */
  model?: string;
  value: string;
  onChange: (voice: string) => void;
  label?: string;
  /** 由父级 LabelControlRow 画标签时隐藏内置标签 */
  hideLabel?: boolean;
  id?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voices, setVoices] = useState<HabitatProviderVoiceEntry[]>([]);

  const canBrowse = providerId.trim().length > 0;

  useEffect(() => {
    if (!open) return () => {};
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(e.target instanceof Node) || root.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || !canBrowse) return () => {};
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void listHabitatProviderVoices({
        provider_id: providerId.trim(),
        limit: 200,
        ...(model?.trim() ? { model: model.trim() } : {}),
        ...(value.trim() ? { query: value.trim() } : {}),
      })
        .then((res) => {
          if (cancelled) return;
          setVoices(res.voices);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setVoices([]);
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, canBrowse, providerId, model, value]);

  const selected = voices.find((v) => v.id === value);

  return (
    <div className="space-y-1">
      {hideLabel ? null : (
        <Label htmlFor={inputId} className="text-sm">
          {label}
        </Label>
      )}
      <div ref={rootRef} className="relative">
        <InputGroup>
          <InputGroupInput
            id={inputId}
            placeholder="音色 id，例如 longanlingxin / alloy / zh-CN-XiaoxiaoNeural"
            value={value}
            autoComplete="off"
            onChange={(e) => {
              onChange(e.target.value);
              if (canBrowse) setOpen(true);
            }}
            onFocus={() => {
              if (canBrowse) setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
              }
            }}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={open ? "收起音色列表" : "展开音色列表"}
              aria-expanded={open}
              isDisabled={!canBrowse}
              onPress={() => {
                if (!canBrowse) return;
                setOpen((v) => !v);
              }}
            >
              <ChevronDownIcon className={open ? "size-4 rotate-180" : "size-4"} />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>

        {open && canBrowse ? (
          <div
            data-slot="combobox-list"
            className="border-border bg-popover text-popover-foreground absolute top-[calc(100%+0.25rem)] right-0 left-0 z-50 rounded-lg border p-2 shadow-md"
          >
            <p className="text-muted-foreground mb-1 text-xs">内置音色目录（按连接协议）</p>
            {loading ? <p className="text-muted-foreground text-xs">加载中…</p> : null}
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
            {!loading && !error && voices.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                无匹配音色；可手填协议支持的 voice id。
              </p>
            ) : null}
            <ul className="max-h-56 overflow-auto">
              {voices.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="hover:bg-muted w-full rounded-md px-2 py-1.5 text-left text-sm"
                    onClick={() => {
                      onChange(entry.id);
                      setOpen(false);
                    }}
                  >
                    <span className="font-mono">{entry.id}</span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {entry.label}
                      {entry.lang ? ` · ${entry.lang}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {selected ? (
        <p className="text-muted-foreground text-xs">
          {selected.label}
          {selected.lang ? ` · ${selected.lang}` : ""}
        </p>
      ) : null}
    </div>
  );
}

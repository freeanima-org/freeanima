import { useEffect, useId, useRef, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Label,
} from "@freeanima/ui-kit";
import {
  listHabitatProviderModels,
  type HabitatProviderModelEntry,
} from "@freeanima/client/portal-sdk/habitat-config-api";
import { ChevronDownIcon } from "lucide-react";

function formatContext(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

function formatCost(cost: HabitatProviderModelEntry["cost"]): string | null {
  if (!cost || (cost.input == null && cost.output == null)) return null;
  const inP = cost.input != null ? `$${cost.input}` : "?";
  const outP = cost.output != null ? `$${cost.output}` : "?";
  return `${inP}/${outP}/1M`;
}

function modelSubtitle(entry: HabitatProviderModelEntry): string {
  const parts = [`ctx ${formatContext(entry.contextWindow)}`];
  const cost = formatCost(entry.cost);
  if (cost) parts.push(cost);
  return parts.join(" · ");
}

/** 可搜索 Combobox：同一输入框既手填又过滤下拉，无第二层搜索框。 */
export function LlmModelPicker({
  providerId,
  value,
  onChange,
}: {
  providerId: string;
  value: string;
  onChange: (model: string) => void;
}) {
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [models, setModels] = useState<HabitatProviderModelEntry[]>([]);
  const [source, setSource] = useState<"provider" | "models_dev" | null>(null);

  const canBrowse = providerId.trim().length > 0;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(e.target instanceof Node) || root.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || !canBrowse) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void listHabitatProviderModels({
        provider_id: providerId.trim(),
        limit: 200,
        ...(value.trim() ? { query: value.trim() } : {}),
      })
        .then((res) => {
          if (cancelled) return;
          setModels(res.models);
          setSource(res.source);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setModels([]);
          setSource(null);
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
  }, [open, canBrowse, providerId, value]);

  const selectedMeta = models.find((m) => m.model === value);

  return (
    <div className="space-y-1">
      <Label htmlFor={inputId} className="text-sm">
        模型
      </Label>
      <div ref={rootRef} className="relative">
        <InputGroup>
          <InputGroupInput
            id={inputId}
            placeholder="供应方模型 id，例如 deepseek-chat"
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
              aria-label={open ? "收起模型列表" : "展开模型列表"}
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
            {source ? (
              <p className="text-muted-foreground mb-1 text-xs">
                {source === "provider"
                  ? "来自连接 /models（含 models.dev 元数据）"
                  : "来自 models.dev 回退目录"}
              </p>
            ) : null}
            {loading ? <p className="text-muted-foreground text-xs">加载中…</p> : null}
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
            {!loading && !error && models.length === 0 ? (
              <p className="text-muted-foreground text-xs">无匹配模型；可继续手填任意 id。</p>
            ) : null}
            <ul className="h-60 overflow-y-auto">
              {models.map((entry) => (
                <li key={entry.model}>
                  <button
                    type="button"
                    className="hover:bg-accent flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(entry.model);
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium">{entry.label || entry.model}</span>
                    <span className="text-muted-foreground text-xs">
                      {entry.model}
                      {" · "}
                      {modelSubtitle(entry)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        {canBrowse
          ? selectedMeta
            ? `已选：${modelSubtitle(selectedMeta)}；输入即可过滤或手填`
            : "输入过滤列表，或手填任意供应方模型 id"
          : "请先选择连接后再展开列表；仍可手填模型 id"}
      </p>
    </div>
  );
}

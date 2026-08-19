import { useState } from "react";
import {
  Button,
  Popover,
  PopoverDialog,
  PopoverTrigger,
  useCompactLayout,
} from "@freeanima/ui-kit";
import { ModalSheetPresent } from "@freeanima/ui-kit/composite";
import {
  contextUsageRatio,
  formatTokenK,
  formatUsageTriplet,
  type ConversationContextUsage,
  type LlmUsageTotals,
  type RuntimeContextBreakdown,
} from "@freeanima/shared/llm-usage";

const BREAKDOWN_ROWS: Array<{
  key: keyof RuntimeContextBreakdown;
  label: string;
  color: string;
}> = [
  { key: "system_self", label: "自我层", color: "bg-muted-foreground" },
  { key: "system_agents", label: "AGENTS.md", color: "bg-sky-500" },
  { key: "system_resident", label: "常驻记忆", color: "bg-emerald-500" },
  { key: "system_toolsets", label: "工具集", color: "bg-amber-500" },
  { key: "tools", label: "工具 schema", color: "bg-violet-500" },
  { key: "summary", label: "会话摘要", color: "bg-orange-500" },
  { key: "messages", label: "对话消息", color: "bg-rose-500" },
];

export type ChatContextUsageProps = {
  context: ConversationContextUsage | null;
  usage: LlmUsageTotals | null;
};

export function ContextUsageRing({
  ratio,
  size,
  "aria-hidden": ariaHidden,
}: {
  ratio: number;
  size: number;
  "aria-hidden"?: boolean;
}) {
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, ratio));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      {...(ariaHidden ? { "aria-hidden": true } : {})}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        className="text-muted-foreground/30"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        className={clamped >= 0.8 ? "text-destructive" : "text-primary"}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function ContextUsagePanel({
  context,
  usage,
}: {
  context: ConversationContextUsage;
  usage: LlmUsageTotals | null;
}) {
  const ratio = contextUsageRatio(context.used, context.window);
  const windowLabel = context.window != null ? formatTokenK(context.window) : "—";
  const pct = Math.round(ratio * 100);
  const visibleRows = BREAKDOWN_ROWS.filter((row) => context.breakdown[row.key] > 0);
  const barTotal = Math.max(context.used, 1);

  return (
    <div className="w-[min(22rem,calc(100vw-2rem))] space-y-3 p-3">
      <div className="flex items-center gap-3">
        <ContextUsageRing ratio={ratio} size={36} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{"上下文用量"}</p>
          <p className="text-xs text-muted-foreground">
            {`${String(pct)}% · 约 ${formatTokenK(context.used)} / ${windowLabel}`}
          </p>
        </div>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        {visibleRows.map((row) => (
          <div
            key={row.key}
            className={row.color}
            style={{ width: `${(context.breakdown[row.key] / barTotal) * 100}%` }}
          />
        ))}
      </div>
      <ul className="space-y-1">
        {visibleRows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-xs">
            <span className={`size-2 shrink-0 rounded-sm ${row.color}`} />
            <span className="flex-1 text-muted-foreground">{row.label}</span>
            <span className="font-mono">{formatTokenK(context.breakdown[row.key])}</span>
          </li>
        ))}
      </ul>
      {usage ? (
        <div className="border-t border pt-2">
          <p className="text-xs font-medium mb-1">{"本对话用量"}</p>
          <p className="text-xs text-muted-foreground font-mono">{formatUsageTriplet(usage)}</p>
        </div>
      ) : null}
    </div>
  );
}

function RingTriggerButton({
  ratio,
  compact,
  onPress,
}: {
  ratio: number;
  compact: boolean;
  onPress?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon-lg" : "icon-sm"}
      className={
        compact
          ? "size-11 rounded-full bg-background/80 shadow-sm"
          : "rounded-full bg-background/80 shadow-sm"
      }
      aria-label={"上下文用量"}
      {...(onPress ? { onPress } : {})}
    >
      <ContextUsageRing ratio={ratio} size={compact ? 22 : 18} aria-hidden />
    </Button>
  );
}

export function ChatContextUsageButton({ context, usage }: ChatContextUsageProps) {
  const compact = useCompactLayout();
  const [open, setOpen] = useState(false);
  if (!context) return null;
  const ratio = contextUsageRatio(context.used, context.window);

  if (compact) {
    return (
      <>
        <RingTriggerButton ratio={ratio} compact onPress={() => setOpen(true)} />
        <ModalSheetPresent
          open={open}
          onClose={() => setOpen(false)}
          aria-label={"上下文用量"}
          showCloseButton
        >
          <ContextUsagePanel context={context} usage={usage} />
        </ModalSheetPresent>
      </>
    );
  }

  return (
    <PopoverTrigger>
      <RingTriggerButton ratio={ratio} compact={false} />
      <Popover placement="top end" className="p-0">
        <PopoverDialog>
          <ContextUsagePanel context={context} usage={usage} />
        </PopoverDialog>
      </Popover>
    </PopoverTrigger>
  );
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@freeanima/ui-kit";

import {
  formatAgentSubjectLabel,
  type AgentSubjectOption,
} from "@freeanima/features/chat/ui/spa/lib/agent-subjects.ts";

type ConversationAnimaControlProps = {
  agentSubjectId?: number;
  agentTitle?: string;
  agents: AgentSubjectOption[];
  /** 空会话可改绑；有用户消息则只读 */
  canChange: boolean;
  changing?: boolean;
  onChange?: (agentSubjectId: number) => void;
  className?: string;
  /** 紧凑工具条（Coding） */
  compact?: boolean;
};

export function ConversationAnimaControl({
  agentSubjectId,
  agentTitle,
  agents,
  canChange,
  changing = false,
  onChange,
  className,
  compact = false,
}: ConversationAnimaControlProps) {
  const label = formatAgentSubjectLabel(agentSubjectId, agentTitle, agents);
  if (agentSubjectId == null && !canChange) return null;

  if (!canChange) {
    if (!label) return null;
    return (
      <span
        className={cn("truncate text-xs text-muted-foreground", className)}
        title={`Anima：${label}`}
      >
        {compact ? label : `Anima · ${label}`}
      </span>
    );
  }

  const selectedKey = agentSubjectId != null ? String(agentSubjectId) : null;
  const options =
    agentSubjectId != null && !agents.some((a) => a.id === agentSubjectId)
      ? [{ id: agentSubjectId, title: label || `#${agentSubjectId}` }, ...agents]
      : agents;

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      {!compact ? <span className="shrink-0 text-xs text-muted-foreground">Anima</span> : null}
      <Select
        selectedKey={selectedKey}
        isDisabled={changing || options.length === 0}
        aria-label="选择 Anima"
        onSelectionChange={(key) => {
          if (key == null || changing) return;
          const id = Number(String(key));
          if (!Number.isInteger(id) || id <= 0) return;
          if (id === agentSubjectId) return;
          onChange?.(id);
        }}
      >
        <SelectTrigger
          size="sm"
          className={cn("min-w-0", compact ? "h-7 max-w-40" : "h-7 max-w-48")}
        >
          <SelectValue placeholder="选择 Anima" />
        </SelectTrigger>
        <SelectContent>
          {options.map((a) => (
            <SelectItem key={a.id} id={String(a.id)}>
              {formatAgentSubjectLabel(a.id, a.title)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

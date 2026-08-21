import { useState, type ReactNode } from "react";
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger, cn } from "@freeanima/ui-kit";
import { ChevronRight } from "lucide-react";

import type { CalendarRangeItem } from "../lib/api.ts";
import {
  agendaDayHasItems,
  structureAgendaDay,
  type AgendaProjectGroup,
} from "../lib/agenda-items.ts";
import { AgendaList } from "./AgendaList.tsx";

type AgendaHandlers = {
  onOpenEvent: (id: number) => void;
  onOpenTask: (id: number) => void;
  onOpenProject: (id: number) => void;
  onEditEvent: (id: number) => void;
  onOpenHoliday: (item: Extract<CalendarRangeItem, { kind: "holiday" }>) => void;
};

type AgendaDayViewProps = AgendaHandlers & {
  day: string;
  today: string;
  items: CalendarRangeItem[];
  emptyLabel?: string;
};

function SectionHeading({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "destructive";
}) {
  return (
    <h3
      className={cn(
        "text-xs font-medium",
        tone === "destructive" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </h3>
  );
}

function ProjectGroupRow({
  day,
  group,
  handlers,
}: {
  day: string;
  group: AgendaProjectGroup;
  handlers: AgendaHandlers;
}) {
  const hasPendingChild = group.children.some(
    (item) => item.kind === "task" && item.status !== "completed",
  );
  const [expanded, setExpanded] = useState(hasPendingChild);
  const childCount = group.children.length;

  return (
    <Collapsible isExpanded={expanded} onExpandedChange={setExpanded}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          {childCount > 0 ? (
            <CollapsibleTrigger
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60"
              aria-label={expanded ? "折叠项目任务" : "展开项目任务"}
            >
              <ChevronRight
                className={cn("size-4 transition-transform", expanded && "rotate-90")}
                aria-hidden
              />
            </CollapsibleTrigger>
          ) : (
            <span className="size-8 shrink-0" aria-hidden />
          )}
          <Button
            type="button"
            variant="outline"
            className="h-auto min-w-0 flex-1 justify-start gap-3 px-3 py-2 text-left"
            onPress={() => handlers.onOpenProject(group.projectId)}
          >
            <span className="size-2 shrink-0" aria-hidden />
            <span className="w-12 shrink-0 text-xs text-muted-foreground">项目</span>
            <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-sky-700 dark:text-sky-300">
              项目
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{group.title}</span>
            {childCount > 0 ? (
              <span className="shrink-0 text-xs text-muted-foreground">{childCount}</span>
            ) : null}
          </Button>
        </div>
        {childCount > 0 ? (
          <CollapsibleContent>
            <div className="ml-6 border-l border-border/60 pl-2">
              <AgendaList day={day} items={group.children} {...handlers} />
            </div>
          </CollapsibleContent>
        ) : null}
      </div>
    </Collapsible>
  );
}

export function AgendaDayView({
  day,
  today,
  items,
  emptyLabel = "当天暂无条目",
  onOpenEvent,
  onOpenTask,
  onOpenProject,
  onEditEvent,
  onOpenHoliday,
}: AgendaDayViewProps) {
  const handlers = { onOpenEvent, onOpenTask, onOpenProject, onEditEvent, onOpenHoliday };
  const sections = structureAgendaDay(items, day, today);

  if (!agendaDayHasItems(sections)) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {sections.overdue.length > 0 ? (
        <div className="flex flex-col gap-2">
          <SectionHeading tone="destructive">逾期</SectionHeading>
          {/* 不传 day：逾期任务不一定与当日重叠，AgendaList 按日过滤会把它们滤掉 */}
          <AgendaList items={sections.overdue} showDueChip emptyLabel="无逾期任务" {...handlers} />
        </div>
      ) : null}

      {sections.schedule.length > 0 ? (
        <div className="flex flex-col gap-2">
          <SectionHeading>安排</SectionHeading>
          <AgendaList day={day} items={sections.schedule} {...handlers} />
        </div>
      ) : null}

      {sections.projectGroups.length > 0 ? (
        <div className="flex flex-col gap-3">
          <SectionHeading>项目</SectionHeading>
          {sections.projectGroups.map((group) => (
            <ProjectGroupRow key={group.projectId} day={day} group={group} handlers={handlers} />
          ))}
        </div>
      ) : null}

      {sections.holidays.length > 0 ? (
        <div className="flex flex-col gap-2">
          <SectionHeading>节日</SectionHeading>
          <AgendaList day={day} items={sections.holidays} {...handlers} />
        </div>
      ) : null}

      {sections.completed.length > 0 ? (
        <div className="flex flex-col gap-2">
          <SectionHeading>已完成 · {sections.completed.length}</SectionHeading>
          <AgendaList day={day} items={sections.completed} {...handlers} />
        </div>
      ) : null}
    </div>
  );
}

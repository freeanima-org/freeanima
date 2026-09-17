import { Button } from "@freeanima/ui-kit";
import { PlusIcon } from "lucide-react";

import { dayHeadingLabel } from "../lib/format-calendar.ts";

type AgendaDayHeaderProps = {
  day: string;
  today: string;
  onCreateEvent: (day: string) => void;
  onCreateTask: (day: string) => void;
  className?: string;
};

export function AgendaDayHeader({
  day,
  today,
  onCreateEvent,
  onCreateTask,
  className,
}: AgendaDayHeaderProps) {
  return (
    <div className={className ?? "flex items-center gap-2"}>
      <h2 className="min-w-0 flex-1 text-sm font-medium text-muted-foreground">
        {dayHeadingLabel(day, today)}
      </h2>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button type="button" size="sm" variant="outline" onPress={() => onCreateEvent(day)}>
          <PlusIcon className="size-3.5" />
          {"新建事件"}
        </Button>
        <Button type="button" size="sm" variant="outline" onPress={() => onCreateTask(day)}>
          <PlusIcon className="size-3.5" />
          {"新建任务"}
        </Button>
      </div>
    </div>
  );
}

import { FormFieldLabel } from "@freeanima/frontend/ui-kit/form/FormFieldset.tsx";
import { DatePickerInput } from "@freeanima/frontend/ui-kit/form/DatePickerInput.tsx";

import type { ProjectRow } from "../lib/api.ts";
import { isoToDateLocalValue } from "../lib/format-task.ts";

type ProjectDetailHeaderProps = {
  project: ProjectRow;
  writesDisabled: boolean;
  onDatesChange: (startLocal: string, endLocal: string) => void;
};

export function ProjectDetailHeader({
  project,
  writesDisabled,
  onDatesChange,
}: ProjectDetailHeaderProps) {
  const startLocal = isoToDateLocalValue(project.start_at);
  const endLocal = isoToDateLocalValue(project.end_at);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FormFieldLabel>开始日期</FormFieldLabel>
          <DatePickerInput
            value={startLocal}
            disabled={writesDisabled}
            aria-label="开始日期"
            onChange={(next) => onDatesChange(next, endLocal)}
          />
        </div>
        <div>
          <FormFieldLabel>结束日期</FormFieldLabel>
          <DatePickerInput
            value={endLocal}
            disabled={writesDisabled}
            aria-label="结束日期"
            onChange={(next) => onDatesChange(startLocal, next)}
          />
        </div>
      </div>
      <div>
        <FormFieldLabel>完成标准</FormFieldLabel>
        <p className="text-sm">{project.completion_criteria}</p>
      </div>
    </div>
  );
}

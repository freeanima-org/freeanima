import type { JSX } from "react";

import { CONTENT_BLOCK_COMPONENT } from "@freeanima/host/core/db/schema";
import { useTouchPrimaryCapability } from "@freeanima/client/portal-sdk/react";
import { cn } from "@freeanima/ui-kit";
import { TagPicker } from "@freeanima/features/tag/ui/spa/components/TagPicker.tsx";

type BlockTagPickerProps = {
  tagIds: number[];
  onChange: (tagIds: number[]) => void;
  /** 无标签时是否仍渲染触发按钮（快捷操作入口） */
  alwaysShowTrigger?: boolean;
  readOnly?: boolean;
};

export function BlockTagPicker({
  tagIds,
  onChange,
  alwaysShowTrigger = false,
  readOnly = false,
}: BlockTagPickerProps): JSX.Element | null {
  const touchPrimary = useTouchPrimaryCapability();
  return (
    <div className="flex flex-col gap-1 px-1">
      <TagPicker
        primaryComponent={CONTENT_BLOCK_COMPONENT}
        tagIds={tagIds}
        onChange={onChange}
        mode="multi"
        readOnly={readOnly}
        alwaysShowTrigger={alwaysShowTrigger}
        hideWhenEmpty
        triggerClassName={cn(
          "aria-expanded:opacity-100",
          touchPrimary ? "" : "opacity-0 group-hover:opacity-100",
        )}
      />
    </div>
  );
}

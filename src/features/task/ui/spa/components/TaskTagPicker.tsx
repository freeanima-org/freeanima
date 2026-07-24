import type { JSX } from "react";

import { TASK_ITEM_COMPONENT } from "@freeanima/core/db/schema";
import { TagPicker, type TagKnown } from "@freeanima/features/tag/ui/spa/components/TagPicker.tsx";

/** @deprecated 请用 TagKnown；保留兼容 TaskApp / ProjectApp */
export type TaskTagKnown = TagKnown;

type TaskTagPickerProps = {
  tagIds: number[];
  onChange: (tagIds: number[]) => void;
  /** 新建标签成功后同步给父层，避免筛选栏/行内标题滞后显示裸 id */
  onTagKnown?: (tag: TaskTagKnown) => void;
};

export function TaskTagPicker({ tagIds, onChange, onTagKnown }: TaskTagPickerProps): JSX.Element {
  return (
    <TagPicker
      primaryComponent={TASK_ITEM_COMPONENT}
      tagIds={tagIds}
      onChange={onChange}
      mode="multi"
      {...(onTagKnown ? { onTagKnown } : {})}
    />
  );
}

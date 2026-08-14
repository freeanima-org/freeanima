import * as React from "react";
import { PopoverContext as RacPopoverContext } from "react-aria-components";
import type { PopoverProps } from "react-aria-components";

export type AriaPopoverAnchorContext = Partial<PopoverProps> & {
  x?: number;
  y?: number;
  triggerRef?: React.RefObject<HTMLDivElement | null>;
};

/**
 * RAC PopoverContext 在 type-aware lint 下易 error 化；
 * 经 unknown 拓宽后再收窄为锚定用 Context（单一边界）。
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RAC Context 运行时边界
export const AriaPopoverContext =
  RacPopoverContext as unknown as React.Context<AriaPopoverAnchorContext | null>;

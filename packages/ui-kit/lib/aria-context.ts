import * as React from "react";
import { PopoverContext as RacPopoverContext } from "react-aria-components";
import type { PopoverProps } from "react-aria-components";

import { assertNarrow } from "@freeanima/shared/assert-narrow.ts";

export type AriaPopoverAnchorContext = Partial<PopoverProps> & {
  x?: number;
  y?: number;
  triggerRef?: React.RefObject<HTMLDivElement | null>;
};

/** RAC PopoverContext 在 type-aware lint 下易 error 化；经 assertNarrow 单点收窄。 */
export const AriaPopoverContext =
  assertNarrow<React.Context<AriaPopoverAnchorContext | null>>(RacPopoverContext);

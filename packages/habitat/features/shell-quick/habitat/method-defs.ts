import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";
import {
  shellQuickAttachInputSchema,
  shellQuickAttachOutputSchema,
  shellQuickDetachInputSchema,
  shellQuickDetachOutputSchema,
  shellQuickListInputSchema,
  shellQuickListOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/shell-quick";

export const shellQuickMethodDefs = {
  "shell_quick.list": defineHabitatMethod({
    input: shellQuickListInputSchema,
    output: shellQuickListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "shell_quick.attach": defineHabitatMethod({
    input: shellQuickAttachInputSchema,
    output: shellQuickAttachOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "shell_quick.detach": defineHabitatMethod({
    input: shellQuickDetachInputSchema,
    output: shellQuickDetachOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;

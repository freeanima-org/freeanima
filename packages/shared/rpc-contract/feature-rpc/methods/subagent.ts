/** Feature Habitat RPC method defs（契约 SSOT —— 由 features/subagent/habitat/method-defs.ts 上提）。 */
import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";
import {
  subagentCreateInputSchema,
  subagentCreateOutputSchema,
  subagentDeleteInputSchema,
  subagentDeleteOutputSchema,
  subagentGetInputSchema,
  subagentGetOutputSchema,
  subagentListInputSchema,
  subagentListOutputSchema,
  subagentPatchInputSchema,
  subagentPatchOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/subagent";

export const subagentMethodDefs = {
  "subagent.list": defineHabitatMethod({
    input: subagentListInputSchema,
    output: subagentListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "subagent.get": defineHabitatMethod({
    input: subagentGetInputSchema,
    output: subagentGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "subagent.create": defineHabitatMethod({
    input: subagentCreateInputSchema,
    output: subagentCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "subagent.patch": defineHabitatMethod({
    input: subagentPatchInputSchema,
    output: subagentPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "subagent.delete": defineHabitatMethod({
    input: subagentDeleteInputSchema,
    output: subagentDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;

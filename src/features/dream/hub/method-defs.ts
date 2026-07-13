import {
  dreamGetInputSchema,
  dreamGetOutputSchema,
  dreamListInputSchema,
  dreamListOutputSchema,
} from "@freeanima/shared/sap-contract/frames/dream";

import { defineHubMethod, dualTransportMeta } from "@freeanima/shared/hub-contract";

export const dreamMethodDefs = {
  "dream.list": defineHubMethod({
    input: dreamListInputSchema,
    output: dreamListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "dream.get": defineHubMethod({
    input: dreamGetInputSchema,
    output: dreamGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;

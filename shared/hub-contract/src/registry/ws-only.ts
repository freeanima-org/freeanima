import {
  sapAttachPayloadSchema,
  sapAttachOutputSchema,
} from "@freeanima/sap-contract/frames/sap-session";
import {
  toolErrorInputSchema,
  toolRegisterInputSchema,
  toolRegisterOutputSchema,
  toolResultInputSchema,
  toolUnregisterInputSchema,
} from "@freeanima/sap-contract/frames/tool";
import {
  terminalAttachInputSchema,
  terminalAttachOutputSchema,
  terminalCloseInputSchema,
  terminalResizeInputSchema,
  terminalWriteInputSchema,
} from "@freeanima/sap-contract/frames/terminal";
import { z } from "zod";

import { defineHubMethod, wsOnlyMeta } from "../method-def.ts";

const okSchema = z.object({ ok: z.literal(true) });
const sapDetachInputSchema = z.object({}).strict();

export const wsOnlyMethodDefs = {
  "sap.attach": defineHubMethod({
    input: sapAttachPayloadSchema,
    output: sapAttachOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "sap.detach": defineHubMethod({
    input: sapDetachInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
  }),
  "tool.register": defineHubMethod({
    input: toolRegisterInputSchema,
    output: toolRegisterOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "tool.unregister": defineHubMethod({
    input: toolUnregisterInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
  }),
  "tool.result": defineHubMethod({
    input: toolResultInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
  }),
  "tool.error": defineHubMethod({
    input: toolErrorInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
  }),
  "terminal.attach": defineHubMethod({
    input: terminalAttachInputSchema,
    output: terminalAttachOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "terminal.write": defineHubMethod({
    input: terminalWriteInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
  }),
  "terminal.resize": defineHubMethod({
    input: terminalResizeInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
  }),
  "terminal.close": defineHubMethod({
    input: terminalCloseInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
  }),
} as const;

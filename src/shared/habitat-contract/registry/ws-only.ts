import {
  sapAttachPayloadSchema,
  sapAttachOutputSchema,
} from "@freeanima/shared/sap-contract/frames/sap-session";
import {
  toolErrorInputSchema,
  toolRegisterInputSchema,
  toolRegisterOutputSchema,
  toolResultInputSchema,
  toolUnregisterInputSchema,
} from "@freeanima/shared/sap-contract/frames/tool";
import {
  terminalAttachInputSchema,
  terminalAttachOutputSchema,
  terminalCloseInputSchema,
  terminalResizeInputSchema,
  terminalWriteInputSchema,
} from "@freeanima/shared/sap-contract/frames/terminal";
import { z } from "zod";

import { defineHabitatMethod, wsOnlyMeta } from "../method-def.ts";

const okSchema = z.object({ ok: z.literal(true) });
const sapDetachInputSchema = z.object({}).strict();

export const wsOnlyMethodDefs = {
  "sap.attach": defineHabitatMethod({
    input: sapAttachPayloadSchema,
    output: sapAttachOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "sap.detach": defineHabitatMethod({
    input: sapDetachInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
  }),
  "tool.register": defineHabitatMethod({
    input: toolRegisterInputSchema,
    output: toolRegisterOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "tool.unregister": defineHabitatMethod({
    input: toolUnregisterInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
  }),
  "tool.result": defineHabitatMethod({
    input: toolResultInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
  }),
  "tool.error": defineHabitatMethod({
    input: toolErrorInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
  }),
  "terminal.attach": defineHabitatMethod({
    input: terminalAttachInputSchema,
    output: terminalAttachOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "terminal.write": defineHabitatMethod({
    input: terminalWriteInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
  }),
  "terminal.resize": defineHabitatMethod({
    input: terminalResizeInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
  }),
  "terminal.close": defineHabitatMethod({
    input: terminalCloseInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
  }),
} as const;

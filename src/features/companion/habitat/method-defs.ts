import {
  companionConfigGetInputSchema,
  companionConfigGetOutputSchema,
  companionConfigUpdateInputSchema,
  companionConfigUpdateOutputSchema,
  companionMigrateFromLocalInputSchema,
  companionMigrateFromLocalOutputSchema,
  companionModelDeleteInputSchema,
  companionModelDeleteOutputSchema,
  companionModelRenameInputSchema,
  companionModelRenameOutputSchema,
  companionModelReorderInputSchema,
  companionModelReorderOutputSchema,
  companionModelSetActiveInputSchema,
  companionModelSetActiveOutputSchema,
  companionMotionDeleteInputSchema,
  companionMotionDeleteOutputSchema,
  companionMotionRenameInputSchema,
  companionMotionRenameOutputSchema,
  companionMotionReorderInputSchema,
  companionMotionReorderOutputSchema,
  companionMotionSetSlotInputSchema,
  companionMotionSetSlotOutputSchema,
  companionSyncPullInputSchema,
  companionSyncPullOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/companion";
import { z } from "zod";

import {
  binaryHttpMeta,
  defineHabitatMethod,
  dualTransportMeta,
} from "@freeanima/shared/habitat-contract";

const emptyInputSchema = z.object({}).passthrough();
const companionUploadOkOutputSchema = z.object({ ok: z.literal(true) });

export const companionMethodDefs = {
  "companion.config.get": defineHabitatMethod({
    input: companionConfigGetInputSchema,
    output: companionConfigGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "companion.config.update": defineHabitatMethod({
    input: companionConfigUpdateInputSchema,
    output: companionConfigUpdateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.model.setActive": defineHabitatMethod({
    input: companionModelSetActiveInputSchema,
    output: companionModelSetActiveOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.model.rename": defineHabitatMethod({
    input: companionModelRenameInputSchema,
    output: companionModelRenameOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.model.delete": defineHabitatMethod({
    input: companionModelDeleteInputSchema,
    output: companionModelDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.model.reorder": defineHabitatMethod({
    input: companionModelReorderInputSchema,
    output: companionModelReorderOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.motion.setSlot": defineHabitatMethod({
    input: companionMotionSetSlotInputSchema,
    output: companionMotionSetSlotOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.motion.rename": defineHabitatMethod({
    input: companionMotionRenameInputSchema,
    output: companionMotionRenameOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.motion.delete": defineHabitatMethod({
    input: companionMotionDeleteInputSchema,
    output: companionMotionDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.motion.reorder": defineHabitatMethod({
    input: companionMotionReorderInputSchema,
    output: companionMotionReorderOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.migrate.fromLocal": defineHabitatMethod({
    input: companionMigrateFromLocalInputSchema,
    output: companionMigrateFromLocalOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.sync.pull": defineHabitatMethod({
    input: companionSyncPullInputSchema,
    output: companionSyncPullOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "companion.model.upload": defineHabitatMethod({
    input: emptyInputSchema,
    output: companionUploadOkOutputSchema,
    meta: binaryHttpMeta({
      verb: "POST",
      path: "companion/model/upload",
      request: "multipart",
    }),
  }),
  "companion.motion.import": defineHabitatMethod({
    input: emptyInputSchema,
    output: z.record(z.string(), z.unknown()),
    meta: binaryHttpMeta({
      verb: "POST",
      path: "companion/motion/import",
      request: "multipart",
    }),
  }),
} as const;

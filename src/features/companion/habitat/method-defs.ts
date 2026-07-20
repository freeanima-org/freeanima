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
  companionModelSetActiveInputSchema,
  companionModelSetActiveOutputSchema,
  companionMotionDeleteInputSchema,
  companionMotionDeleteOutputSchema,
  companionMotionRenameInputSchema,
  companionMotionRenameOutputSchema,
  companionMotionSetSlotInputSchema,
  companionMotionSetSlotOutputSchema,
  companionSyncPullInputSchema,
  companionSyncPullOutputSchema,
} from "@freeanima/shared/sap-contract/frames/companion";
import { z } from "zod";

import {
  binaryHttpMeta,
  defineHubMethod,
  dualTransportMeta,
} from "@freeanima/shared/habitat-contract";

const emptyInputSchema = z.object({}).passthrough();
const companionAssetGetInputSchema = z.object({
  kind: z.enum(["models", "motions"]),
  fileName: z.string().min(1),
});
const companionUploadOkOutputSchema = z.object({ ok: z.literal(true) });

export const companionMethodDefs = {
  "companion.config.get": defineHubMethod({
    input: companionConfigGetInputSchema,
    output: companionConfigGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "companion.config.update": defineHubMethod({
    input: companionConfigUpdateInputSchema,
    output: companionConfigUpdateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.model.setActive": defineHubMethod({
    input: companionModelSetActiveInputSchema,
    output: companionModelSetActiveOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.model.rename": defineHubMethod({
    input: companionModelRenameInputSchema,
    output: companionModelRenameOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.model.delete": defineHubMethod({
    input: companionModelDeleteInputSchema,
    output: companionModelDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.motion.setSlot": defineHubMethod({
    input: companionMotionSetSlotInputSchema,
    output: companionMotionSetSlotOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.motion.rename": defineHubMethod({
    input: companionMotionRenameInputSchema,
    output: companionMotionRenameOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.motion.delete": defineHubMethod({
    input: companionMotionDeleteInputSchema,
    output: companionMotionDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.migrate.fromLocal": defineHubMethod({
    input: companionMigrateFromLocalInputSchema,
    output: companionMigrateFromLocalOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.sync.pull": defineHubMethod({
    input: companionSyncPullInputSchema,
    output: companionSyncPullOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "companion.asset.get": defineHubMethod({
    input: companionAssetGetInputSchema,
    output: z.record(z.string(), z.unknown()),
    meta: binaryHttpMeta({
      verb: "GET",
      path: "companion/assets/:kind/:fileName",
      pathParams: ["kind", "fileName"],
      response: "raw",
    }),
  }),
  "companion.model.upload": defineHubMethod({
    input: emptyInputSchema,
    output: companionUploadOkOutputSchema,
    meta: binaryHttpMeta({
      verb: "POST",
      path: "companion/model/upload",
      request: "multipart",
    }),
  }),
  "companion.motion.import": defineHubMethod({
    input: emptyInputSchema,
    output: z.record(z.string(), z.unknown()),
    meta: binaryHttpMeta({
      verb: "POST",
      path: "companion/motion/import",
      request: "multipart",
    }),
  }),
} as const;

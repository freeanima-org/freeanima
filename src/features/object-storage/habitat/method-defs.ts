import { z } from "zod";
import { binaryHttpMeta, defineHabitatMethod } from "@freeanima/shared/habitat-contract";

export const objectStorageMethodDefs = {
  "object_storage.file.get": defineHabitatMethod({
    input: z.object({ id: z.number().int().positive() }),
    output: z.record(z.string(), z.unknown()),
    meta: binaryHttpMeta({
      verb: "GET",
      path: "object_storage/file/:id",
      pathParams: ["id"],
      response: "raw",
    }),
  }),
} as const;

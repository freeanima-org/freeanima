import {
  defineHabitatMethod,
  dualTransportMeta,
  binaryHttpMeta,
} from "@freeanima/shared/habitat-contract";
import { HABITAT_RPC_BINARY_TRANSFER_TIMEOUT_MS } from "@freeanima/shared/habitat-rpc";
import {
  healthAttachFilesInputSchema,
  healthAttachFilesOutputSchema,
  healthCreateInputSchema,
  healthCreateOutputSchema,
  healthDeleteInputSchema,
  healthDeleteOutputSchema,
  healthFileUploadOutputSchema,
  healthGetInputSchema,
  healthGetOutputSchema,
  healthListInputSchema,
  healthListOutputSchema,
  healthMetricsSeriesInputSchema,
  healthMetricsSeriesOutputSchema,
  healthPatchInputSchema,
  healthPatchOutputSchema,
  healthSearchInputSchema,
  healthSearchOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/health.ts";
import { z } from "zod";

export const healthMethodDefs = {
  "health.list": defineHabitatMethod({
    input: healthListInputSchema,
    output: healthListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "health.get": defineHabitatMethod({
    input: healthGetInputSchema,
    output: healthGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "health.search": defineHabitatMethod({
    input: healthSearchInputSchema,
    output: healthSearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "health.create": defineHabitatMethod({
    input: healthCreateInputSchema,
    output: healthCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "health.patch": defineHabitatMethod({
    input: healthPatchInputSchema,
    output: healthPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "health.delete": defineHabitatMethod({
    input: healthDeleteInputSchema,
    output: healthDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "health.metrics.series": defineHabitatMethod({
    input: healthMetricsSeriesInputSchema,
    output: healthMetricsSeriesOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "health.attachFiles": defineHabitatMethod({
    input: healthAttachFilesInputSchema,
    output: healthAttachFilesOutputSchema,
    meta: binaryHttpMeta({
      verb: "POST",
      path: "health/attachFiles",
      request: "multipart",
      timeoutMs: HABITAT_RPC_BINARY_TRANSFER_TIMEOUT_MS,
    }),
  }),
  "health.file.upload": defineHabitatMethod({
    input: z.object({ subject_id: z.number().int().positive() }),
    output: healthFileUploadOutputSchema,
    meta: binaryHttpMeta({
      verb: "POST",
      path: "health/file/upload",
      request: "multipart",
      timeoutMs: HABITAT_RPC_BINARY_TRANSFER_TIMEOUT_MS,
    }),
  }),
} as const;

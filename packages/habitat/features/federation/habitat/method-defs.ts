import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";
import {
  federationPingInputSchema,
  federationPingOutputSchema,
  federationSatelliteApproveInputSchema,
  federationSatelliteApproveOutputSchema,
  federationSatelliteCreateInputSchema,
  federationSatelliteCreateOutputSchema,
  federationSatelliteListInputSchema,
  federationSatelliteListOutputSchema,
  federationSatelliteRejectInputSchema,
  federationSatelliteRejectOutputSchema,
  federationSatelliteRevokeInputSchema,
  federationSatelliteRevokeOutputSchema,
  federationStatusOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/federation.ts";
import { z } from "zod";

export const federationMethodDefs = {
  "federation.status": defineHabitatMethod({
    input: z.object({}),
    output: federationStatusOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "federation.satellite.list": defineHabitatMethod({
    input: federationSatelliteListInputSchema,
    output: federationSatelliteListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "federation.satellite.create": defineHabitatMethod({
    input: federationSatelliteCreateInputSchema,
    output: federationSatelliteCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "federation.satellite.revoke": defineHabitatMethod({
    input: federationSatelliteRevokeInputSchema,
    output: federationSatelliteRevokeOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "federation.satellite.approve": defineHabitatMethod({
    input: federationSatelliteApproveInputSchema,
    output: federationSatelliteApproveOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "federation.satellite.reject": defineHabitatMethod({
    input: federationSatelliteRejectInputSchema,
    output: federationSatelliteRejectOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "federation.ping": defineHabitatMethod({
    input: federationPingInputSchema,
    output: federationPingOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;

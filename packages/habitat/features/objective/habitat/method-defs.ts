import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";
import {
  objectiveCreateInputSchema,
  objectiveCreateOutputSchema,
  objectiveDeleteInputSchema,
  objectiveDeleteOutputSchema,
  objectiveGetInputSchema,
  objectiveGetOutputSchema,
  objectiveLinkInputSchema,
  objectiveLinkOutputSchema,
  objectiveListInputSchema,
  objectiveListOutputSchema,
  objectivePatchInputSchema,
  objectivePatchOutputSchema,
  objectiveUnlinkInputSchema,
  objectiveUnlinkOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/objective";

export const objectiveMethodDefs = {
  "objective.list": defineHabitatMethod({
    input: objectiveListInputSchema,
    output: objectiveListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "objective.get": defineHabitatMethod({
    input: objectiveGetInputSchema,
    output: objectiveGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "objective.create": defineHabitatMethod({
    input: objectiveCreateInputSchema,
    output: objectiveCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "objective.patch": defineHabitatMethod({
    input: objectivePatchInputSchema,
    output: objectivePatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "objective.delete": defineHabitatMethod({
    input: objectiveDeleteInputSchema,
    output: objectiveDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "objective.link": defineHabitatMethod({
    input: objectiveLinkInputSchema,
    output: objectiveLinkOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "objective.unlink": defineHabitatMethod({
    input: objectiveUnlinkInputSchema,
    output: objectiveUnlinkOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;

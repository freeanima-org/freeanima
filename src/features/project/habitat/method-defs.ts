import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";
import {
  projectCreateInputSchema,
  projectCreateOutputSchema,
  projectDeleteInputSchema,
  projectDeleteOutputSchema,
  projectGetInputSchema,
  projectGetOutputSchema,
  projectListInputSchema,
  projectListOutputSchema,
  projectStatsInputSchema,
  projectStatsOutputSchema,
  projectPatchInputSchema,
  projectPatchOutputSchema,
  projectfolderCreateInputSchema,
  projectfolderCreateOutputSchema,
  projectfolderDeleteInputSchema,
  projectfolderDeleteOutputSchema,
  projectfolderListInputSchema,
  projectfolderListOutputSchema,
  projectfolderPatchInputSchema,
  projectfolderPatchOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/project";

export const projectMethodDefs = {
  "projectfolder.list": defineHabitatMethod({
    input: projectfolderListInputSchema,
    output: projectfolderListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "projectfolder.create": defineHabitatMethod({
    input: projectfolderCreateInputSchema,
    output: projectfolderCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "projectfolder.patch": defineHabitatMethod({
    input: projectfolderPatchInputSchema,
    output: projectfolderPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "projectfolder.delete": defineHabitatMethod({
    input: projectfolderDeleteInputSchema,
    output: projectfolderDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "project.list": defineHabitatMethod({
    input: projectListInputSchema,
    output: projectListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "project.stats": defineHabitatMethod({
    input: projectStatsInputSchema,
    output: projectStatsOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "project.create": defineHabitatMethod({
    input: projectCreateInputSchema,
    output: projectCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "project.get": defineHabitatMethod({
    input: projectGetInputSchema,
    output: projectGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "project.patch": defineHabitatMethod({
    input: projectPatchInputSchema,
    output: projectPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "project.delete": defineHabitatMethod({
    input: projectDeleteInputSchema,
    output: projectDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;

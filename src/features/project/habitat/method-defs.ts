import { defineHubMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";
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
} from "@freeanima/shared/sap-contract/frames/project";

export const projectMethodDefs = {
  "projectfolder.list": defineHubMethod({
    input: projectfolderListInputSchema,
    output: projectfolderListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "projectfolder.create": defineHubMethod({
    input: projectfolderCreateInputSchema,
    output: projectfolderCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "projectfolder.patch": defineHubMethod({
    input: projectfolderPatchInputSchema,
    output: projectfolderPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "projectfolder.delete": defineHubMethod({
    input: projectfolderDeleteInputSchema,
    output: projectfolderDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "project.list": defineHubMethod({
    input: projectListInputSchema,
    output: projectListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "project.stats": defineHubMethod({
    input: projectStatsInputSchema,
    output: projectStatsOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "project.create": defineHubMethod({
    input: projectCreateInputSchema,
    output: projectCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "project.get": defineHubMethod({
    input: projectGetInputSchema,
    output: projectGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "project.patch": defineHubMethod({
    input: projectPatchInputSchema,
    output: projectPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "project.delete": defineHubMethod({
    input: projectDeleteInputSchema,
    output: projectDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;

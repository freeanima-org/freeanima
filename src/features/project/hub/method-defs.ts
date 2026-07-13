import { defineHubMethod, dualTransportMeta } from "@freeanima/shared/hub-contract";
import {
  milestoneCreateInputSchema,
  milestoneCreateOutputSchema,
  milestoneDeleteInputSchema,
  milestoneDeleteOutputSchema,
  milestoneListInputSchema,
  milestoneListOutputSchema,
  milestonePatchInputSchema,
  milestonePatchOutputSchema,
  projectCreateInputSchema,
  projectCreateOutputSchema,
  projectDeleteInputSchema,
  projectDeleteOutputSchema,
  projectGetInputSchema,
  projectGetOutputSchema,
  projectListInputSchema,
  projectListOutputSchema,
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
  "milestone.list": defineHubMethod({
    input: milestoneListInputSchema,
    output: milestoneListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "milestone.create": defineHubMethod({
    input: milestoneCreateInputSchema,
    output: milestoneCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "milestone.patch": defineHubMethod({
    input: milestonePatchInputSchema,
    output: milestonePatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "milestone.delete": defineHubMethod({
    input: milestoneDeleteInputSchema,
    output: milestoneDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;

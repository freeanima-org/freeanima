import {
  diaryAppendInputSchema,
  diaryAppendOutputSchema,
  diaryBlockCreateInputSchema,
  diaryBlockCreateOutputSchema,
  diaryBlockDeleteInputSchema,
  diaryBlockDeleteOutputSchema,
  diaryBlockPatchInputSchema,
  diaryBlockPatchOutputSchema,
  diaryBlockReorderInputSchema,
  diaryBlockReorderOutputSchema,
  diaryCreateInputSchema,
  diaryCreateOutputSchema,
  diaryDeleteInputSchema,
  diaryDeleteOutputSchema,
  diaryGetInputSchema,
  diaryGetOutputSchema,
  diaryListInputSchema,
  diaryListOutputSchema,
  diaryPatchInputSchema,
  diaryPatchOutputSchema,
  diarySearchInputSchema,
  diarySearchOutputSchema,
  diaryTemplateCreateInputSchema,
  diaryTemplateCreateOutputSchema,
  diaryTemplateDeleteInputSchema,
  diaryTemplateDeleteOutputSchema,
  diaryTemplateListInputSchema,
  diaryTemplateListOutputSchema,
  diaryTemplatePatchInputSchema,
  diaryTemplatePatchOutputSchema,
} from "@freeanima/shared/sap-contract/frames/diary";

import { defineHubMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";

export const diaryMethodDefs = {
  "diary.list": defineHubMethod({
    input: diaryListInputSchema,
    output: diaryListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "diary.create": defineHubMethod({
    input: diaryCreateInputSchema,
    output: diaryCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.append": defineHubMethod({
    input: diaryAppendInputSchema,
    output: diaryAppendOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.patch": defineHubMethod({
    input: diaryPatchInputSchema,
    output: diaryPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.delete": defineHubMethod({
    input: diaryDeleteInputSchema,
    output: diaryDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.get": defineHubMethod({
    input: diaryGetInputSchema,
    output: diaryGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "diary.search": defineHubMethod({
    input: diarySearchInputSchema,
    output: diarySearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "diary.blockCreate": defineHubMethod({
    input: diaryBlockCreateInputSchema,
    output: diaryBlockCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.blockPatch": defineHubMethod({
    input: diaryBlockPatchInputSchema,
    output: diaryBlockPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.blockDelete": defineHubMethod({
    input: diaryBlockDeleteInputSchema,
    output: diaryBlockDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.blockReorder": defineHubMethod({
    input: diaryBlockReorderInputSchema,
    output: diaryBlockReorderOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.templateList": defineHubMethod({
    input: diaryTemplateListInputSchema,
    output: diaryTemplateListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "diary.templateCreate": defineHubMethod({
    input: diaryTemplateCreateInputSchema,
    output: diaryTemplateCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.templatePatch": defineHubMethod({
    input: diaryTemplatePatchInputSchema,
    output: diaryTemplatePatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.templateDelete": defineHubMethod({
    input: diaryTemplateDeleteInputSchema,
    output: diaryTemplateDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;

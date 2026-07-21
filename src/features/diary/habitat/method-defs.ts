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

import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";

export const diaryMethodDefs = {
  "diary.list": defineHabitatMethod({
    input: diaryListInputSchema,
    output: diaryListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "diary.create": defineHabitatMethod({
    input: diaryCreateInputSchema,
    output: diaryCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.append": defineHabitatMethod({
    input: diaryAppendInputSchema,
    output: diaryAppendOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.patch": defineHabitatMethod({
    input: diaryPatchInputSchema,
    output: diaryPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.delete": defineHabitatMethod({
    input: diaryDeleteInputSchema,
    output: diaryDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.get": defineHabitatMethod({
    input: diaryGetInputSchema,
    output: diaryGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "diary.search": defineHabitatMethod({
    input: diarySearchInputSchema,
    output: diarySearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "diary.blockCreate": defineHabitatMethod({
    input: diaryBlockCreateInputSchema,
    output: diaryBlockCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.blockPatch": defineHabitatMethod({
    input: diaryBlockPatchInputSchema,
    output: diaryBlockPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.blockDelete": defineHabitatMethod({
    input: diaryBlockDeleteInputSchema,
    output: diaryBlockDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.blockReorder": defineHabitatMethod({
    input: diaryBlockReorderInputSchema,
    output: diaryBlockReorderOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.templateList": defineHabitatMethod({
    input: diaryTemplateListInputSchema,
    output: diaryTemplateListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "diary.templateCreate": defineHabitatMethod({
    input: diaryTemplateCreateInputSchema,
    output: diaryTemplateCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.templatePatch": defineHabitatMethod({
    input: diaryTemplatePatchInputSchema,
    output: diaryTemplatePatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.templateDelete": defineHabitatMethod({
    input: diaryTemplateDeleteInputSchema,
    output: diaryTemplateDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;

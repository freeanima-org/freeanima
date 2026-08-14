import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";
import {
  entityDeleteComponentInputSchema,
  entityDeleteComponentOutputSchema,
  entityDeleteInputSchema,
  entityDeleteOutputSchema,
  entityGetInputSchema,
  entityGetOutputSchema,
  entityListInputSchema,
  entityListOutputSchema,
  entityRestoreInputSchema,
  entityRestoreOutputSchema,
  entityTrashListInputSchema,
  entityTrashListOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/entity";

export const entityMethodDefs = {
  "entity.list": defineHabitatMethod({
    input: entityListInputSchema,
    output: entityListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "entity.trash.list": defineHabitatMethod({
    input: entityTrashListInputSchema,
    output: entityTrashListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "entity.get": defineHabitatMethod({
    input: entityGetInputSchema,
    output: entityGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "entity.delete": defineHabitatMethod({
    input: entityDeleteInputSchema,
    output: entityDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "entity.restore": defineHabitatMethod({
    input: entityRestoreInputSchema,
    output: entityRestoreOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "entity.deleteComponent": defineHabitatMethod({
    input: entityDeleteComponentInputSchema,
    output: entityDeleteComponentOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;

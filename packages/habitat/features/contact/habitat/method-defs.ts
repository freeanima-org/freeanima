import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";
import {
  contactAttachAddressInputSchema,
  contactAttachAddressOutputSchema,
  contactCreateFromAddressInputSchema,
  contactCreateFromAddressOutputSchema,
  contactCreateInputSchema,
  contactCreateOutputSchema,
  contactDeleteInputSchema,
  contactDeleteOutputSchema,
  contactGetInputSchema,
  contactGetOutputSchema,
  contactListInputSchema,
  contactListOutputSchema,
  contactPatchInputSchema,
  contactPatchOutputSchema,
  contactResolveByAddressInputSchema,
  contactResolveByAddressOutputSchema,
  contactSearchInputSchema,
  contactSearchOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/contact";

export const contactMethodDefs = {
  "contact.list": defineHabitatMethod({
    input: contactListInputSchema,
    output: contactListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "contact.get": defineHabitatMethod({
    input: contactGetInputSchema,
    output: contactGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "contact.search": defineHabitatMethod({
    input: contactSearchInputSchema,
    output: contactSearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "contact.create": defineHabitatMethod({
    input: contactCreateInputSchema,
    output: contactCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "contact.patch": defineHabitatMethod({
    input: contactPatchInputSchema,
    output: contactPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "contact.delete": defineHabitatMethod({
    input: contactDeleteInputSchema,
    output: contactDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "contact.resolveByAddress": defineHabitatMethod({
    input: contactResolveByAddressInputSchema,
    output: contactResolveByAddressOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "contact.attachAddress": defineHabitatMethod({
    input: contactAttachAddressInputSchema,
    output: contactAttachAddressOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "contact.createFromAddress": defineHabitatMethod({
    input: contactCreateFromAddressInputSchema,
    output: contactCreateFromAddressOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;

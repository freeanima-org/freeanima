export type {
  ContactRow,
  ContactChannelEntry,
  ContactAddressEntry,
  ContactCreateInput,
  ContactUpdateInput,
  ContactListOpts,
  ContactSearchOpts,
  ContactAttachAddressInput,
} from "./types.ts";

export {
  ContactIdentityConflictError,
  listContacts,
  getContact,
  searchContacts,
  createContact,
  updateContact,
  deleteContact,
  resolveContactsByAddress,
  attachAddressToContact,
  extractEmailAddress,
} from "./contact-store.ts";

export { resolveContactWorldId } from "./contact-world.ts";
export { registerContactTools, buildContactToolDefs } from "./tools.ts";

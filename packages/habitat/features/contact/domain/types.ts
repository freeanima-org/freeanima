import type {
  ContactAddressEntryPayload,
  ContactChannelEntryPayload,
  ContactRowPayload,
} from "@freeanima/shared/rpc-contract/frames/contact.ts";

export type ContactRow = ContactRowPayload;
export type ContactChannelEntry = ContactChannelEntryPayload;
export type ContactAddressEntry = ContactAddressEntryPayload;

export type ContactCreateInput = {
  title: string;
  summary?: string;
  emails?: ContactChannelEntry[];
  phones?: ContactChannelEntry[];
  addresses?: ContactAddressEntry[];
  wechats?: ContactChannelEntry[];
  animas?: import("@freeanima/habitat/core/db/schema/entity").ContactAnimaEntry[];
  subject_id?: number | null;
  client_op_id?: string;
};

export type ContactUpdateInput = {
  id: number;
  title?: string;
  summary?: string;
  emails?: ContactChannelEntry[];
  phones?: ContactChannelEntry[];
  addresses?: ContactAddressEntry[];
  wechats?: ContactChannelEntry[];
  animas?: import("@freeanima/habitat/core/db/schema/entity").ContactAnimaEntry[];
  subject_id?: number | null;
  client_op_id?: string;
};

export type ContactListOpts = {
  limit?: number;
  offset?: number;
};

export type ContactSearchOpts = {
  query: string;
  limit?: number;
  offset?: number;
};

export type ContactAttachAddressInput = {
  contact_id: number;
  address: string;
  label?: string;
  identity_key?: boolean;
};

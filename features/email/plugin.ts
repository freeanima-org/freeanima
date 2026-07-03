import {
  handleEmailAccountList,
  handleEmailMessageList,
  handleEmailMessageRead,
  handleEmailMessageMarkRead,
  handleEmailMessageSearch,
  handleEmailSync,
  handleEmailThreadList,
} from "./hub/rpc.ts";

/** Email feature plugin — registered by platform at boot. */
export const emailPlugin = {
  id: "email",
  shell: {
    routes: [{ path: "/email", featureId: "email", navLabel: "Email" }],
  },
  hub: {
    rpc: {
      "emailaccount.list": handleEmailAccountList,
      "email.message.list": handleEmailMessageList,
      "email.message.read": handleEmailMessageRead,
      "email.message.markRead": handleEmailMessageMarkRead,
      "email.message.search": handleEmailMessageSearch,
      "email.sync": handleEmailSync,
      "emailthread.list": handleEmailThreadList,
    },
  },
} as const;

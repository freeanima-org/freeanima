export {
  markMessageReadOnImap as markAsRead,
  markMessageUnreadOnImap as markAsUnread,
  markMessageFlaggedOnImap as markAsFlagged,
  markMessageUnflaggedOnImap as markAsUnflagged,
  deleteMessageOnImap as deleteEmail,
  moveMessageOnImap as moveMessage,
  saveDraft,
  sendDraft,
} from "./send.ts";

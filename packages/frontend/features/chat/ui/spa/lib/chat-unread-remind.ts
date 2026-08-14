/** 首拉不提醒；仅未读会话数上升时提醒 */
export function shouldRemindChatUnreadRise(opts: {
  primed: boolean;
  prev: number | null;
  next: number;
}): boolean {
  if (!opts.primed) return false;
  if (opts.prev == null) return false;
  return opts.next > opts.prev;
}

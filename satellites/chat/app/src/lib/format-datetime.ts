/** Conversation ID `YYYYMMDD_HHMMSS_…` → 可读时间 */
export function formatConversationIdDateTime(conversationId: string): string {
  const parts = conversationId.split("_");
  const datePart = parts[0];
  const timePart = parts[1];
  if (
    parts.length < 2 ||
    datePart === undefined ||
    timePart === undefined ||
    datePart.length < 8 ||
    timePart.length < 4
  ) {
    return conversationId;
  }
  const y = datePart.slice(0, 4);
  const mo = datePart.slice(4, 6);
  const d = datePart.slice(6, 8);
  const h = timePart.slice(0, 2);
  const mi = timePart.slice(2, 4);
  return `${y}/${mo}/${d} ${h}:${mi}`;
}

/** Discord thread name max length */
export const DISCORD_THREAD_TITLE_MAX = 100;

/** Initial thread preview length (user message prefix) */
export const DISCORD_THREAD_PREVIEW_LEN = 10;

export function discordThreadTitleFromSession(title: string): string {
  return title.trim().slice(0, DISCORD_THREAD_TITLE_MAX);
}

/** First 10 Unicode scalar values of user message for new thread name. */
export function discordThreadNameFromUserMessage(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "…";
  const preview = Array.from(trimmed).slice(0, DISCORD_THREAD_PREVIEW_LEN).join("");
  return preview.slice(0, DISCORD_THREAD_TITLE_MAX) || "…";
}

/** Skip rename when thread already shows the conversation title (Discord rate-limits renames). */
export function shouldRenameDiscordThread(currentName: string, sessionTitle: string): boolean {
  const desired = discordThreadTitleFromSession(sessionTitle);
  if (!desired) return false;
  return currentName.trim() !== desired;
}

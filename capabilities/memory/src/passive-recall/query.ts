const TIME_PREFIX_RE = /^time: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}\n/;

/** Strip runtime time prefix from user message before passive recall query. */
export function stripTimePrefixFromUserContent(content: string): string {
  return content.replace(TIME_PREFIX_RE, "").trim();
}

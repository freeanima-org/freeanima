export function prettyDuration(seconds: number): string {
  let s = Math.floor(seconds);
  const days = Math.floor(s / 86400);
  s %= 86400;
  const hours = Math.floor(s / 3600);
  s %= 3600;
  const minutes = Math.floor(s / 60);
  s %= 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

export function writeStatusLine(kind: string, msg: string): void {
  const symbols: Record<string, string> = {
    ok: "✓",
    warning: "⚠",
    error: "✗",
    info: "·",
  };
  console.log(`  ${symbols[kind] ?? "·"} ${msg}`);
}

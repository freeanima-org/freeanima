/** Config `enabled` treated as on when absent or true */
export function isEnabledByDefault(cfg: { enabled?: boolean } | undefined): boolean {
  return cfg?.enabled !== false;
}

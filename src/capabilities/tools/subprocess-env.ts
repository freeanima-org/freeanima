/** Explicit env for Bun: omitting spawn `env` does not pick up runtime process.env mutations. */
export function buildSubprocessEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  return extra && Object.keys(extra).length > 0 ? { ...process.env, ...extra } : { ...process.env };
}

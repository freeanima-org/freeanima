/**
 * Snapshot `process.env` for spawn, optionally merging child-only extras
 * without writing those keys into the Habitat process env.
 */
export function buildSubprocessEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  return extra && Object.keys(extra).length > 0 ? { ...process.env, ...extra } : { ...process.env };
}

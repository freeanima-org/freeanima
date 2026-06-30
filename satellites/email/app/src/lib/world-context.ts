export type ResolvedWorldContext = {
  user_subject_id: number;
  agent_subject_id: number;
  user_world_id: number;
  agent_world_id: number;
};

let cached: ResolvedWorldContext | null = null;

export async function fetchWorldContext(): Promise<ResolvedWorldContext> {
  if (cached) return cached;
  const res = await fetch("/api/worlds/context");
  if (!res.ok) {
    throw new Error(`failed to load world context: ${res.status}`);
  }
  cached = (await res.json()) as ResolvedWorldContext;
  return cached;
}

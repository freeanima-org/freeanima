/** 项目 skill 叠加解析（由 platform 注入 Coding cache；core 不依赖 features） */

export type ProjectSkillOverlayHit = {
  name: string;
  description: string;
  content: string;
  path?: string;
};

type Resolver = (
  conversationId: string | null,
  name: string,
) => ProjectSkillOverlayHit | null | Promise<ProjectSkillOverlayHit | null>;

let resolver: Resolver | null = null;

export function registerProjectSkillOverlayResolver(fn: Resolver | null): void {
  resolver = fn;
}

export async function resolveProjectSkillOverlay(
  conversationId: string | null,
  name: string,
): Promise<ProjectSkillOverlayHit | null> {
  if (!resolver) return null;
  return resolver(conversationId, name);
}

export type ProjectAgentOverlayHit = {
  slug: string;
  description: string;
  content: string;
  allowed_tools?: string[];
};

type AgentResolver = (
  conversationId: string | null,
  slug: string,
) => ProjectAgentOverlayHit | null | Promise<ProjectAgentOverlayHit | null>;

let agentResolver: AgentResolver | null = null;

export function registerProjectAgentOverlayResolver(fn: AgentResolver | null): void {
  agentResolver = fn;
}

export async function resolveProjectAgentOverlay(
  conversationId: string | null,
  slug: string,
): Promise<ProjectAgentOverlayHit | null> {
  if (!agentResolver) return null;
  return agentResolver(conversationId, slug);
}

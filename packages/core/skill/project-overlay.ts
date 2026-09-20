/** 项目 skill 叠加解析（由 platform 注入 Coding cache；core 不依赖 features） */

export type ProjectSkillOverlayHit = {
  name: string;
  description: string;
  content: string;
  path?: string;
};

export type ProjectSkillOverlayResolver = (
  conversationId: string | null,
  name: string,
) => ProjectSkillOverlayHit | null | Promise<ProjectSkillOverlayHit | null>;

let skillResolver: ProjectSkillOverlayResolver | null = null;
let agentResolver: ProjectAgentOverlayResolver | null = null;

export function registerProjectSkillOverlayResolver(fn: ProjectSkillOverlayResolver | null): void {
  skillResolver = fn;
}

export async function resolveProjectSkillOverlay(
  conversationId: string | null,
  name: string,
): Promise<ProjectSkillOverlayHit | null> {
  if (!skillResolver) return null;
  return skillResolver(conversationId, name);
}

export type ProjectAgentOverlayHit = {
  slug: string;
  description: string;
  content: string;
  allowed_tools?: string[];
};

export type ProjectAgentOverlayResolver = (
  conversationId: string | null,
  slug: string,
) => ProjectAgentOverlayHit | null | Promise<ProjectAgentOverlayHit | null>;

export function registerProjectAgentOverlayResolver(fn: ProjectAgentOverlayResolver | null): void {
  agentResolver = fn;
}

export async function resolveProjectAgentOverlay(
  conversationId: string | null,
  slug: string,
): Promise<ProjectAgentOverlayHit | null> {
  if (!agentResolver) return null;
  return agentResolver(conversationId, slug);
}

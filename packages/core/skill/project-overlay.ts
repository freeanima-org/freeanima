/** 项目 skill 叠加解析（由 platform 注入 Coding cache；core 不依赖 features） */

import { ensureRootContext, getRootContextOrNull } from "@freeanima/kernel";

import { mountProjectOverlayService } from "./project-overlay-service.ts";

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

export function registerProjectSkillOverlayResolver(fn: ProjectSkillOverlayResolver | null): void {
  mountProjectOverlayService(ensureRootContext()).setSkillResolver(fn);
}

export async function resolveProjectSkillOverlay(
  conversationId: string | null,
  name: string,
): Promise<ProjectSkillOverlayHit | null> {
  const service = getRootContextOrNull()?.projectOverlay;
  if (!service) return null;
  return service.resolveSkill(conversationId, name);
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
  mountProjectOverlayService(ensureRootContext()).setAgentResolver(fn);
}

export async function resolveProjectAgentOverlay(
  conversationId: string | null,
  slug: string,
): Promise<ProjectAgentOverlayHit | null> {
  const service = getRootContextOrNull()?.projectOverlay;
  if (!service) return null;
  return service.resolveAgent(conversationId, slug);
}

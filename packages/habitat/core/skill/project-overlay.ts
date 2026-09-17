/** 项目 skill 叠加解析（由 platform 注入 Coding cache；core 不依赖 features） */

import {
  ensureProcessContext,
  getProcessContext,
} from "@freeanima/habitat/platform/service/process-context.ts";

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
  mountProjectOverlayService(ensureProcessContext()).setSkillResolver(fn);
}

export async function resolveProjectSkillOverlay(
  conversationId: string | null,
  name: string,
): Promise<ProjectSkillOverlayHit | null> {
  const service = getProcessContext()?.projectOverlay;
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
  mountProjectOverlayService(ensureProcessContext()).setAgentResolver(fn);
}

export async function resolveProjectAgentOverlay(
  conversationId: string | null,
  slug: string,
): Promise<ProjectAgentOverlayHit | null> {
  const service = getProcessContext()?.projectOverlay;
  if (!service) return null;
  return service.resolveAgent(conversationId, slug);
}

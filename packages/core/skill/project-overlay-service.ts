import { Service, type Context } from "cordis";

import type {
  ProjectAgentOverlayHit,
  ProjectAgentOverlayResolver,
  ProjectSkillOverlayHit,
  ProjectSkillOverlayResolver,
} from "./project-overlay.ts";

declare module "cordis" {
  interface Context {
    projectOverlay: ProjectOverlayService;
  }
}

/**
 * Cordis service exposing project skill/agent overlays as `ctx.projectOverlay`.
 *
 * Replaces the two module-level resolver singletons; the coding feature binds
 * the resolvers at boot (`bindCodingProjectOverlays`).
 */
export class ProjectOverlayService extends Service {
  private skillResolver: ProjectSkillOverlayResolver | null = null;
  private agentResolver: ProjectAgentOverlayResolver | null = null;

  constructor(ctx: Context) {
    super(ctx, "projectOverlay");
  }

  setSkillResolver(resolver: ProjectSkillOverlayResolver | null): void {
    this.skillResolver = resolver;
  }

  setAgentResolver(resolver: ProjectAgentOverlayResolver | null): void {
    this.agentResolver = resolver;
  }

  async resolveSkill(
    conversationId: string | null,
    name: string,
  ): Promise<ProjectSkillOverlayHit | null> {
    if (!this.skillResolver) return null;
    return this.skillResolver(conversationId, name);
  }

  async resolveAgent(
    conversationId: string | null,
    slug: string,
  ): Promise<ProjectAgentOverlayHit | null> {
    if (!this.agentResolver) return null;
    return this.agentResolver(conversationId, slug);
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountProjectOverlayService(ctx: Context): ProjectOverlayService {
  const existing = ctx.projectOverlay as ProjectOverlayService | undefined;
  if (existing) return existing;
  return new ProjectOverlayService(ctx);
}

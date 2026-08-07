/** platform 启动时绑定 Coding 项目 skill/agent overlay */

import {
  registerProjectAgentOverlayResolver,
  registerProjectSkillOverlayResolver,
} from "@freeanima/host/core/skill/project-overlay.ts";
import {
  getProjectAgentContext,
  type ProjectAgentProfile,
  type ProjectSkill,
} from "@freeanima/features/coding/domain";

export function bindCodingProjectOverlays(): void {
  registerProjectSkillOverlayResolver((conversationId, name) => {
    if (!conversationId) return null;
    const snap = getProjectAgentContext(conversationId);
    if (!snap) return null;
    const skills = snap.skills as ProjectSkill[];
    const hit = skills.find((s) => s.name === name);
    if (!hit?.body?.trim()) return null;
    return {
      name: hit.name,
      description: hit.description,
      content: hit.body,
      path: hit.path,
    };
  });

  registerProjectAgentOverlayResolver((conversationId, slug) => {
    if (!conversationId) return null;
    const snap = getProjectAgentContext(conversationId);
    if (!snap) return null;
    const agents = snap.agents as ProjectAgentProfile[];
    const hit = agents.find((a) => a.slug === slug);
    if (!hit?.content?.trim()) return null;
    return {
      slug: hit.slug,
      description: hit.description,
      content: hit.content,
      ...(hit.allowed_tools ? { allowed_tools: hit.allowed_tools } : {}),
    };
  });
}

import { describe, expect, test } from "bun:test";

import {
  registerProjectAgentOverlayResolver,
  registerProjectSkillOverlayResolver,
  resolveProjectAgentOverlay,
  resolveProjectSkillOverlay,
} from "./project-overlay.ts";

describe("project overlay service", () => {
  test("resolves registered overlays and clears them on unregister", async () => {
    registerProjectSkillOverlayResolver((_conversationId, name) => ({
      name,
      description: "skill description",
      content: "skill content",
    }));
    registerProjectAgentOverlayResolver(() => ({
      slug: "agent-a",
      description: "agent description",
      content: "agent content",
    }));

    await expect(resolveProjectSkillOverlay("1", "skill-a")).resolves.toEqual({
      name: "skill-a",
      description: "skill description",
      content: "skill content",
    });
    await expect(resolveProjectAgentOverlay("1", "agent-a")).resolves.toEqual({
      slug: "agent-a",
      description: "agent description",
      content: "agent content",
    });

    registerProjectSkillOverlayResolver(null);
    registerProjectAgentOverlayResolver(null);
    await expect(resolveProjectSkillOverlay("1", "skill-a")).resolves.toBeNull();
    await expect(resolveProjectAgentOverlay("1", "agent-a")).resolves.toBeNull();
  });
});

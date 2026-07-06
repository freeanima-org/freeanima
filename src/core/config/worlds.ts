import type { AnimaConfig } from "./schemas/config.ts";
import { DEFAULT_AGENT_SUBJECT_ID, DEFAULT_USER_SUBJECT_ID } from "./schemas/worlds.ts";

export type ResolvedWorldSubjectIds = {
  user_subject_id: number;
  agent_subject_id: number;
};

/** 解析 worlds 段 subject id；缺省 user=1 agent=2；兼容旧 notifications 段 */
export function resolveWorldSubjectIds(config: AnimaConfig): ResolvedWorldSubjectIds {
  const worlds = config.worlds;
  if (worlds?.user_subject_id != null || worlds?.agent_subject_id != null) {
    return {
      user_subject_id: worlds.user_subject_id ?? DEFAULT_USER_SUBJECT_ID,
      agent_subject_id: worlds.agent_subject_id ?? DEFAULT_AGENT_SUBJECT_ID,
    };
  }

  const legacy = config.notifications;
  if (legacy?.user_subject_id != null || legacy?.agent_subject_id != null) {
    return {
      user_subject_id: legacy.user_subject_id ?? DEFAULT_USER_SUBJECT_ID,
      agent_subject_id: legacy.agent_subject_id ?? DEFAULT_AGENT_SUBJECT_ID,
    };
  }

  return {
    user_subject_id: DEFAULT_USER_SUBJECT_ID,
    agent_subject_id: DEFAULT_AGENT_SUBJECT_ID,
  };
}

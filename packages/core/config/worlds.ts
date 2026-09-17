import type { RuntimeConfig } from "./schemas/runtime-config.ts";

/** 配置中显式给出的 subject id；缺省字段省略（由 ensure 发现/创建） */
export type ResolvedWorldSubjectIds = {
  user_subject_id?: number;
  agent_subject_id?: number;
};

/** 解析 worlds 段 subject id；未配置则返回空对象；兼容旧 notifications 段 */
export function resolveWorldSubjectIds(config: RuntimeConfig): ResolvedWorldSubjectIds {
  const worlds = config.worlds;
  if (worlds?.user_subject_id != null || worlds?.agent_subject_id != null) {
    const out: ResolvedWorldSubjectIds = {};
    if (worlds.user_subject_id != null) out.user_subject_id = worlds.user_subject_id;
    if (worlds.agent_subject_id != null) out.agent_subject_id = worlds.agent_subject_id;
    return out;
  }

  const legacy = config.notifications;
  if (legacy?.user_subject_id != null || legacy?.agent_subject_id != null) {
    const out: ResolvedWorldSubjectIds = {};
    if (legacy.user_subject_id != null) out.user_subject_id = legacy.user_subject_id;
    if (legacy.agent_subject_id != null) out.agent_subject_id = legacy.agent_subject_id;
    return out;
  }

  return {};
}

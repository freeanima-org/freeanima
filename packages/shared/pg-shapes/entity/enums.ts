import { z } from "zod";

export const taskItemStatusSchema = z.enum(["pending", "completed"]);
export type TaskItemStatus = z.infer<typeof taskItemStatusSchema>;

export const taskItemPrioritySchema = z.enum(["high", "medium", "low", "none"]);
export type TaskItemPriority = z.infer<typeof taskItemPrioritySchema>;

/**
 * 任务归属容器（查询轴；≠ 壳模块 ShellModuleId，≠ 实体组件 ComponentId）。
 * - list：清单侧（project_id 空）
 * - project：项目侧
 * - any：跨容器（如日程）
 */
export const TaskContainer = {
  LIST: "list",
  PROJECT: "project",
  ANY: "any",
} as const;
export type TaskContainerKind = (typeof TaskContainer)[keyof typeof TaskContainer];
export const taskContainerSchema = z.enum([
  TaskContainer.LIST,
  TaskContainer.PROJECT,
  TaskContainer.ANY,
]);

/** container 优先；遗留 in_backlog：true→list，false→any */
export function resolveTaskContainer(opts: {
  container?: TaskContainerKind | undefined;
  in_backlog?: boolean | undefined;
}): TaskContainerKind | undefined {
  if (opts.container != null) return opts.container;
  if (opts.in_backlog === true) return TaskContainer.LIST;
  if (opts.in_backlog === false) return TaskContainer.ANY;
  return undefined;
}

export const vaultItemTypeSchema = z.enum(["login", "secure_note", "card", "identity", "custom"]);
export type VaultItemType = z.infer<typeof vaultItemTypeSchema>;

export const selfBlockKeySchema = z.enum([
  "existence_anchor",
  "self_model",
  "personality_baseline",
  "direction",
  "metacognition",
]);
export type SelfBlockKey = z.infer<typeof selfBlockKeySchema>;

/** 会话情景行为档（与 platform 通道身份正交） */
export const conversationScenarioSchema = z.enum(["digital_human", "coding_agent", "room_inner"]);
export type ConversationScenario = z.infer<typeof conversationScenarioSchema>;

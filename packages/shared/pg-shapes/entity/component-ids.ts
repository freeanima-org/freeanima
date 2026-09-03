/** Entity primary / component id 字面量 SSOT（UI 与 host schema 共用）。 */

export const WORLD_CONFIG_COMPONENT = "world_config" as const;
export const AGENT_CONFIG_COMPONENT = "agent_config" as const;
export const USER_CONFIG_COMPONENT = "user_config" as const;
export const TASK_LIST_COMPONENT = "task_list" as const;
export const SMART_LIST_COMPONENT = "smart_list" as const;
export const TASK_ITEM_COMPONENT = "task_item" as const;
export const TASK_OCCURRENCE_COMPONENT = "task_occurrence" as const;
export const PROJECT_FOLDER_COMPONENT = "project_folder" as const;
export const PROJECT_COMPONENT = "project" as const;
export const OBJECTIVE_COMPONENT = "objective" as const;
export const HABIT_COMPONENT = "habit" as const;
export const HABIT_CHECK_IN_COMPONENT = "habit_check_in" as const;
export const TAG_COMPONENT = "tag" as const;
export const DIARY_ENTRY_COMPONENT = "diary_entry" as const;
export const NOTE_COMPONENT = "note" as const;
export const CALENDAR_EVENT_COMPONENT = "calendar_event" as const;
export const DIARY_BLOCK_TEMPLATE_COMPONENT = "diary_block_template" as const;
export const CODING_NOTE_COMPONENT = "coding_note" as const;
export const BOOKMARK_COMPONENT = "bookmark" as const;
export const HEALTH_RECORD_COMPONENT = "health_record" as const;
export const CONTACT_COMPONENT = "contact" as const;
export const CONTENT_BLOCK_COMPONENT = "content_block" as const;
export const LIMBIC_COMPONENT = "limbic" as const;
export const NARRATIVE_COMPONENT = "narrative" as const;
export const DREAM_COMPONENT = "dream" as const;
export const SEMANTIC_MEMORY_COMPONENT = "semantic_memory" as const;
export const SEMANTIC_REF_COMPONENT = "semantic_ref" as const;
export const TEMPORAL_SUMMARY_COMPONENT = "temporal_summary" as const;
export const SELF_BLOCK_COMPONENT = "self_block" as const;
export const EMAIL_ACCOUNT_COMPONENT = "email_account" as const;
export const EMAIL_THREAD_COMPONENT = "email_thread" as const;
export const EMAIL_MESSAGE_COMPONENT = "email_message" as const;
export const VAULT_CONFIG_COMPONENT = "vault_config" as const;
export const VAULT_ITEM_COMPONENT = "vault_item" as const;
export const POMODORO_CONFIG_COMPONENT = "pomodoro_config" as const;
export const POMODORO_SESSION_COMPONENT = "pomodoro_session" as const;
export const POMODORO_TASK_FOCUS_COMPONENT = "pomodoro_task_focus" as const;
export const POMODORO_ACTIVE_COMPONENT = "pomodoro_active" as const;
export const CALENDAR_UI_PREFS_COMPONENT = "calendar_ui_prefs" as const;
export const COMPANION_PROFILE_COMPONENT = "companion_profile" as const;
export const OBJECT_FILE_COMPONENT = "object_file" as const;
export const OBJECT_FOLDER_COMPONENT = "object_folder" as const;
export const SKILL_COMPONENT = "skill" as const;
export const SKILL_RESOURCE_COMPONENT = "skill_resource" as const;
export const SUBAGENT_COMPONENT = "subagent" as const;
export const WORKFLOW_COMPONENT = "workflow" as const;
/** 壳层快捷入口附属组件（attach 到实体；非主路由面） */
export const SHELL_QUICK_ENTRY_COMPONENT = "shell_quick_entry" as const;

export const COMPONENT_IDS = [
  WORLD_CONFIG_COMPONENT,
  AGENT_CONFIG_COMPONENT,
  USER_CONFIG_COMPONENT,
  TASK_LIST_COMPONENT,
  SMART_LIST_COMPONENT,
  TASK_ITEM_COMPONENT,
  TASK_OCCURRENCE_COMPONENT,
  PROJECT_FOLDER_COMPONENT,
  PROJECT_COMPONENT,
  OBJECTIVE_COMPONENT,
  HABIT_COMPONENT,
  HABIT_CHECK_IN_COMPONENT,
  TAG_COMPONENT,
  DIARY_ENTRY_COMPONENT,
  NOTE_COMPONENT,
  CALENDAR_EVENT_COMPONENT,
  DIARY_BLOCK_TEMPLATE_COMPONENT,
  CODING_NOTE_COMPONENT,
  BOOKMARK_COMPONENT,
  HEALTH_RECORD_COMPONENT,
  CONTACT_COMPONENT,
  CONTENT_BLOCK_COMPONENT,
  LIMBIC_COMPONENT,
  NARRATIVE_COMPONENT,
  DREAM_COMPONENT,
  SEMANTIC_MEMORY_COMPONENT,
  SEMANTIC_REF_COMPONENT,
  TEMPORAL_SUMMARY_COMPONENT,
  SELF_BLOCK_COMPONENT,
  EMAIL_ACCOUNT_COMPONENT,
  EMAIL_THREAD_COMPONENT,
  EMAIL_MESSAGE_COMPONENT,
  VAULT_CONFIG_COMPONENT,
  VAULT_ITEM_COMPONENT,
  POMODORO_CONFIG_COMPONENT,
  POMODORO_SESSION_COMPONENT,
  POMODORO_TASK_FOCUS_COMPONENT,
  POMODORO_ACTIVE_COMPONENT,
  CALENDAR_UI_PREFS_COMPONENT,
  COMPANION_PROFILE_COMPONENT,
  OBJECT_FILE_COMPONENT,
  OBJECT_FOLDER_COMPONENT,
  SKILL_COMPONENT,
  SKILL_RESOURCE_COMPONENT,
  SUBAGENT_COMPONENT,
  WORKFLOW_COMPONENT,
  SHELL_QUICK_ENTRY_COMPONENT,
] as const;

export type ComponentId = (typeof COMPONENT_IDS)[number];

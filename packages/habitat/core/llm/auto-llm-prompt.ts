/**
 * AutoLlm 提示组装（固化高 → 低）：
 * system：1. protocol 2. task_spec（稳定，可用 {{param}} 挖空）
 * user：3. skills 4. task_params（填空）5. data
 * 不走对话提示词栈（无自我层 / 常驻 / citation·recall）。
 */

import { PROMPT_XML_TAGS, wrapPromptXml } from "@freeanima/habitat/core/hooks/prompt";

/** 工具环默认墙钟 15min */
export const AUTO_LLM_DEFAULT_MAX_DURATION_MS = 15 * 60 * 1000;
/** 侧车 chat 默认墙钟 2min */
export const AUTO_LLM_CHAT_DEFAULT_MAX_DURATION_MS = 2 * 60 * 1000;

/** 全 kind 共用硬性协议（禁止写入易变实例字段；收尾形态由 task_spec 决定） */
export const AUTO_LLM_PROTOCOL_BODY = `这不是用户对话，也不是聊天室人格扮演。
你正在执行一次独立的 AutoLlmRun：无用户回合、有限工具环、完成后即结束。
依据任务规格与后续给出的数据/技能完成目标；需要外部信息时使用可用工具。
目标达成后，最后一轮禁止再带 tool_calls；输出形态以任务规格为准。
完成后停止；不要闲聊、不要索取用户确认。`;

export const AUTO_LLM_PROTOCOL_FRAME = "以下为 AutoLlm 运行硬性协议（适用于所有自动 LLM 任务）。";

export type AutoLlmDataPart = {
  /** XML 标签名；默认 source_data；空串表示 body 已自带外壳 */
  tag?: string;
  body: string;
  attrs?: Readonly<Record<string, string>>;
};

/** 任务参数：填 task_spec 中的 {{name}}；值会写入 user 层 auto_llm_task_params */
export type AutoLlmTaskParams = Readonly<
  Record<string, string | number | boolean | null | undefined>
>;

export type ComposeAutoLlmPromptInput = {
  kind: string;
  /** 层 2：该 kind 稳定指令（可含 {{param}}；不含 run_name / 墙钟等引擎元数据） */
  taskSpec: string;
  /** 填空参数；组装为 skills 之后、source_data 之前的独立 user 消息 */
  taskParams?: AutoLlmTaskParams | null;
  skillsText?: string | null;
  dataParts?: readonly AutoLlmDataPart[];
};

export type ComposedAutoLlmPrompt = {
  systemPrompt: string;
  userMessages: string[];
};

export function formatAutoLlmProtocol(): string {
  return wrapPromptXml(PROMPT_XML_TAGS.autoLlmProtocol, AUTO_LLM_PROTOCOL_BODY);
}

export function formatAutoLlmTaskSpec(kind: string, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return wrapPromptXml(PROMPT_XML_TAGS.autoLlmTaskSpec, `(kind=${kind})`, {
      attrs: { kind },
    });
  }
  return wrapPromptXml(PROMPT_XML_TAGS.autoLlmTaskSpec, trimmed, {
    attrs: { kind },
  });
}

export function formatAutoLlmSkillsMessage(skillsText: string): string {
  return wrapPromptXml(PROMPT_XML_TAGS.skills, skillsText);
}

/** 将 taskParams 格式化为 `key: value` 行（稳定排序；跳过空值） */
export function formatAutoLlmTaskParamsBody(params: AutoLlmTaskParams): string {
  const lines: string[] = [];
  for (const key of Object.keys(params).toSorted()) {
    const raw = params[key];
    if (raw == null) continue;
    const value = typeof raw === "string" ? raw.trim() : String(raw);
    if (!value) continue;
    lines.push(`${key}: ${value}`);
  }
  return lines.join("\n");
}

export function formatAutoLlmTaskParamsMessage(params: AutoLlmTaskParams): string {
  const body = formatAutoLlmTaskParamsBody(params);
  if (!body) return "";
  return wrapPromptXml(PROMPT_XML_TAGS.autoLlmTaskParams, body);
}

export function formatAutoLlmDataPart(part: AutoLlmDataPart): string {
  const trimmedBody = part.body.trim();
  if (!trimmedBody) return "";
  // 空 tag：载荷已自带 XML（如 passive_memory）
  if (part.tag === "") return trimmedBody;
  const tag = part.tag?.trim() || PROMPT_XML_TAGS.sourceData;
  return wrapPromptXml(tag, trimmedBody, part.attrs ? { attrs: part.attrs } : undefined);
}

/** 组装结果转为 runAutoLlmChat 的 messages */
export function composedAutoLlmPromptToChatMessages(
  composed: ComposedAutoLlmPrompt,
): Array<{ role: "system" | "user"; content: string }> {
  return [
    { role: "system", content: composed.systemPrompt },
    ...composed.userMessages.map((content) => ({ role: "user" as const, content })),
  ];
}

/** 组装 system + userMessages；缺层则跳过 */
export function composeAutoLlmPrompt(input: ComposeAutoLlmPromptInput): ComposedAutoLlmPrompt {
  const systemPrompt = [
    AUTO_LLM_PROTOCOL_FRAME,
    formatAutoLlmProtocol(),
    formatAutoLlmTaskSpec(input.kind, input.taskSpec),
  ]
    .filter(Boolean)
    .join("\n\n");

  const userMessages: string[] = [];
  const skills = input.skillsText?.trim();
  if (skills) {
    userMessages.push(formatAutoLlmSkillsMessage(skills));
  }
  if (input.taskParams) {
    const paramsMsg = formatAutoLlmTaskParamsMessage(input.taskParams);
    if (paramsMsg) userMessages.push(paramsMsg);
  }
  for (const part of input.dataParts ?? []) {
    const wrapped = formatAutoLlmDataPart(part);
    if (wrapped) userMessages.push(wrapped);
  }

  return { systemPrompt, userMessages };
}

export function formatCronAutoLlmTaskSpec(): string {
  return `执行定时任务给出的指令与数据。
在有限工具环内完成工作；需要记忆时调用可用的记忆工具检索。
完成后停止，不要闲聊。`;
}

/** @deprecated 使用 formatCronAutoLlmTaskSpec */
export function formatCronAutoLlmTaskSection(_runName: string): string {
  return formatCronAutoLlmTaskSpec();
}

/** @deprecated 使用 composeAutoLlmPrompt */
export async function buildAutoLlmSystemPrompt(opts?: {
  cwd?: string | null;
  taskSection?: string;
}): Promise<string> {
  const { systemPrompt } = composeAutoLlmPrompt({
    kind: "cron",
    taskSpec: opts?.taskSection?.trim() || formatCronAutoLlmTaskSpec(),
  });
  return systemPrompt;
}

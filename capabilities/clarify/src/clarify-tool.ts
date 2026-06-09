import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { toolError, toolResult } from "@freeanima/engine-tool";
import { getClarifyConfig } from "./clarify.ts";
import type { ClarifyItem as ClarifyItemType } from "./clarify.ts";

type ClarifyArgs = {
  items?: unknown;
  question?: unknown;
  choices?: unknown;
  required?: unknown;
  timeout_sec?: unknown;
};

function normalizeItems(args: ClarifyArgs): ClarifyItemType[] | string {
  const { max_items } = getClarifyConfig();

  if (Array.isArray(args.items) && args.items.length > 0) {
    const items: ClarifyItemType[] = [];
    for (const raw of args.items.slice(0, max_items)) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const question = typeof row.question === "string" ? row.question.trim() : "";
      if (!question) continue;
      const item: ClarifyItemType = { question };
      if (Array.isArray(row.choices)) {
        item.choices = row.choices
          .map(String)
          .map((c) => c.trim())
          .filter(Boolean)
          .slice(0, 4);
      }
      if (typeof row.default === "string" && row.default.trim()) {
        item.default = row.default.trim();
      }
      items.push(item);
    }
    if (!items.length) return "items 中至少需要一个有效 question";
    return items;
  }

  const question = typeof args.question === "string" ? args.question.trim() : "";
  if (!question) return "question 或 items 必填";
  const item: ClarifyItemType = { question };
  if (Array.isArray(args.choices)) {
    item.choices = args.choices
      .map(String)
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 4);
  }
  return [item];
}

function handleClarify(args: ClarifyArgs): string {
  const itemsOrError = normalizeItems(args);
  if (typeof itemsOrError === "string") return toolError(itemsOrError);

  const items = itemsOrError;
  const required = args.required !== false;
  const { timeout_sec: defaultTimeout } = getClarifyConfig();
  const timeoutSec =
    typeof args.timeout_sec === "number" && args.timeout_sec >= 60
      ? Math.floor(args.timeout_sec)
      : defaultTimeout;

  if (required) {
    return toolResult({
      status: "awaiting",
      items,
      timeout_sec: timeoutSec,
    });
  }

  const missingDefault = items.filter((item) => !item.default);
  if (missingDefault.length > 0) {
    return toolError(
      `required=false 时每个 item 必须提供 default：${missingDefault.map((i) => i.question).join("；")}`,
    );
  }

  return toolResult({
    status: "resolved",
    answers: items.map((item) => ({
      question: item.question,
      answer: item.default!,
    })),
  });
}

export function registerClarifyTool(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet("clarify", "向伙伴提问澄清", [
    {
      name: "clarify",
      description:
        "向伙伴提问以获取继续所需的信息。支持批量提问（items）与可选自动推荐（required=false + default）。",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "批量问题列表",
            minItems: 1,
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                question: { type: "string", description: "问题正文" },
                choices: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 4,
                  description: "可选选项",
                },
                default: {
                  type: "string",
                  description: "required=false 时的 LLM 推荐答案",
                },
              },
              required: ["question"],
            },
          },
          question: {
            type: "string",
            description: "单个问题（与 items 二选一，向后兼容）",
          },
          choices: {
            type: "array",
            items: { type: "string" },
            maxItems: 4,
            description: "单问题模式下的选项",
          },
          required: {
            type: "boolean",
            description: "是否必须等待伙伴确认；false 时需提供 default 并自动续跑",
            default: true,
          },
          timeout_sec: {
            type: "integer",
            minimum: 60,
            description: "required=true 时等待超时秒数",
          },
        },
      },
      handler: (a) => handleClarify(a as ClarifyArgs),
    },
  ]);
}

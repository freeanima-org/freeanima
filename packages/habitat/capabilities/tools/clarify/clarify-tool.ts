import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/habitat/core/tool";
import { asRecord } from "@freeanima/shared/util";
import { CLARIFY_TOOL_RETURNS } from "./return-schemas.ts";
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
      const row = asRecord(raw);
      if (!row) continue;
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
    if (items.length === 0) return "items must contain at least one valid question";
    return items;
  }

  const question = typeof args.question === "string" ? args.question.trim() : "";
  if (!question) return "question or items required";
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
      `When required=false each item must provide default: ${missingDefault.map((i) => i.question).join("; ")}`,
    );
  }

  return toolResult({
    status: "resolved",
    answers: items.map((item) => ({
      question: item.question,
      answer: item.default ?? "",
    })),
  });
}

export function registerClarifyTool(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "clarify",
    "Ask partner for clarification",
    attachToolReturns(
      [
        {
          name: "clarify",
          description:
            "Ask the partner for information needed to continue. Supports batch questions (items) and optional auto-recommendation (required=false + default).",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                description: "Batch question list",
                minItems: 1,
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string", description: "Question text" },
                    choices: {
                      type: "array",
                      items: { type: "string" },
                      maxItems: 4,
                      description: "Optional choices",
                    },
                    default: {
                      type: "string",
                      description: "LLM recommended answer when required=false",
                    },
                  },
                  required: ["question"],
                },
              },
              question: {
                type: "string",
                description: "Single question (mutually exclusive with items, backward compatible)",
              },
              choices: {
                type: "array",
                items: { type: "string" },
                maxItems: 4,
                description: "Choices in single-question mode",
              },
              required: {
                type: "boolean",
                description:
                  "Whether partner confirmation is required; when false provide default and auto-continue",
                default: true,
              },
              timeout_sec: {
                type: "integer",
                minimum: 60,
                description: "Timeout seconds when required=true",
              },
            },
          },
          handler: (a) => handleClarify(a),
        },
      ],
      CLARIFY_TOOL_RETURNS,
    ),
  );
}

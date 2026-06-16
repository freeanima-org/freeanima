import type { SessionMessage, ToolMessage } from "@freeanima/core/db/domain";
import type { ToolCall } from "@freeanima/core/db/domain";
import {
  loadCallFullyCached,
  parseToolSetsFromLoadArgs,
  TOOL_SET_LOAD_TOOL_NAME,
} from "./toolset-meta.ts";

function isLoadToolCall(name: string): boolean {
  const n = name.trim();
  return n === TOOL_SET_LOAD_TOOL_NAME;
}

function parseLoadCallToolsets(call: ToolCall): string[] {
  if (!isLoadToolCall(call.function?.name ?? "")) return [];
  try {
    const raw = call.function.arguments;
    const args = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parseToolSetsFromLoadArgs(args);
  } catch {
    return [];
  }
}

function shouldStripLoadCall(call: ToolCall, cachedToolsets: readonly string[]): boolean {
  const loaded = parseLoadCallToolsets(call);
  if (!loaded.length) return false;
  return loadCallFullyCached(loaded, cachedToolsets);
}

/** Remove toolset_load rounds from runtime view when all loaded ToolSets are cached */
export function stripCachedToolSetLoadRounds(
  messages: SessionMessage[],
  cachedToolsets: readonly string[],
): SessionMessage[] {
  const out: SessionMessage[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i]!;
    if (msg.role !== "assistant" || !msg.tool_calls?.length) {
      out.push(msg);
      i++;
      continue;
    }

    const calls = msg.tool_calls as ToolCall[];
    const stripIds = new Set(
      calls.filter((c) => shouldStripLoadCall(c, cachedToolsets)).map((c) => c.id),
    );
    const keptCalls = calls.filter((c) => !stripIds.has(c.id));

    if (!keptCalls.length) {
      let j = i + 1;
      while (j < messages.length && messages[j]?.role === "tool") j++;
      i = j;
      continue;
    }

    if (keptCalls.length === calls.length) {
      out.push(msg);
      i++;
      continue;
    }

    out.push({ ...msg, tool_calls: keptCalls });

    let j = i + 1;
    while (j < messages.length && messages[j]?.role === "tool") {
      const t = messages[j] as ToolMessage;
      if (stripIds.has(t.tool_call_id)) {
        j++;
        continue;
      }
      if (keptCalls.some((c) => c.id === t.tool_call_id)) {
        out.push(t);
      }
      j++;
    }
    i = j;
  }
  return out;
}

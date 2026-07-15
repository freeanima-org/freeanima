/** 进入聊天时选择/创建会话的纯逻辑（可单测）。 */

export type BootstrapListItem = { id: string };

export type BootstrapDecision = { kind: "select"; conversationId: string } | { kind: "create" };

export function pickConversationId(
  list: BootstrapListItem[],
  candidates: (string | null | undefined)[],
): string | undefined {
  for (const id of candidates) {
    if (id && list.some((c) => c.id === id)) return id;
  }
  return undefined;
}

/** 有列表则选中（候选优先，否则第一条）；空列表才考虑创建。 */
export function decideBootstrapConversation(
  list: BootstrapListItem[],
  candidates: (string | null | undefined)[],
): BootstrapDecision {
  const picked = pickConversationId(list, candidates);
  if (picked) return { kind: "select", conversationId: picked };
  const first = list[0];
  if (first) return { kind: "select", conversationId: first.id };
  return { kind: "create" };
}

export type BootstrapConversationDeps = {
  fetchConversations: () => Promise<BootstrapListItem[]>;
  whenReady: () => Promise<void>;
  createConversation: () => Promise<string | null>;
  selectConversation: (conversationId: string) => Promise<void>;
  candidates: (string | null | undefined)[];
};

export type BootstrapConversationResult = "selected" | "created" | "empty";

/**
 * Hub 未就绪时 list 常为 []，不可据此立刻 create。
 * 仅在 whenReady 后重拉仍为空时才新建；并发调用共用同一次 in-flight。
 */
let bootstrapInFlight: Promise<BootstrapConversationResult> | null = null;

export async function runBootstrapConversation(
  deps: BootstrapConversationDeps,
): Promise<BootstrapConversationResult> {
  if (bootstrapInFlight) return bootstrapInFlight;
  bootstrapInFlight = runBootstrapConversationOnce(deps).finally(() => {
    bootstrapInFlight = null;
  });
  return bootstrapInFlight;
}

/** 单测用：重置模块级 in-flight。 */
export function resetBootstrapConversationInFlightForTest(): void {
  bootstrapInFlight = null;
}

async function runBootstrapConversationOnce(
  deps: BootstrapConversationDeps,
): Promise<BootstrapConversationResult> {
  const apply = async (list: BootstrapListItem[]): Promise<BootstrapConversationResult | null> => {
    const decision = decideBootstrapConversation(list, deps.candidates);
    if (decision.kind === "select") {
      await deps.selectConversation(decision.conversationId);
      return "selected";
    }
    return null;
  };

  const first = await apply(await deps.fetchConversations());
  if (first) return first;

  try {
    await deps.whenReady();
  } catch {
    return "empty";
  }

  const afterReady = await apply(await deps.fetchConversations());
  if (afterReady) return afterReady;

  const createdId = await deps.createConversation();
  return createdId ? "created" : "empty";
}

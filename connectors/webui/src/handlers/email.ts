import { fetchEmails, listEmailAccounts, listEmails } from "@freeanima/life-estate";

export async function getEmailOverview() {
  const accounts = listEmailAccounts();
  let messages: Awaited<ReturnType<typeof listEmails>> = [];
  const errors: Record<string, string> = {};

  if (accounts.length > 0) {
    try {
      messages = await listEmails(undefined, { limit: 5 });
    } catch (err) {
      errors._all = err instanceof Error ? err.message : String(err);
    }
  }

  return { accounts, messages, errors };
}

export async function fetchAccountEmails(id: string) {
  const account = listEmailAccounts().find((a: { id: string }) => a.id === id);
  if (!account) {
    return { ok: false as const, error: `未找到账户: ${id}`, messages: [] };
  }

  try {
    const messages = await fetchEmails(id, 20);
    return { ok: true as const, account_id: id, messages, count: messages.length };
  } catch (err) {
    return {
      ok: false as const,
      account_id: id,
      error: err instanceof Error ? err.message : String(err),
      messages: [],
    };
  }
}

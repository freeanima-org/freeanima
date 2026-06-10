import {
  fetchEmails,
  listEmailAccounts,
  listEmails,
  markAsRead,
  readEmail,
} from "@freeanima/life-estate";

function accountNotFound(id: string) {
  return {
    ok: false as const,
    error: `Account not found: ${id}`,
    code: "email_account_not_found" as const,
    params: { account_id: id },
  };
}

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
    return { ...accountNotFound(id), messages: [] };
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

function findAccount(accountId: string) {
  return listEmailAccounts().find((a: { id: string }) => a.id === accountId);
}

export async function listAccountMessages(accountId: string, limit = 50) {
  const account = findAccount(accountId);
  if (!account) {
    return { ...accountNotFound(accountId), messages: [] };
  }

  try {
    const messages = await listEmails(accountId, { limit });
    return { ok: true as const, account_id: accountId, messages };
  } catch (err) {
    return {
      ok: false as const,
      account_id: accountId,
      error: err instanceof Error ? err.message : String(err),
      messages: [],
    };
  }
}

export async function getEmailMessage(accountId: string, uid: number) {
  const account = findAccount(accountId);
  if (!account) {
    return accountNotFound(accountId);
  }

  try {
    const message = await readEmail(accountId, uid);
    return { ok: true as const, message };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function markEmailRead(accountId: string, uid: number) {
  const account = findAccount(accountId);
  if (!account) {
    return accountNotFound(accountId);
  }

  try {
    await markAsRead(accountId, uid);
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

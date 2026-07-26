/** 内置 cron：跨 world 同步全部已启用账户，仅自动同步发通知 */
export async function runEmailSyncAllScheduled(): Promise<string> {
  const { syncAllEmailAccounts, collectNewMailSubjects, notifyNewMailFromSyncResults } =
    await import("@freeanima/host/capabilities/connectors/email");
  const results = await syncAllEmailAccounts({ limit: 100 });
  const subjects = collectNewMailSubjects(results);
  const notified = await notifyNewMailFromSyncResults(results);
  return JSON.stringify({
    ok: true,
    accounts: results.length,
    new_messages: subjects.length,
    notified,
    results: results.map((r) => ({
      account_id: r.account_id,
      world_id: r.world_id,
      upserted_messages: r.upserted_messages,
      new_subjects: r.new_subjects.length,
      error: r.error,
    })),
  });
}

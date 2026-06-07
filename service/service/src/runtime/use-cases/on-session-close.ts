/** /new 等关闭旧 session 前钩子（reflect 已移除，浅睡由 cron 承担） */
export async function onSessionCloseBeforeNew(_sessionId: string): Promise<void> {}

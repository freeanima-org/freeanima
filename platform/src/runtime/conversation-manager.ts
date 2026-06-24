export class ConversationManager {
  private chains = new Map<string, Promise<unknown>>();

  runExclusive<T>(conversationId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(conversationId) ?? Promise.resolve();
    const next = prev.then(() => fn());
    this.chains.set(
      conversationId,
      next.catch(() => undefined),
    );
    return next;
  }
}

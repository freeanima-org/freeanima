export class SessionManager {
  private chains = new Map<string, Promise<unknown>>();

  runExclusive<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(sessionId) ?? Promise.resolve();
    const next = prev.then(() => fn());
    this.chains.set(
      sessionId,
      next.catch(() => undefined),
    );
    return next;
  }
}

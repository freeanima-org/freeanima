/** 同一 ACP agent 子进程上串行执行 prompt，避免 stdio 交错 */
export class AcpAgentQueue {
  private tail: Promise<void> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(() => fn());
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

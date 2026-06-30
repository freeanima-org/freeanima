/** Serialize prompts on the same ACP agent subprocess to avoid stdio interleaving */
export class AcpAgentQueue {
  private tail: Promise<void> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(() => fn());
    this.tail = run.then(
      () => {},
      () => {},
    );
    return run;
  }
}

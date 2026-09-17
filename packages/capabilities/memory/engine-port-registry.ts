/** Shared register/run/reset pattern for memory LLM engine ports */
export function createEnginePort<I, R>(label: string) {
  let engineFn: ((input: I) => Promise<R>) | null = null;

  return {
    register(fn: (input: I) => Promise<R>): void {
      engineFn = fn;
    },
    resetForTests(): void {
      engineFn = null;
    },
    isRegistered(): boolean {
      return engineFn != null;
    },
    async run(input: I): Promise<R> {
      if (!engineFn) {
        throw new Error(`${label} not configured: call register at service startup`);
      }
      return engineFn(input);
    },
  };
}

/** Shared register/get/reset pattern for memory capability ports */
export function createMemoryPortRegistry<T>(label: string) {
  let store: T | null = null;
  return {
    register(next: T): void {
      store = next;
    },
    get(): T {
      if (!store) {
        throw new Error(`${label} not configured: call register at service startup`);
      }
      return store;
    },
    resetForTests(): void {
      store = null;
    },
  };
}

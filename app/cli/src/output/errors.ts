/** Terminal-facing CLI error messages (no stack by default) */
export function cliError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function printCliError(err: unknown): void {
  console.error(cliError(err));
  if (process.env.DEBUG === "1" && err instanceof Error && err.stack) {
    console.error(err.stack);
  }
}

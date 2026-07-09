import { resolveValue } from "@freeanima/platform/config";
import type { EmailAccountRow } from "@freeanima/features/email/domain";

export async function resolveEmailAccountPassword(
  account: Pick<EmailAccountRow, "password">,
): Promise<string> {
  return resolveValue(account.password);
}

export async function assertEmailPasswordResolvable(
  account: Pick<EmailAccountRow, "password">,
): Promise<void> {
  try {
    await resolveEmailAccountPassword(account);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Email password could not be resolved: ${msg}`, { cause: err });
  }
}

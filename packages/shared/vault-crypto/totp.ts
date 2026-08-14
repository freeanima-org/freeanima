/** RFC 6238 TOTP 薄封装：算法与 Base32 边界交给 otpauth。 */

import * as OTPAuth from "otpauth";

const DEFAULT_PERIOD_SEC = 30;
const DEFAULT_DIGITS = 6;

export type TotpCodeResult = {
  code: string;
  period: number;
  periodRemaining: number;
};

/** 去空格；若为 otpauth:// URI 则提取 secret。失败返回空串。 */
export function normalizeTotpSecret(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  if (/^otpauth:\/\//i.test(trimmed)) {
    try {
      const parsed = OTPAuth.URI.parse(trimmed);
      const base32 = parsed.secret?.base32;
      return typeof base32 === "string" ? base32.replace(/=+$/g, "") : "";
    } catch {
      return "";
    }
  }

  return trimmed.replace(/[\s=-]+/g, "").toUpperCase();
}

function createTotp(
  secretBase32: string,
  opts?: { period?: number; digits?: number },
): OTPAuth.TOTP | null {
  const period = opts?.period ?? DEFAULT_PERIOD_SEC;
  const digits = opts?.digits ?? DEFAULT_DIGITS;
  if (period <= 0 || digits < 6 || digits > 8) return null;

  const cleaned = normalizeTotpSecret(secretBase32);
  if (!cleaned) return null;

  try {
    const secret = OTPAuth.Secret.fromBase32(cleaned);
    return new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits,
      period,
      secret,
    });
  } catch {
    return null;
  }
}

export function generateTotpCode(
  secret: string,
  nowMs: number = Date.now(),
  opts?: { period?: number; digits?: number },
): TotpCodeResult | null {
  const totp = createTotp(secret, opts);
  if (!totp) return null;

  const period = totp.period;
  const nowSec = Math.floor(nowMs / 1000);
  const periodRemaining = period - (nowSec % period);
  const code = totp.generate({ timestamp: nowMs });
  return { code, period, periodRemaining };
}

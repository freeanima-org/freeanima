export type PasswordGenOptions = {
  length?: number | undefined;
  upper?: boolean | undefined;
  lower?: boolean | undefined;
  digits?: boolean | undefined;
  symbols?: boolean | undefined;
};

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+";

export function generatePassword(opts: PasswordGenOptions = {}): string {
  const length = Math.min(128, Math.max(5, opts.length ?? 20));
  const upper = opts.upper !== false;
  const lower = opts.lower !== false;
  const digits = opts.digits !== false;
  const symbols = opts.symbols === true;
  let alphabet = "";
  if (upper) alphabet += UPPER;
  if (lower) alphabet += LOWER;
  if (digits) alphabet += DIGITS;
  if (symbols) alphabet += SYMBOLS;
  if (!alphabet) alphabet = LOWER + DIGITS;
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    const b = bytes[i] ?? 0;
    out += alphabet[b % alphabet.length] ?? "x";
  }
  return out;
}

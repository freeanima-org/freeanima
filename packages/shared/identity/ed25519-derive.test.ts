import { describe, expect, it } from "bun:test";

import {
  deriveEd25519KeyPair,
  formatHabitatInstanceId,
  HABITAT_ED25519_INFO,
  signEd25519,
  subjectKeySalt,
  verifyEd25519,
} from "./ed25519-derive.ts";

describe("deriveEd25519KeyPair", () => {
  it("is deterministic for same salt+ikm", () => {
    const ikm = new Uint8Array(32).fill(7);
    const a = deriveEd25519KeyPair({
      salt: "fa_inst_abc",
      info: HABITAT_ED25519_INFO,
      ikm,
    });
    const b = deriveEd25519KeyPair({
      salt: "fa_inst_abc",
      info: HABITAT_ED25519_INFO,
      ikm,
    });
    expect(a).toEqual(b);
    const sig = signEd25519("hello", a.private_key);
    expect(verifyEd25519("hello", sig, a.public_key)).toBe(true);
    expect(verifyEd25519("other", sig, a.public_key)).toBe(false);
  });

  it("changes when salt changes", () => {
    const ikm = new Uint8Array(32).fill(3);
    const a = deriveEd25519KeyPair({ salt: "s1", info: HABITAT_ED25519_INFO, ikm });
    const b = deriveEd25519KeyPair({ salt: "s2", info: HABITAT_ED25519_INFO, ikm });
    expect(a.public_key).not.toBe(b.public_key);
  });

  it("formats habitat instance id and subject salt", () => {
    expect(formatHabitatInstanceId("abc")).toBe("fa_inst_abc");
    expect(subjectKeySalt("fa_inst_abc", "subj")).toBe("fa_inst_abc:subj");
  });
});

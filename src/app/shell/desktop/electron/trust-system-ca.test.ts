import { describe, expect, mock, test } from "bun:test";

import {
  mergeBundledAndSystemCaCertificates,
  trustSystemCaCertificates,
  type TrustSystemCaDeps,
} from "./trust-system-ca.ts";

describe("mergeBundledAndSystemCaCertificates", () => {
  test("去重合并 bundled 与 system", () => {
    expect(mergeBundledAndSystemCaCertificates(["A", "B"], ["B", "C"])).toEqual(["A", "B", "C"]);
  });
});

describe("trustSystemCaCertificates", () => {
  test("合并 system + bundled 并调用 setDefaultCACertificates", () => {
    const setDefault = mock((certs: readonly string[]) => {
      void certs;
    });
    const deps: TrustSystemCaDeps = {
      getCACertificates: (type) => {
        if (type === "system") return ["SYSTEM_A", "SYSTEM_B"];
        if (type === "bundled") return ["BUNDLED_A", "SYSTEM_A"];
        return [];
      },
      setDefaultCACertificates: setDefault,
    };
    const result = trustSystemCaCertificates(deps);
    expect(result).toEqual({ ok: true, systemCount: 2, mergedCount: 3 });
    expect(setDefault).toHaveBeenCalledTimes(1);
    expect(setDefault.mock.calls[0]?.[0]).toEqual(["BUNDLED_A", "SYSTEM_A", "SYSTEM_B"]);
  });

  test("系统 CA 为空时返回失败", () => {
    const setDefault = mock((certs: readonly string[]) => {
      void certs;
    });
    expect(
      trustSystemCaCertificates({
        getCACertificates: () => [],
        setDefaultCACertificates: setDefault,
      }),
    ).toEqual({ ok: false, reason: "系统 CA 为空" });
    expect(setDefault).not.toHaveBeenCalled();
  });
});

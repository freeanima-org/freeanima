import { describe, expect, mock, test } from "bun:test";

import { dispatchVaultFillMessage } from "./fill-dispatch.ts";

describe("dispatchVaultFillMessage", () => {
  test("fill_login 无视焦点", () => {
    const fillLogin = mock(() => undefined);
    dispatchVaultFillMessage(
      { type: "fill_login", fill: { username: "u", password: "p" } },
      {
        hasFocus: () => false,
        fillLogin,
        fillActiveField: mock(() => undefined),
        fillCard: mock(() => undefined),
        fillIdentity: mock(() => undefined),
      },
    );
    expect(fillLogin).toHaveBeenCalledTimes(1);
  });

  test("fill_password_only 无焦点时跳过", () => {
    const fillActiveField = mock(() => undefined);
    dispatchVaultFillMessage(
      { type: "fill_password_only", password: "secret" },
      {
        hasFocus: () => false,
        fillLogin: mock(() => undefined),
        fillActiveField,
        fillCard: mock(() => undefined),
        fillIdentity: mock(() => undefined),
      },
    );
    expect(fillActiveField).toHaveBeenCalledTimes(0);
  });

  test("fill_field 有焦点时写入", () => {
    const fillActiveField = mock(() => undefined);
    dispatchVaultFillMessage(
      { type: "fill_field", value: "alice" },
      {
        hasFocus: () => true,
        fillLogin: mock(() => undefined),
        fillActiveField,
        fillCard: mock(() => undefined),
        fillIdentity: mock(() => undefined),
      },
    );
    expect(fillActiveField).toHaveBeenCalledWith("alice");
  });
});

import {
  hasPasswordNearby,
  hasUsernameSignal,
  isCaptchaOrSmsCodeField,
  isLoginCredentialField,
  isNonLoginField,
  isTotpField,
} from "./dom-fill.ts";

type MockInputOpts = {
  type?: string;
  name?: string;
  id?: string;
  autocomplete?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
};

type MockInput = HTMLInputElement & {
  _form: HTMLFormElement | null;
  _parent: Element | null;
};

function makeInput(opts: MockInputOpts = {}): MockInput {
  const el = {
    type: opts.type ?? "text",
    name: opts.name ?? "",
    id: opts.id ?? "",
    autocomplete: opts.autocomplete ?? "",
    placeholder: opts.placeholder ?? "",
    disabled: opts.disabled ?? false,
    readOnly: opts.readOnly ?? false,
    _form: null as HTMLFormElement | null,
    _parent: null as Element | null,
    get form() {
      return this._form;
    },
    get parentElement() {
      return this._parent;
    },
  };
  return el as MockInput;
}

function makeForm(inputs: MockInput[]): HTMLFormElement {
  for (const input of inputs) input._form = null;
  const form = {
    querySelectorAll(sel: string) {
      if (sel !== "input") return [] as unknown as NodeListOf<Element>;
      return inputs as unknown as NodeListOf<Element>;
    },
  } as HTMLFormElement;
  for (const input of inputs) input._form = form;
  return form;
}

function makeParent(inputs: MockInput[]): Element {
  const parent = {
    parentElement: null as Element | null,
    querySelectorAll(sel: string) {
      if (sel !== "input") return [] as unknown as NodeListOf<Element>;
      return inputs as unknown as NodeListOf<Element>;
    },
  } as Element & { parentElement: Element | null };
  for (const input of inputs) {
    input._form = null;
    input._parent = parent;
  }
  return parent;
}

describe("isLoginCredentialField", () => {
  test("password → true", () => {
    expect(isLoginCredentialField(makeInput({ type: "password" }))).toBe(true);
  });

  test("任意 text、无 password 邻接 → false", () => {
    const alone = makeInput({ type: "text" });
    makeParent([alone]);
    expect(isLoginCredentialField(alone)).toBe(false);
  });

  test("text + 同 form password → true", () => {
    const user = makeInput({ type: "text" });
    const pass = makeInput({ type: "password" });
    makeForm([user, pass]);
    expect(isLoginCredentialField(user)).toBe(true);
  });

  test("autocomplete=username → true", () => {
    const el = makeInput({ type: "text", autocomplete: "username" });
    makeParent([el]);
    expect(isLoginCredentialField(el)).toBe(true);
  });

  test("type=email → true", () => {
    expect(isLoginCredentialField(makeInput({ type: "email" }))).toBe(true);
  });

  test("name 含 user → true", () => {
    expect(isLoginCredentialField(makeInput({ type: "text", name: "username" }))).toBe(true);
  });

  test("search → false", () => {
    expect(isLoginCredentialField(makeInput({ type: "search" }))).toBe(false);
    expect(
      isLoginCredentialField(makeInput({ type: "text", name: "q", placeholder: "Search…" })),
    ).toBe(false);
  });

  test("TOTP → true", () => {
    expect(isLoginCredentialField(makeInput({ type: "text", autocomplete: "one-time-code" }))).toBe(
      true,
    );
    expect(isLoginCredentialField(makeInput({ type: "text", name: "totp" }))).toBe(true);
    expect(isLoginCredentialField(makeInput({ type: "text", placeholder: "身份验证器" }))).toBe(
      true,
    );
  });

  test("验证码 / 图形验证码 / 手机验证码 → false", () => {
    expect(isLoginCredentialField(makeInput({ type: "text", placeholder: "验证码" }))).toBe(false);
    expect(isLoginCredentialField(makeInput({ type: "text", name: "captcha" }))).toBe(false);
    expect(isLoginCredentialField(makeInput({ type: "text", placeholder: "图形验证码" }))).toBe(
      false,
    );
    expect(isLoginCredentialField(makeInput({ type: "text", placeholder: "手机验证码" }))).toBe(
      false,
    );
    expect(isLoginCredentialField(makeInput({ type: "text", name: "sms_code" }))).toBe(false);
  });

  test("hidden / disabled / readOnly → false", () => {
    expect(isLoginCredentialField(makeInput({ type: "hidden" }))).toBe(false);
    expect(isLoginCredentialField(makeInput({ type: "password", disabled: true }))).toBe(false);
    expect(isLoginCredentialField(makeInput({ type: "password", readOnly: true }))).toBe(false);
  });

  test("无 form 时父节点内 password 仍触发", () => {
    const user = makeInput({ type: "text" });
    const pass = makeInput({ type: "password" });
    makeParent([user, pass]);
    expect(isLoginCredentialField(user)).toBe(true);
  });
});

describe("isTotpField / isCaptchaOrSmsCodeField", () => {
  test("isTotpField", () => {
    expect(isTotpField(makeInput({ name: "totp" }))).toBe(true);
    expect(isTotpField(makeInput({ autocomplete: "one-time-code" }))).toBe(true);
    expect(isTotpField(makeInput({ placeholder: "Authenticator code" }))).toBe(true);
    expect(isTotpField(makeInput({ placeholder: "验证码" }))).toBe(false);
    expect(isTotpField(makeInput({ name: "captcha" }))).toBe(false);
  });

  test("isCaptchaOrSmsCodeField", () => {
    expect(isCaptchaOrSmsCodeField(makeInput({ placeholder: "验证码" }))).toBe(true);
    expect(isCaptchaOrSmsCodeField(makeInput({ placeholder: "图形验证码" }))).toBe(true);
    expect(isCaptchaOrSmsCodeField(makeInput({ placeholder: "手机验证码" }))).toBe(true);
    expect(isCaptchaOrSmsCodeField(makeInput({ name: "sms-code" }))).toBe(true);
    expect(isCaptchaOrSmsCodeField(makeInput({ name: "totp" }))).toBe(false);
  });
});

describe("hasUsernameSignal / isNonLoginField / hasPasswordNearby", () => {
  test("hasUsernameSignal", () => {
    expect(hasUsernameSignal(makeInput({ autocomplete: "username" }))).toBe(true);
    expect(hasUsernameSignal(makeInput({ name: "account" }))).toBe(true);
    expect(hasUsernameSignal(makeInput({ type: "text" }))).toBe(false);
  });

  test("isNonLoginField", () => {
    expect(isNonLoginField(makeInput({ type: "search" }))).toBe(true);
    expect(isNonLoginField(makeInput({ id: "filter-box" }))).toBe(true);
    expect(isNonLoginField(makeInput({ name: "username" }))).toBe(false);
  });

  test("hasPasswordNearby via form", () => {
    const user = makeInput({ type: "text" });
    const pass = makeInput({ type: "password" });
    makeForm([user, pass]);
    expect(hasPasswordNearby(user)).toBe(true);
  });
});

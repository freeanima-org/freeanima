import type { FillPayload } from "../../runtime/messages.ts";

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function visibleInputs(): HTMLInputElement[] {
  return [...document.querySelectorAll("input")].filter((el) => {
    if (el instanceof HTMLInputElement === false) return false;
    if (el.type === "hidden" || el.disabled || el.readOnly) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return true;
  }) as HTMLInputElement[];
}

/** 搜索/筛选等非登录语义 */
export function isNonLoginField(el: HTMLInputElement): boolean {
  if (el.type === "search") return true;
  const t = `${el.name} ${el.id} ${el.autocomplete} ${el.placeholder}`.toLowerCase();
  return t.includes("search") || t.includes("query") || t.includes("filter");
}

function isTextLikeUsernameType(el: HTMLInputElement): boolean {
  return el.type === "text" || el.type === "email" || el.type === "";
}

/** 用户名/邮箱信号（不含「任意 text」兜底） */
export function hasUsernameSignal(el: HTMLInputElement): boolean {
  if (el.type === "email") return true;
  if (el.autocomplete === "username" || el.autocomplete === "email") return true;
  const t = `${el.name} ${el.id} ${el.autocomplete} ${el.placeholder}`.toLowerCase();
  return t.includes("user") || t.includes("email") || t.includes("login") || t.includes("account");
}

function passwordEligible(el: HTMLInputElement): boolean {
  return el.type === "password" && !el.disabled && !el.readOnly;
}

function iterPasswordCandidates(scope: ParentNode): HTMLInputElement[] {
  return [...scope.querySelectorAll("input")] as HTMLInputElement[];
}

/** 同 form，或无 form 时向上若干层父节点内，是否存在 password */
export function hasPasswordNearby(el: HTMLInputElement): boolean {
  if (el.form) {
    return iterPasswordCandidates(el.form).some((input) => input !== el && passwordEligible(input));
  }
  let node: Element | null = el.parentElement;
  for (let depth = 0; depth < 4 && node; depth++, node = node.parentElement) {
    if (iterPasswordCandidates(node).some((input) => input !== el && passwordEligible(input))) {
      return true;
    }
  }
  return false;
}

function fieldText(el: HTMLInputElement): string {
  return `${el.name} ${el.id} ${el.autocomplete} ${el.placeholder}`.toLowerCase();
}

/**
 * 图形验证码 / 短信 / 手机验证码等：不弹页内浮层，也不作为 TOTP 填充目标。
 * 笼统「验证码」在无 TOTP 正向信号时归此类。
 */
export function isCaptchaOrSmsCodeField(el: HTMLInputElement): boolean {
  const t = fieldText(el);
  if (
    t.includes("captcha") ||
    t.includes("recaptcha") ||
    t.includes("hcaptcha") ||
    t.includes("图形验证码") ||
    t.includes("图片验证码") ||
    t.includes("短信验证码") ||
    t.includes("手机验证码") ||
    t.includes("手机号验证码") ||
    (t.includes("短信") && t.includes("验证")) ||
    t.includes("sms") ||
    /phone[_\s-]?code/.test(t) ||
    /mobile[_\s-]?code/.test(t) ||
    /短信码/.test(t)
  ) {
    return true;
  }
  // 裸「验证码」且无 TOTP 信号 → 当作短信/通用验证码
  if (t.includes("验证码") && !hasTotpPositiveSignal(el)) return true;
  return false;
}

function hasTotpPositiveSignal(el: HTMLInputElement): boolean {
  const t = fieldText(el);
  if (el.autocomplete === "one-time-code") return true;
  return (
    t.includes("totp") ||
    t.includes("authenticator") ||
    t.includes("2fa") ||
    t.includes("mfa") ||
    t.includes("one-time") ||
    t.includes("onetime") ||
    t.includes("otp") ||
    t.includes("动态口令") ||
    t.includes("动态验证码") ||
    t.includes("身份验证器") ||
    t.includes("谷歌验证") ||
    t.includes("google auth")
  );
}

/** TOTP / 身份验证器类一次性码输入框（应弹页内浮层） */
export function isTotpField(el: HTMLInputElement): boolean {
  if (el.type === "hidden" || el.disabled || el.readOnly) return false;
  if (el.type === "password") return false;
  if (isCaptchaOrSmsCodeField(el)) return false;
  return hasTotpPositiveSignal(el);
}

function scoreTotp(el: HTMLInputElement): number {
  return isTotpField(el) ? 10 : 0;
}

/**
 * 填充/保存时的用户名打分。
 * 关键词与 email 类型优先；与 password 同表单的裸 text 给邻接分，避免无法填无名用户名框。
 */
function scoreUsername(el: HTMLInputElement): number {
  if (el.type === "password") return -100;
  if (isNonLoginField(el)) return 0;
  if (isCaptchaOrSmsCodeField(el) || isTotpField(el)) return 0;
  if (hasUsernameSignal(el)) return 10;
  if (isTextLikeUsernameType(el) && hasPasswordNearby(el)) return 5;
  return 0;
}

function scorePassword(el: HTMLInputElement): number {
  return el.type === "password" ? 10 : 0;
}

/** 用户名、密码或 TOTP 输入框（用于页内自动填充浮层） */
export function isLoginCredentialField(el: HTMLInputElement): boolean {
  if (el.type === "hidden" || el.disabled || el.readOnly) return false;
  if (scorePassword(el) > 0) return true;
  if (isCaptchaOrSmsCodeField(el)) return false;
  if (isTotpField(el)) return true;
  if (isNonLoginField(el)) return false;
  if (hasUsernameSignal(el)) return true;
  if (isTextLikeUsernameType(el) && hasPasswordNearby(el)) return true;
  return false;
}

export function fillLogin(fill: FillPayload): void {
  const inputs = visibleInputs();
  const userEl = inputs.toSorted((a, b) => scoreUsername(b) - scoreUsername(a))[0];
  const passEl = inputs.toSorted((a, b) => scorePassword(b) - scorePassword(a))[0];
  const totpEl = inputs.toSorted((a, b) => scoreTotp(b) - scoreTotp(a))[0];
  if (fill.username && userEl && scoreUsername(userEl) > 0) setNativeValue(userEl, fill.username);
  if (fill.password && passEl && scorePassword(passEl) > 0) setNativeValue(passEl, fill.password);
  if (fill.totp && totpEl && scoreTotp(totpEl) > 0) setNativeValue(totpEl, fill.totp);
}

export function fillActiveField(value: string): void {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    setNativeValue(el, value);
  }
}

/** 向指定输入框写入（页内浮层在 mousedown 保焦时用） */
export function fillInputElement(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  setNativeValue(el, value);
}

export function fillCard(fill: FillPayload): void {
  const card = fill.card;
  if (!card) return;
  const map: Array<[RegExp, string | undefined]> = [
    [/cc-number|cardnumber|card-number|card_number/i, card.number],
    [/cc-name|cardholder|card-name/i, card.cardholder],
    [
      /cc-exp|exp|expiry/i,
      card.exp_month && card.exp_year ? `${card.exp_month}/${card.exp_year}` : undefined,
    ],
    [/cc-csc|cvc|cvv|security/i, card.code],
  ];
  for (const input of visibleInputs()) {
    const key = `${input.name} ${input.id} ${input.autocomplete}`;
    for (const [re, val] of map) {
      if (val && re.test(key)) setNativeValue(input, val);
    }
  }
}

export function fillIdentity(fill: FillPayload): void {
  const id = fill.identity;
  if (!id) return;
  const map: Array<[RegExp, string | undefined]> = [
    [/email/i, id.email],
    [/phone|tel/i, id.phone],
    [/given-name|firstname|first_name|fname/i, id.first_name],
    [/family-name|lastname|last_name|lname/i, id.last_name],
    [/organization|company/i, id.company],
    [/address-line1|address1|street/i, id.address1],
    [/address-line2|address2/i, id.address2],
    [/address-level2|city/i, id.city],
    [/address-level1|state|province/i, id.state],
    [/postal-code|zip|postal/i, id.postal_code],
    [/country/i, id.country],
    [/username/i, id.username],
  ];
  for (const input of visibleInputs()) {
    const key = `${input.name} ${input.id} ${input.autocomplete}`;
    for (const [re, val] of map) {
      if (val && re.test(key)) setNativeValue(input, val);
    }
  }
}

export function readLoginForm(): { username: string; password: string } | null {
  const inputs = visibleInputs();
  const passEl = inputs.find((el) => el.type === "password");
  if (!passEl?.value) return null;
  const userEl = inputs
    .filter((el) => el !== passEl)
    .toSorted((a, b) => scoreUsername(b) - scoreUsername(a))[0];
  return {
    username: userEl?.value ?? "",
    password: passEl.value,
  };
}

export function attachSavePrompt(
  onSubmit: (creds: { username: string; password: string }) => void,
): void {
  document.addEventListener(
    "submit",
    (ev) => {
      const form = ev.target;
      if (!(form instanceof HTMLFormElement)) return;
      const creds = readLoginForm();
      if (!creds?.password) return;
      onSubmit(creds);
    },
    true,
  );
}

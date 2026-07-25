import { describe, expect, test } from "bun:test";
import { buildNewMailNotificationContent } from "./new-mail-notify.ts";

describe("buildNewMailNotificationContent", () => {
  test("single subject becomes title", () => {
    const { title, body } = buildNewMailNotificationContent(["Hello"]);
    expect(title).toBe("新邮件：Hello");
    expect(body).toBe("Hello");
  });

  test("multiple subjects are listed", () => {
    const { title, body } = buildNewMailNotificationContent(["A", "B", "C"]);
    expect(title).toBe("新邮件：3 封");
    expect(body).toContain("• A");
    expect(body).toContain("• C");
  });
});

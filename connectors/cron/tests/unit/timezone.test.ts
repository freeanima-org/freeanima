import { describe, it, expect } from "bun:test";
import { cstCronToUtc } from "../../src/timezone.ts";

describe("cstCronToUtc", () => {
  it("converts simple hour from CST to UTC", () => {
    expect(cstCronToUtc("0 2 * * *")).toBe("0 18 * * *");
    expect(cstCronToUtc("0 3 * * *")).toBe("0 19 * * *");
    expect(cstCronToUtc("30 8 * * *")).toBe("30 0 * * *");
  });

  it("leaves minute-step expressions unchanged", () => {
    expect(cstCronToUtc("*/15 * * * *")).toBe("*/15 * * * *");
    expect(cstCronToUtc("*/30 * * * *")).toBe("*/30 * * * *");
  });

  it("leaves wildcard hour unchanged", () => {
    expect(cstCronToUtc("0 * * * *")).toBe("0 * * * *");
    expect(cstCronToUtc("0 */2 * * *")).toBe("0 */2 * * *");
  });
});

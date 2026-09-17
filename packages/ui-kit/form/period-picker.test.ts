import { describe, expect, test } from "bun:test";

import { monthPeriodStart } from "./MonthPickerPanel.tsx";
import { yearPeriodStart } from "./YearPickerPanel.tsx";

describe("MonthPickerPanel helpers", () => {
  test("monthPeriodStart formats YYYY-MM-01", () => {
    expect(monthPeriodStart(2026, 3)).toBe("2026-03-01");
    expect(monthPeriodStart(2026, 11)).toBe("2026-11-01");
  });
});

describe("YearPickerPanel helpers", () => {
  test("yearPeriodStart formats YYYY-01-01", () => {
    expect(yearPeriodStart(2026)).toBe("2026-01-01");
    expect(yearPeriodStart(1999)).toBe("1999-01-01");
  });
});

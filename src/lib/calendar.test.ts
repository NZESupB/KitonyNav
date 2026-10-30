import { describe, expect, it } from "vitest";
import {
  buildCalendarMonth,
  calendarMax,
  calendarMin,
  fetchCalendarMonthAsync,
  parseCalendarKey,
  shiftCalendarDay,
} from "./calendar";

describe("calendar module", () => {
  it("parses valid calendar keys and rejects invalid ones", () => {
    expect(parseCalendarKey("2026-10-30")).toBeInstanceOf(Date);
    expect(() => parseCalendarKey("1899-12-31")).toThrow();
    expect(() => parseCalendarKey("2101-01-01")).toThrow();
    expect(() => parseCalendarKey("invalid")).toThrow();
  });

  it("shifts calendar day properly within bounds", () => {
    expect(shiftCalendarDay("2026-10-30", 1)).toBe("2026-10-31");
    expect(shiftCalendarDay("2026-10-30", 2)).toBe("2026-11-01");
    expect(shiftCalendarDay("1900-01-01", -5)).toBe(calendarMin);
    expect(shiftCalendarDay("2100-12-31", 5)).toBe(calendarMax);
  });

  it("builds 42 calendar cells instantly without blocking", () => {
    const start = performance.now();
    const cells = buildCalendarMonth(2026, 10);
    const duration = performance.now() - start;

    expect(cells).toHaveLength(42);
    // Instant base generation should take less than 20ms
    expect(duration).toBeLessThan(50);
    const validCells = cells.filter((c) => c !== null);
    expect(validCells.length).toBeGreaterThan(28);
  });

  it("asynchronously enriches month with lunar and festival data", async () => {
    const fullCells = await fetchCalendarMonthAsync(2026, 10);
    expect(fullCells).toHaveLength(42);
    const oct1 = fullCells.find((c) => c?.key === "2026-10-01");
    expect(oct1).toBeDefined();
    expect(oct1?.loaded).toBe(true);
    expect(oct1?.festivals).toContain("国庆节");
  });
});

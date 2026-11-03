import { describe, expect, it } from "vitest";
import { defaultAppearance } from "./appearance";
import {
  cachedDateTimeFormat,
  dateKey,
  formatClock,
  getIntlLunarSummary,
  safeTimezone,
} from "./time";

describe("time module", () => {
  it("cachedDateTimeFormat returns identical instance for same arguments and different instances for different arguments", () => {
    const opts1: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "numeric" };
    const opts2: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "numeric" };
    const optsDiff: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

    const fmt1 = cachedDateTimeFormat("zh-CN", opts1);
    const fmt2 = cachedDateTimeFormat("zh-CN", opts2);
    const fmtDiffLocale = cachedDateTimeFormat("en-US", opts1);
    const fmtDiffOpts = cachedDateTimeFormat("zh-CN", optsDiff);

    expect(fmt1).toBe(fmt2);
    expect(fmt1).not.toBe(fmtDiffLocale);
    expect(fmt1).not.toBe(fmtDiffOpts);
  });

  it("safeTimezone validates timezones correctly and uses cache", () => {
    expect(safeTimezone("Asia/Shanghai")).toBe("Asia/Shanghai");
    expect(safeTimezone("Not/AZone")).toBeUndefined();
    expect(safeTimezone("")).toBeUndefined();
    expect(safeTimezone("   ")).toBeUndefined();
    expect(safeTimezone(undefined)).toBeUndefined();

    // 再次调用命中缓存
    expect(safeTimezone("Asia/Shanghai")).toBe("Asia/Shanghai");
    expect(safeTimezone("Not/AZone")).toBeUndefined();
  });

  it("dateKey extracts correct YYYY-MM-DD avoiding UTC day boundary offsets", () => {
    const date = new Date("2024-01-01T16:30:00Z");
    expect(dateKey(date, "Asia/Shanghai")).toBe("2024-01-02");
    expect(dateKey(date, "America/New_York")).toBe("2024-01-01");
  });

  it("formatClock formats 24h with seconds, 24h without seconds, and 12h formats consistently", () => {
    const fixedTime = new Date("2024-03-11T09:05:06Z");

    // 1. 24 小时制带秒
    const result24WithSec = formatClock(fixedTime, "Asia/Shanghai", {
      ...defaultAppearance,
      clock24Hour: true,
      clockSeconds: true,
    });
    expect(result24WithSec.time).toBe("17:05:06");
    expect(result24WithSec.date).toBe("3月11日 周一");
    expect(result24WithSec.hours).toBe("17");
    expect(result24WithSec.minutes).toBe("05");
    expect(result24WithSec.seconds).toBe("06");
    expect(result24WithSec.period).toBeUndefined();

    // 2. 24 小时制不带秒
    const result24NoSec = formatClock(fixedTime, "Asia/Shanghai", {
      ...defaultAppearance,
      clock24Hour: true,
      clockSeconds: false,
    });
    expect(result24NoSec.time).toBe("17:05");
    expect(result24NoSec.date).toBe("3月11日 周一");
    expect(result24NoSec.hours).toBe("17");
    expect(result24NoSec.minutes).toBe("05");
    expect(result24NoSec.seconds).toBe("");
    expect(result24NoSec.period).toBeUndefined();

    // 3. 12 小时制
    const result12 = formatClock(fixedTime, "Asia/Shanghai", {
      ...defaultAppearance,
      clock24Hour: false,
      clockSeconds: true,
    });
    expect(result12.time).toBe("05:05:06 PM");
    expect(result12.date).toBe("3月11日 周一");
    expect(result12.hours).toBe("05");
    expect(result12.minutes).toBe("05");
    expect(result12.seconds).toBe("06");
    expect(result12.period).toBe("PM");
  });

  it("getIntlLunarSummary returns non-empty string and is consistent across calls", () => {
    const fixedDate = new Date("2024-02-10T12:00:00Z"); // 农历正月初一
    const summary1 = getIntlLunarSummary(fixedDate, "Asia/Shanghai");
    expect(summary1).toBe("正月初一");

    const summary2 = getIntlLunarSummary(fixedDate, "Asia/Shanghai");
    expect(summary2).toBe("正月初一");
    expect(summary2).toBe(summary1);
  });
});

import type { AppearanceSettings } from "./appearance";

/**
 * 校验并规范化时区字符串；无效或不支持时返回 undefined，安全回退到当前运行环境时区
 */
export function safeTimezone(value?: string): string | undefined {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  const trimmed = value.trim();
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    return undefined;
  }
}

/**
 * 使用 Intl formatToParts 提取指定时区下的 YYYY-MM-DD 日期键
 * 避免 ISOString 截断导致的 UTC 跨时区偏差
 */
export function dateKey(now: Date, timezone?: string): string {
  const tz = safeTimezone(timezone);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

const CHINESE_LUNAR_DAYS = [
  "",
  "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
];

const lunarSummaryCache = new Map<string, string>();

/**
 * 使用原生 Intl 获取轻量农历摘要（如「正月廿三」），首屏零外部包依赖
 * 按日缓存，避免秒级刷新时重复执行 Intl 格式化计算
 */
export function getIntlLunarSummary(now: Date, timezone?: string): string {
  const key = dateKey(now, timezone);
  const cacheKey = `${key}_${safeTimezone(timezone) ?? ""}`;
  const cached = lunarSummaryCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let summary = "";
  try {
    const tz = safeTimezone(timezone);
    const dtf = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
      timeZone: tz,
      month: "long",
      day: "numeric",
    });
    const parts = dtf.formatToParts(now);
    let month = parts.find((p) => p.type === "month")?.value || "";
    const dayStr = parts.find((p) => p.type === "day")?.value || "";
    const dayNum = parseInt(dayStr, 10);
    const dayName = CHINESE_LUNAR_DAYS[dayNum] || dayStr;

    if (month === "一月") month = "正月";
    else if (month === "十一月") month = "冬月";
    else if (month === "十二月") month = "腊月";

    summary = month + dayName;
  } catch {
    summary = "";
  }

  // 控制缓存上限
  if (lunarSummaryCache.size > 50) {
    lunarSummaryCache.clear();
  }
  lunarSummaryCache.set(cacheKey, summary);
  return summary;
}

export type FormattedClock = {
  time: string;
  date: string;
  hours: string;
  minutes: string;
  seconds: string;
  period?: string;
  weekday: string;
  monthDay: string;
};

/**
 * 格式化时钟与日期文本
 */
export function formatClock(
  now: Date,
  timezone?: string,
  appearance?: AppearanceSettings,
): FormattedClock {
  const tz = safeTimezone(timezone);
  const is24Hour = appearance?.clock24Hour !== false;
  const showSeconds = appearance?.clockSeconds !== false;

  // 时间格式化
  const timeFormatter = new Intl.DateTimeFormat(is24Hour ? "zh-CN" : "en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: showSeconds ? "2-digit" : undefined,
    hour12: !is24Hour,
    hourCycle: is24Hour ? "h23" : "h12",
  });

  const timeParts = timeFormatter.formatToParts(now);
  const hours = timeParts.find((p) => p.type === "hour")?.value ?? "";
  const minutes = timeParts.find((p) => p.type === "minute")?.value ?? "";
  const seconds = timeParts.find((p) => p.type === "second")?.value ?? "";
  const period = timeParts.find((p) => p.type === "dayPeriod")?.value;

  let timeString = `${hours}:${minutes}`;
  if (showSeconds && seconds) {
    timeString += `:${seconds}`;
  }
  if (!is24Hour && period) {
    timeString += ` ${period.toUpperCase()}`;
  }

  // 日期格式化：3月11日 周二
  const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: tz,
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const dateParts = dateFormatter.formatToParts(now);
  const m = dateParts.find((p) => p.type === "month")?.value ?? "";
  const d = dateParts.find((p) => p.type === "day")?.value ?? "";
  const w = dateParts.find((p) => p.type === "weekday")?.value ?? "";

  const monthDay = `${m}月${d}日`;
  const dateString = `${monthDay} ${w}`;

  return {
    time: timeString,
    date: dateString,
    hours,
    minutes,
    seconds,
    period,
    weekday: w,
    monthDay,
  };
}

import { Solar } from "lunar-typescript";

export const calendarMin = "1900-01-01";
export const calendarMax = "2100-12-31";
export type CalendarDay = {
  key: string; year: number; month: number; day: number; weekday: number;
  lunar: string; lunarShort: string; solarTerm: string; festivals: string[];
};

export function parseCalendarKey(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key < calendarMin || key > calendarMax) throw new RangeError("日期须在 1900–2100 年之间");
  const [year, month, day] = key.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() + 1 !== month || value.getUTCDate() !== day) throw new RangeError("日期不正确");
  return value;
}

export function shiftCalendarDay(key: string, days: number): string {
  const value = parseCalendarKey(key);
  value.setUTCDate(value.getUTCDate() + days);
  const next = value.toISOString().slice(0, 10);
  return next < calendarMin ? calendarMin : next > calendarMax ? calendarMax : next;
}

export function getCalendarDay(key: string): CalendarDay {
  const value = parseCalendarKey(key);
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1;
  const day = value.getUTCDate();
  // 库的公历输入是中国历法的民用日期，节气按北京时间日期标注，不解析为浏览器时区时间戳。
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const lunarMonth = `${lunar.getMonthInChinese()}月`;
  return {
    key, year, month, day, weekday: value.getUTCDay(),
    lunar: `${lunar.getYearInChinese()}年 ${lunarMonth}${lunar.getDayInChinese()}`,
    lunarShort: lunar.getDayInChinese() === "初一" ? lunarMonth : lunar.getDayInChinese(),
    solarTerm: lunar.getJieQi(), festivals: [...new Set([...solar.getFestivals(), ...lunar.getFestivals()])],
  };
}

const monthCache = new Map<string, (CalendarDay | null)[]>();
export function buildCalendarMonth(year: number, month: number): (CalendarDay | null)[] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 1900 || year > 2100 || month < 1 || month > 12) throw new RangeError("月份须在 1900–2100 年之间");
  const cacheKey = `${year}-${month}`;
  const cached = monthCache.get(cacheKey);
  if (cached) return cached;
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => {
    const key = new Date(Date.UTC(year, month - 1, 1 - offset + index)).toISOString().slice(0, 10);
    return key < calendarMin || key > calendarMax ? null : getCalendarDay(key);
  });
  if (monthCache.size >= 12) monthCache.delete(monthCache.keys().next().value!);
  monthCache.set(cacheKey, cells);
  return cells;
}

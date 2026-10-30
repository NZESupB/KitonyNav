export const calendarMin = "1900-01-01";
export const calendarMax = "2100-12-31";

export type CalendarDay = {
  key: string;
  year: number;
  month: number;
  day: number;
  weekday: number;
  lunar: string;
  lunarShort: string;
  solarTerm: string;
  festivals: string[];
  loaded?: boolean;
};

let solarPromise: Promise<typeof import("lunar-typescript").Solar> | null = null;
let cachedSolar: typeof import("lunar-typescript").Solar | null = null;

export function loadLunarModule(): Promise<typeof import("lunar-typescript").Solar> {
  if (cachedSolar) return Promise.resolve(cachedSolar);
  if (!solarPromise) {
    solarPromise = import("lunar-typescript").then((mod) => {
      cachedSolar = mod.Solar;
      return mod.Solar;
    });
  }
  return solarPromise;
}

export function parseCalendarKey(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key < calendarMin || key > calendarMax) {
    throw new RangeError("日期须在 1900–2100 年之间");
  }
  const [year, month, day] = key.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() + 1 !== month || value.getUTCDate() !== day) {
    throw new RangeError("日期不正确");
  }
  return value;
}

export function shiftCalendarDay(key: string, days: number): string {
  const value = parseCalendarKey(key);
  value.setUTCDate(value.getUTCDate() + days);
  const next = value.toISOString().slice(0, 10);
  return next < calendarMin ? calendarMin : next > calendarMax ? calendarMax : next;
}

const dayCache = new Map<string, CalendarDay>();

export function getBaseCalendarDay(key: string): CalendarDay {
  const value = parseCalendarKey(key);
  return {
    key,
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
    weekday: value.getUTCDay(),
    lunar: "",
    lunarShort: "",
    solarTerm: "",
    festivals: [],
    loaded: false,
  };
}

export function computeLunarForDay(key: string, SolarClass: typeof import("lunar-typescript").Solar): CalendarDay {
  const cached = dayCache.get(key);
  if (cached?.loaded) return cached;

  const value = parseCalendarKey(key);
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1;
  const day = value.getUTCDate();

  const solar = SolarClass.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const lunarMonth = `${lunar.getMonthInChinese()}月`;
  const result: CalendarDay = {
    key,
    year,
    month,
    day,
    weekday: value.getUTCDay(),
    lunar: `${lunar.getYearInChinese()}年 ${lunarMonth}${lunar.getDayInChinese()}`,
    lunarShort: lunar.getDayInChinese() === "初一" ? lunarMonth : lunar.getDayInChinese(),
    solarTerm: lunar.getJieQi(),
    festivals: [...new Set([...solar.getFestivals(), ...lunar.getFestivals()])],
    loaded: true,
  };

  if (dayCache.size >= 600) {
    dayCache.delete(dayCache.keys().next().value!);
  }
  dayCache.set(key, result);
  return result;
}

export function getCalendarDay(key: string): CalendarDay {
  const cached = dayCache.get(key);
  if (cached) return cached;
  if (cachedSolar) {
    return computeLunarForDay(key, cachedSolar);
  }
  return getBaseCalendarDay(key);
}

const monthCache = new Map<string, (CalendarDay | null)[]>();

export function buildCalendarMonth(year: number, month: number): (CalendarDay | null)[] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 1900 || year > 2100 || month < 1 || month > 12) {
    throw new RangeError("月份须在 1900–2100 年之间");
  }
  const cacheKey = `${year}-${month}`;
  const cached = monthCache.get(cacheKey);
  if (cached) return cached;

  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => {
    const key = new Date(Date.UTC(year, month - 1, 1 - offset + index)).toISOString().slice(0, 10);
    return key < calendarMin || key > calendarMax ? null : getCalendarDay(key);
  });

  // 只有当所有有效单元格都加载完成农历数据时才永久缓存
  const allLoaded = cells.every((c) => c === null || c.loaded);
  if (allLoaded) {
    if (monthCache.size >= 12) monthCache.delete(monthCache.keys().next().value!);
    monthCache.set(cacheKey, cells);
  }
  return cells;
}

export async function fetchCalendarMonthAsync(year: number, month: number): Promise<(CalendarDay | null)[]> {
  const cacheKey = `${year}-${month}`;
  const cached = monthCache.get(cacheKey);
  if (cached && cached.every((c) => c === null || c.loaded)) {
    return cached;
  }

  const SolarClass = await loadLunarModule();
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => {
    const key = new Date(Date.UTC(year, month - 1, 1 - offset + index)).toISOString().slice(0, 10);
    return key < calendarMin || key > calendarMax ? null : computeLunarForDay(key, SolarClass);
  });

  if (monthCache.size >= 12) monthCache.delete(monthCache.keys().next().value!);
  monthCache.set(cacheKey, cells);
  return cells;
}

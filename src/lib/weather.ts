import type { VisitorGeo } from "./network";

export type WeatherIconType =
  | "sun"
  | "moon"
  | "cloud-sun"
  | "cloud-moon"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "storm";

export type CurrentWeather = {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  code: number;
  isDay: boolean;
  max: number;
  min: number;
  observedAt: string;
};

export type WeatherSource = "ip" | "city";

export type ResolvedWeather = CurrentWeather & {
  place: string;
  source: WeatherSource;
};

/**
 * 规范化城市名称，去除中文后缀以适配 Open-Meteo 地理编码
 */
export function normalizeCityQuery(name: string): string {
  const trimmed = name.trim();
  const normalized = trimmed.replace(/(?:特别行政区|自治区|市|省|区|县)$/, "");
  return normalized || trimmed;
}

/**
 * Open-Meteo 城市地理编码查询，选 population 最大者
 */
export async function geocodeCity(
  name: string,
  signal?: AbortSignal,
): Promise<{ name: string; latitude: number; longitude: number; country?: string }> {
  const query = normalizeCityQuery(name);
  if (!query) {
    throw new Error(`未找到城市“${name}”`);
  }
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=zh&format=json`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`地理编码请求失败（HTTP ${response.status}）`);
  }
  const data = (await response.json()) as {
    results?: Array<{
      name: string;
      latitude: number;
      longitude: number;
      population?: number;
      country?: string;
    }>;
  };

  if (!data.results || data.results.length === 0) {
    throw new Error(`未找到城市“${name}”`);
  }

  let best = data.results[0];
  let maxPop = typeof best.population === "number" ? best.population : 0;
  for (let i = 1; i < data.results.length; i++) {
    const item = data.results[i];
    const pop = typeof item.population === "number" ? item.population : 0;
    if (pop > maxPop) {
      maxPop = pop;
      best = item;
    }
  }

  return {
    name: best.name,
    latitude: best.latitude,
    longitude: best.longitude,
    country: best.country,
  };
}

/**
 * 查询指定坐标的当前天气及今日温差
 */
export async function fetchCurrentWeather(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<CurrentWeather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`天气请求失败（HTTP ${response.status}）`);
  }
  const data = await response.json();
  const current = data?.current;
  const daily = data?.daily;

  const temperature = current?.temperature_2m;
  const apparentTemperature = current?.apparent_temperature;
  const humidity = current?.relative_humidity_2m;
  const windSpeed = current?.wind_speed_10m;
  const code = current?.weather_code;
  const isDayVal = current?.is_day;
  const max = daily?.temperature_2m_max?.[0];
  const min = daily?.temperature_2m_min?.[0];
  const observedAt = current?.time;

  const isFiniteNum = (val: unknown): val is number =>
    typeof val === "number" && Number.isFinite(val);

  if (
    !isFiniteNum(temperature) ||
    !isFiniteNum(apparentTemperature) ||
    !isFiniteNum(humidity) ||
    !isFiniteNum(windSpeed) ||
    !isFiniteNum(code) ||
    (isDayVal !== 0 && isDayVal !== 1 && typeof isDayVal !== "boolean") ||
    !isFiniteNum(max) ||
    !isFiniteNum(min) ||
    typeof observedAt !== "string" ||
    !observedAt.trim()
  ) {
    throw new Error("天气数据字段缺失或格式异常");
  }

  return {
    temperature,
    apparentTemperature,
    humidity,
    windSpeed,
    code,
    isDay: isDayVal === 1 || isDayVal === true,
    max,
    min,
    observedAt,
  };
}

/**
 * 将 WMO 天气代码转换为中文描述与图标类别
 */
export function describeWeather(
  code: number,
  isDay?: boolean | number,
): { label: string; icon: WeatherIconType } {
  const day = isDay === true || isDay === 1;

  if (code === 0) {
    return { label: "晴", icon: day ? "sun" : "moon" };
  }
  if (code === 1) {
    return { label: "晴间多云", icon: day ? "cloud-sun" : "cloud-moon" };
  }
  if (code === 2) {
    return { label: "多云", icon: day ? "cloud-sun" : "cloud-moon" };
  }
  if (code === 3) {
    return { label: "阴", icon: "cloud" };
  }
  if (code === 45) {
    return { label: "雾", icon: "fog" };
  }
  if (code === 48) {
    return { label: "冻雾", icon: "fog" };
  }
  if (code >= 51 && code <= 57) {
    if (code === 51) return { label: "细微毛毛雨", icon: "drizzle" };
    if (code === 53) return { label: "中度毛毛雨", icon: "drizzle" };
    if (code === 55) return { label: "密实毛毛雨", icon: "drizzle" };
    if (code === 56) return { label: "冻毛雨", icon: "drizzle" };
    if (code === 57) return { label: "浓密冻毛雨", icon: "drizzle" };
    return { label: "毛毛雨", icon: "drizzle" };
  }
  if (code >= 61 && code <= 67) {
    if (code === 61) return { label: "小雨", icon: "rain" };
    if (code === 63) return { label: "中雨", icon: "rain" };
    if (code === 65) return { label: "大雨", icon: "rain" };
    if (code === 66) return { label: "轻度冻雨", icon: "rain" };
    if (code === 67) return { label: "强冻雨", icon: "rain" };
    return { label: "雨", icon: "rain" };
  }
  if (code >= 71 && code <= 77) {
    if (code === 71) return { label: "小雪", icon: "snow" };
    if (code === 73) return { label: "中雪", icon: "snow" };
    if (code === 75) return { label: "大雪", icon: "snow" };
    if (code === 77) return { label: "雪粒", icon: "snow" };
    return { label: "雪", icon: "snow" };
  }
  if (code >= 80 && code <= 82) {
    if (code === 80) return { label: "微弱阵雨", icon: "rain" };
    if (code === 81) return { label: "中度阵雨", icon: "rain" };
    if (code === 82) return { label: "暴阵雨", icon: "rain" };
    return { label: "阵雨", icon: "rain" };
  }
  if (code >= 85 && code <= 86) {
    if (code === 85) return { label: "小阵雪", icon: "snow" };
    if (code === 86) return { label: "大阵雪", icon: "snow" };
    return { label: "阵雪", icon: "snow" };
  }
  if (code >= 95 && code <= 99) {
    if (code === 95) return { label: "雷阵雨", icon: "storm" };
    if (code === 96) return { label: "雷阵雨伴轻度冰雹", icon: "storm" };
    if (code === 99) return { label: "强雷阵雨伴冰雹", icon: "storm" };
    return { label: "雷暴", icon: "storm" };
  }

  return { label: "未知天气", icon: "cloud" };
}

const CJK_PATTERN = /[\u3400-\u9fff]/;
const PLACE_MATCH_KM = 60;

/** 两点间球面距离（km） */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/**
 * IP 服务可能返回英文地名（如 Shenzhen），用地理编码换取中文名。
 * 只采用与 IP 坐标相距 60km 内的结果；查询失败或无匹配时保留原名（仅影响显示，不影响天气数据）。
 */
export async function localizePlaceName(name: string, latitude: number, longitude: number, signal?: AbortSignal): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed || CJK_PATTERN.test(trimmed)) return trimmed;
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=5&language=zh&format=json`, { signal });
    if (!response.ok) return trimmed;
    const data = (await response.json()) as { results?: Array<{ name: string; latitude: number; longitude: number }> };
    const match = (data.results ?? [])
      .map((item) => ({ item, km: distanceKm(latitude, longitude, item.latitude, item.longitude) }))
      .filter(({ km }) => Number.isFinite(km) && km <= PLACE_MATCH_KM)
      .sort((a, b) => a.km - b.km)[0];
    return match?.item.name || trimmed;
  } catch (error) {
    if (signal?.aborted) throw error;
    return trimmed;
  }
}

/**
 * 解析天气：优先按 IP 经纬度，失败回退到备用城市地理编码
 */
export async function resolveWeather({
  geo,
  fallbackCity,
  signal,
}: {
  geo?: VisitorGeo;
  fallbackCity?: string;
  signal?: AbortSignal;
}): Promise<ResolvedWeather> {
  const hasIpGeo =
    geo != null &&
    typeof geo.latitude === "number" &&
    Number.isFinite(geo.latitude) &&
    typeof geo.longitude === "number" &&
    Number.isFinite(geo.longitude);

  const city = fallbackCity?.trim();

  if (hasIpGeo) {
    try {
      const [current, place] = await Promise.all([
        fetchCurrentWeather(geo.latitude!, geo.longitude!, signal),
        localizePlaceName(geo.city || geo.region || "", geo.latitude!, geo.longitude!, signal),
      ]);
      return { place: place || "当前位置", source: "ip", ...current };
    } catch (err) {
      if (!city) {
        throw err;
      }
      // IP 坐标天气请求失败，且有 fallbackCity 时继续尝试城市
    }
  }

  if (city) {
    const geoResult = await geocodeCity(city, signal);
    const current = await fetchCurrentWeather(geoResult.latitude, geoResult.longitude, signal);
    return {
      place: geoResult.name,
      source: "city",
      ...current,
    };
  }

  throw new Error("无法确定天气位置");
}

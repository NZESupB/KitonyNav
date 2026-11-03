import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeWeather,
  fetchCurrentWeather,
  geocodeCity,
  normalizeCityQuery,
  resolveWeather,
} from "./weather";
import type { VisitorGeo } from "./network";

describe("normalizeCityQuery", () => {
  it("removes trailing administrative suffixes for Chinese cities", () => {
    expect(normalizeCityQuery("上海市")).toBe("上海");
    expect(normalizeCityQuery("杭州市")).toBe("杭州");
    expect(normalizeCityQuery("浙江省")).toBe("浙江");
    expect(normalizeCityQuery("海淀区")).toBe("海淀");
    expect(normalizeCityQuery("安吉县")).toBe("安吉");
    expect(normalizeCityQuery("内蒙古自治区")).toBe("内蒙古");
    expect(normalizeCityQuery("香港特别行政区")).toBe("香港");
  });

  it("trims whitespace and keeps non-suffix names intact", () => {
    expect(normalizeCityQuery("  北京  ")).toBe("北京");
    expect(normalizeCityQuery("Tokyo")).toBe("Tokyo");
    expect(normalizeCityQuery("New York")).toBe("New York");
  });
});

describe("describeWeather", () => {
  it("maps sunny/clear weather differently for day and night", () => {
    expect(describeWeather(0, 1)).toEqual({ label: "晴", icon: "sun" });
    expect(describeWeather(0, 0)).toEqual({ label: "晴", icon: "moon" });
    expect(describeWeather(1, true)).toEqual({ label: "晴间多云", icon: "cloud-sun" });
    expect(describeWeather(1, false)).toEqual({ label: "晴间多云", icon: "cloud-moon" });
  });

  it("maps cloudy, fog, rain, snow, and storm codes", () => {
    expect(describeWeather(3, true)).toEqual({ label: "阴", icon: "cloud" });
    expect(describeWeather(45, true)).toEqual({ label: "雾", icon: "fog" });
    expect(describeWeather(51, true)).toEqual({ label: "细微毛毛雨", icon: "drizzle" });
    expect(describeWeather(61, true)).toEqual({ label: "小雨", icon: "rain" });
    expect(describeWeather(71, true)).toEqual({ label: "小雪", icon: "snow" });
    expect(describeWeather(80, true)).toEqual({ label: "微弱阵雨", icon: "rain" });
    expect(describeWeather(85, true)).toEqual({ label: "小阵雪", icon: "snow" });
    expect(describeWeather(95, true)).toEqual({ label: "雷阵雨", icon: "storm" });
  });

  it("handles unknown codes gracefully", () => {
    expect(describeWeather(999, true)).toEqual({ label: "未知天气", icon: "cloud" });
  });
});

describe("geocodeCity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects the location with the largest population", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { name: "Small City", latitude: 10, longitude: 20, population: 5000 },
          { name: "Big City", latitude: 31.2, longitude: 121.4, population: 24000000, country: "China" },
          { name: "Medium City", latitude: 30, longitude: 120, population: 800000 },
        ],
      }),
    } as Response);

    const result = await geocodeCity("上海市");
    expect(result.name).toBe("Big City");
    expect(result.latitude).toBe(31.2);
    expect(result.longitude).toBe(121.4);
    expect(result.country).toBe("China");
  });

  it("throws error when no results are found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    } as Response);

    await expect(geocodeCity("不存在的火星城市")).rejects.toThrow("未找到城市“不存在的火星城市”");
  });

  it("throws error when response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    await expect(geocodeCity("上海")).rejects.toThrow("地理编码请求失败（HTTP 500）");
  });
});

describe("fetchCurrentWeather", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses valid weather payload correctly", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          time: "2026-10-31T12:00",
          temperature_2m: 21.4,
          apparent_temperature: 20.8,
          relative_humidity_2m: 65,
          weather_code: 1,
          is_day: 1,
          wind_speed_10m: 12.5,
        },
        daily: {
          temperature_2m_max: [23.1],
          temperature_2m_min: [15.2],
        },
      }),
    } as Response);

    const weather = await fetchCurrentWeather(31.2, 121.4);
    expect(weather.temperature).toBe(21.4);
    expect(weather.apparentTemperature).toBe(20.8);
    expect(weather.humidity).toBe(65);
    expect(weather.windSpeed).toBe(12.5);
    expect(weather.code).toBe(1);
    expect(weather.isDay).toBe(true);
    expect(weather.max).toBe(23.1);
    expect(weather.min).toBe(15.2);
    expect(weather.observedAt).toBe("2026-10-31T12:00");
  });

  it("throws error when required fields are missing or non-numeric", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          time: "2026-10-31T12:00",
          temperature_2m: null, // missing temperature
          apparent_temperature: 20.8,
          relative_humidity_2m: 65,
          weather_code: 1,
          is_day: 1,
          wind_speed_10m: 12.5,
        },
        daily: {
          temperature_2m_max: [23.1],
          temperature_2m_min: [15.2],
        },
      }),
    } as Response);

    await expect(fetchCurrentWeather(31.2, 121.4)).rejects.toThrow("天气数据字段缺失或格式异常");
  });
});

describe("resolveWeather", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockWeatherResponse = {
    current: {
      time: "2026-10-31T12:00",
      temperature_2m: 22,
      apparent_temperature: 21,
      relative_humidity_2m: 60,
      weather_code: 0,
      is_day: 1,
      wind_speed_10m: 10,
    },
    daily: {
      temperature_2m_max: [24],
      temperature_2m_min: [18],
    },
  };

  it("resolves via IP coordinates successfully", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeatherResponse,
    } as Response);

    const geo: VisitorGeo = {
      latitude: 31.2,
      longitude: 121.4,
      city: "上海",
      country: "中国",
    };

    const result = await resolveWeather({ geo, fallbackCity: "北京" });
    expect(result.source).toBe("ip");
    expect(result.place).toBe("上海");
    expect(result.temperature).toBe(22);
  });

  it("falls back to fallbackCity when IP weather request fails", async () => {
    // First call for IP weather fails
    // Second call for geocodeCity succeeds
    // Third call for fallbackCity weather succeeds
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ name: "杭州", latitude: 30.27, longitude: 120.15, population: 10000000 }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherResponse,
      } as Response);

    const geo: VisitorGeo = {
      latitude: 31.2,
      longitude: 121.4,
      city: "上海",
    };

    const result = await resolveWeather({ geo, fallbackCity: "杭州市" });
    expect(result.source).toBe("city");
    expect(result.place).toBe("杭州");
    expect(result.temperature).toBe(22);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("throws error when neither IP geo nor fallbackCity are available", async () => {
    await expect(resolveWeather({ geo: {}, fallbackCity: "" })).rejects.toThrow("无法确定天气位置");
  });

  it("localizes English IP place names using the nearest geocoding match", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("geocoding-api")) {
        return { ok: true, json: async () => ({ results: [
          { name: "深镇", latitude: 22.18, longitude: 111.12 },
          { name: "深圳", latitude: 22.55, longitude: 114.07 },
        ] }) } as Response;
      }
      return { ok: true, json: async () => mockWeatherResponse } as Response;
    });
    const result = await resolveWeather({ geo: { latitude: 22.54, longitude: 114.06, city: "Shenzhen" } });
    expect(result.place).toBe("深圳");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("keeps the original place name when no nearby localized match exists", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("geocoding-api")) {
        return { ok: true, json: async () => ({ results: [{ name: "远处", latitude: 40, longitude: 100 }] }) } as Response;
      }
      return { ok: true, json: async () => mockWeatherResponse } as Response;
    });
    const result = await resolveWeather({ geo: { latitude: 22.54, longitude: 114.06, city: "Shenzhen" } });
    expect(result.place).toBe("Shenzhen");
  });
});

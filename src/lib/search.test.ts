import { describe, expect, it } from "vitest";
import { buildSearchUrl, resolveEngine, searchEngines } from "./search";

describe("search engines", () => {
  it("does not include 搜狗 or 360 搜索", () => {
    const names = searchEngines.map((e) => e.name);
    expect(names).not.toContain("搜狗");
    expect(names).not.toContain("360 搜索");
  });

  it("includes 哔哩哔哩 in 站内搜索", () => {
    const bilibili = searchEngines.find((e) => e.name === "哔哩哔哩");
    expect(bilibili).toBeDefined();
    expect(bilibili?.group).toBe("站内搜索");
    expect(bilibili?.url).toBe("https://search.bilibili.com/all");
    expect(bilibili?.param).toBe("keyword");
  });

  it("builds correct search url for 哔哩哔哩", () => {
    const url = buildSearchUrl("哔哩哔哩", "动画");
    expect(url).toBe("https://search.bilibili.com/all?keyword=%E5%8A%A8%E7%94%BB");
  });

  it("safely falls back to Google when legacy or unknown engine is requested", () => {
    expect(resolveEngine("搜狗")).toBe("Google");
    expect(resolveEngine("360 搜索")).toBe("Google");
    expect(resolveEngine("unknown")).toBe("Google");
  });
});

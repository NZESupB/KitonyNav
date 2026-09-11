import { describe, expect, it } from "vitest";
import { engineUrls, fallbackBootstrap } from "./data";

describe("navigation bootstrap data", () => {
  it("keeps bang search engines mapped to valid destinations", () => {
    expect(engineUrls.Google).toContain("QUERY");
    expect(engineUrls.百度).toContain("QUERY");
    expect(engineUrls.YouTube).toContain("QUERY");
    expect(engineUrls.Steam).toContain("QUERY");
  });

  it("ships the first-viewport categories in a stable order", () => {
    expect(fallbackBootstrap.categories.slice(0, 3).map((category) => category.name)).toEqual(["常用", "开发", "工具"]);
    expect(fallbackBootstrap.categories.every((category) => category.links.length > 0)).toBe(true);
  });

  it("defaults device-aware appearance and connectivity settings", () => {
    expect(fallbackBootstrap.settings.appearance?.theme).toBe("system");
    expect(fallbackBootstrap.settings.appearance?.clockStyle).toBe("plain");
    expect(fallbackBootstrap.categories[0].links.every((item) => item.connectivityEnabled)).toBe(true);
  });
});

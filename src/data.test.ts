import { describe, expect, it } from "vitest";
import { engineUrls, fallbackBootstrap, normalizeBootstrap, resolveEngine, type BootstrapData } from "./data";

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

  it("normalizes null lists from the API into empty arrays", () => {
    const payload = { ...fallbackBootstrap, categories: null, services: null, updates: null, subscriptions: null } as unknown as BootstrapData;
    const normalized = normalizeBootstrap(payload);
    expect(normalized.categories).toEqual([]);
    expect(normalized.services).toEqual([]);
    expect(normalized.updates).toEqual([]);
    expect(normalized.subscriptions).toEqual([]);
  });

  it("normalizes a category without links into an empty link list", () => {
    const payload = { ...fallbackBootstrap, categories: [{ id: 1, name: "常用", description: "", icon: "star" }] } as unknown as BootstrapData;
    expect(normalizeBootstrap(payload).categories[0].links).toEqual([]);
  });

  it("falls back to the default engine when the configured one is unknown", () => {
    expect(resolveEngine("百度")).toBe("百度");
    expect(resolveEngine("Bing")).toBe("Google");
    expect(resolveEngine(undefined)).toBe("Google");
  });
});

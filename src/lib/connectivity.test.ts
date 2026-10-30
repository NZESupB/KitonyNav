import { describe, expect, it } from "vitest";
import { formatConnectivity, type ConnectivityResult } from "./connectivity";

describe("formatConnectivity", () => {
  it("formats reachable latency without Web prefix", () => {
    const res: ConnectivityResult = {
      state: "reachable",
      source: "browser",
      latencyMs: 97,
    };
    const formatted = formatConnectivity(res);
    expect(formatted.text).toBe("97 ms");
    expect(formatted.level).toBe("fast");
    expect(formatted.state).toBe("reachable");
    expect(formatted.title).toContain("浏览器实测访问延迟");
  });

  it("assigns appropriate level based on latency", () => {
    expect(formatConnectivity({ state: "reachable", source: "browser", latencyMs: 150 }).level).toBe("fast");
    expect(formatConnectivity({ state: "reachable", source: "browser", latencyMs: 250 }).level).toBe("moderate");
    expect(formatConnectivity({ state: "reachable", source: "browser", latencyMs: 500 }).level).toBe("slow");
  });

  it("formats unreachable state cleanly", () => {
    const res: ConnectivityResult = {
      state: "unreachable",
      source: "browser",
      reason: "连接失败",
    };
    const formatted = formatConnectivity(res);
    expect(formatted.text).toBe("连接失败");
    expect(formatted.state).toBe("unreachable");
  });

  it("handles stale cached latency", () => {
    const now = Date.now();
    const res: ConnectivityResult = {
      state: "reachable",
      source: "browser",
      latencyMs: 65,
      expiresAt: now - 1000,
    };
    const formatted = formatConnectivity(res);
    expect(formatted.text).toBe("上次 65 ms");
    expect(formatted.state).toBe("stale");
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { browserPing } from "./browser-ping";
import { formatConnectivity, type ConnectivityResult } from "./connectivity";

describe("pure frontend browser ping", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calculates latency on successful fetch", async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      new Promise((resolve) => {
        setTimeout(() => resolve(new Response(null, { status: 200 })), 20);
      })
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await browserPing("https://example.com/test", 2000);
    expect(result.reachable).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(1);
    expect(result.protocol).toBe("fetch");
  });

  it("handles fetch failure gracefully by falling back to Image", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", mockFetch);

    let srcCleared = false;
    const mockImage = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = "";
      get src() {
        return this._src;
      }
      set src(val: string) {
        this._src = val;
        if (val === "") {
          srcCleared = true;
          return;
        }
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 15);
      }
    };
    vi.stubGlobal("Image", mockImage);

    const result = await browserPing("https://example.com/api", 2000);
    expect(result.reachable).toBe(true);
    expect(result.protocol).toBe("image");
    expect(result.latencyMs).toBeGreaterThanOrEqual(1);
    expect(srcCleared).toBe(true);
  });

  it("detects mixed content when page is https and target is http", async () => {
    // Mock window.location
    vi.stubGlobal("window", {
      location: { protocol: "https:" },
    });
    const result = await browserPing("http://insecure.example.com/test", 1000);
    expect(result.reachable).toBe(false);
    expect(result.error).toContain("HTTPS 页面无法探测 HTTP 目标");
  });

  it("handles AbortSignal abort immediately", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const result = await browserPing("https://example.com/test", 2000, ctrl.signal);
    expect(result.reachable).toBe(false);
    expect(result.error).toContain("已取消");
  });

  it("formats browser connectivity badge with Web prefix and relaxed thresholds", () => {
    const res: ConnectivityResult = {
      state: "reachable",
      latencyMs: 120,
      source: "browser",
    };
    const formatted = formatConnectivity(res);
    expect(formatted.text).toBe("Web 120 ms");
    expect(formatted.level).toBe("fast");
    expect(formatted.title).toContain("纯前端浏览器实测访问延迟（免安装探针）");

    const moderateRes: ConnectivityResult = {
      state: "reachable",
      latencyMs: 350,
      source: "browser",
    };
    const modFormatted = formatConnectivity(moderateRes);
    expect(modFormatted.level).toBe("moderate");

    const slowRes: ConnectivityResult = {
      state: "reachable",
      latencyMs: 650,
      source: "browser",
    };
    const slowFormatted = formatConnectivity(slowRes);
    expect(slowFormatted.level).toBe("slow");
  });
});

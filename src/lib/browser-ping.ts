export type BrowserPingResult = {
  reachable: boolean;
  latencyMs?: number;
  protocol: "fetch" | "image";
  error?: string;
};

export async function browserPing(
  targetUrl: string,
  timeoutMs = 3500,
  signal?: AbortSignal,
): Promise<BrowserPingResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return { reachable: false, error: "无效的 URL 目标", protocol: "fetch" };
  }

  // Mixed Content 检查：HTTPS 页面探测 HTTP 目标
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    parsedUrl.protocol === "http:"
  ) {
    return {
      reachable: false,
      error: "浏览器安全限制：HTTPS 页面无法探测 HTTP 目标",
      protocol: "fetch",
    };
  }

  const start = performance.now();
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      return { reachable: false, error: "探测已取消", protocol: "fetch" };
    }
    signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 优先尝试 Fetch no-cors
    await fetch(targetUrl, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onExternalAbort);
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    return { reachable: true, latencyMs, protocol: "fetch" };
  } catch {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onExternalAbort);
    if (signal?.aborted || controller.signal.aborted) {
      return { reachable: false, error: "探测超时", protocol: "fetch" };
    }

    // 回退尝试：Ping-via-Image (请求 Favicon 或目标源)
    if (typeof Image === "undefined") {
      return { reachable: false, error: "网络请求失败", protocol: "fetch" };
    }

    return new Promise((resolve) => {
      const img = new Image();
      let settled = false;
      const imgTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        img.src = "";
        resolve({ reachable: false, error: "回退图片探测超时", protocol: "image" });
      }, timeoutMs);

      const finish = (reachable: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(imgTimer);
        const latencyMs = Math.max(1, Math.round(performance.now() - start));
        resolve({
          reachable,
          latencyMs: reachable ? latencyMs : undefined,
          protocol: "image",
        });
      };

      // 无论成功加载还是 404/403 触发 onerror，均证明与服务器建立了网络连接并收到 HTTP 响应
      img.onload = () => finish(true);
      img.onerror = () => finish(true);

      const abortHandler = () => {
        if (!settled) {
          settled = true;
          clearTimeout(imgTimer);
          img.src = "";
          resolve({ reachable: false, error: "探测已取消", protocol: "image" });
        }
      };

      if (signal) {
        signal.addEventListener("abort", abortHandler, { once: true });
      }

      const separator = parsedUrl.origin.endsWith("/") ? "" : "/";
      img.src = `${parsedUrl.origin}${separator}favicon.ico?_t=${Date.now()}`;
    });
  }
}

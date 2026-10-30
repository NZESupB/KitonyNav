export type ConnectivitySource = "browser";
export type ConnectivityReason = "browser-restricted" | "timeout" | "network-error";

export type ConnectivityResult = {
  state: "reachable" | "unreachable" | "unknown" | "checking";
  latencyMs?: number;
  source: ConnectivitySource;
  reason?: string;
  reasonCode?: ConnectivityReason;
  checkedAt?: number;
  expiresAt?: number;
  refreshing?: boolean;
  stale?: boolean;
};

export const connectivityLifetime = 60_000;

export function validLatency(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function expireConnectivity(result: ConnectivityResult, now = Date.now()): ConnectivityResult {
  return result.expiresAt != null && result.expiresAt <= now
    ? { ...result, state: "unknown", stale: validLatency(result.latencyMs), reason: result.reason || "检测结果已过期" }
    : result;
}

export function completeConnectivity(previous: ConnectivityResult | undefined, next: ConnectivityResult, now = Date.now()): ConnectivityResult {
  if (next.state === "unknown" && next.latencyMs == null && validLatency(previous?.latencyMs)) {
    return { ...previous, ...next, latencyMs: previous.latencyMs, refreshing: false, stale: true };
  }
  return { ...next, checkedAt: now, expiresAt: now + connectivityLifetime, refreshing: false, stale: false };
}

export function formatConnectivity(result?: ConnectivityResult) {
  const current = result ? expireConnectivity(result) : undefined;
  const stale = current?.stale && validLatency(current.latencyMs);
  const state = stale ? "stale" : current?.state ?? "unknown";
  const latency = validLatency(current?.latencyMs) && (state === "reachable" || state === "stale") ? current.latencyMs : undefined;

  const level = state === "reachable" && latency != null
    ? latency <= 180 ? "fast" : latency <= 400 ? "moderate" : "slow"
    : undefined;

  const value = latency != null ? `${latency} ms` : undefined;
  const unknownText = current?.reasonCode === "browser-restricted" ? "浏览器受限" : "未确认";
  const text = value ? `${stale ? "上次 " : ""}${value}` : state === "checking" ? "检测中" : state === "unreachable" ? "连接失败" : unknownText;
  const status = stale ? "上次结果，已过期" : state === "reachable" ? "访问可达" : text;
  const sourceLabel = "浏览器实测访问延迟";
  const title = [sourceLabel, status, value, current?.reason, current?.refreshing ? "正在刷新" : "",
    current?.checkedAt != null ? `测量于 ${new Date(current.checkedAt).toLocaleTimeString("zh-CN")}` : ""].filter(Boolean).join("；");
  return { state, level, text, title };
}

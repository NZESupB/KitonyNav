import { withRequestTimeout } from "./network";

export type ConnectivityResult = {
  state: "reachable" | "unreachable" | "unknown" | "checking";
  latencyMs?: number;
  source: "probe";
  reason?: string;
  checkedAt?: number;
  expiresAt?: number;
  refreshing?: boolean;
  stale?: boolean;
};
export type CheckTarget = { id: string; key: string; url: string };
export const connectivityLifetime = 60_000;

export function validLatency(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export async function checkConnectivity(url: string, signal: AbortSignal): Promise<ConnectivityResult> {
  const source = "probe";
  return withRequestTimeout(signal, async (requestSignal) => {
    const response = await fetch(url, {
      mode: "cors", credentials: "omit",
      referrerPolicy: "no-referrer", cache: "no-store", signal: requestSignal,
    });
    const value = await response.json() as { ok?: boolean; latencyMs?: unknown; error?: string };
    if (!response.ok) return { state: "unknown", source, reason: value.error || `探针请求失败（HTTP ${response.status}）` };
    if (typeof value.ok !== "boolean") throw new Error("本机探针返回格式不正确");
    if (!value.ok) return { state: "unreachable", source, reason: value.error || "TCP 连接失败" };
    if (!validLatency(value.latencyMs)) throw new Error("探针成功响应缺少有效延迟");
    return { state: "reachable", source, latencyMs: value.latencyMs };
  });
}

export function expireConnectivity(result: ConnectivityResult, now = Date.now()): ConnectivityResult {
  return result.expiresAt != null && result.expiresAt <= now
    ? { ...result, state: "unknown", stale: true, reason: result.reason || "检测结果已过期" }
    : result;
}

export function completeConnectivity(previous: ConnectivityResult | undefined, next: ConnectivityResult, now = Date.now()): ConnectivityResult {
  if (next.state === "unknown" && next.latencyMs == null && previous?.latencyMs != null) {
    return { ...previous, ...next, latencyMs: previous.latencyMs, refreshing: false, stale: true };
  }
  return { ...next, checkedAt: now, expiresAt: now + connectivityLifetime, refreshing: false, stale: false };
}

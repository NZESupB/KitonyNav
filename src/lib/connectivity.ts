import { withRequestTimeout } from "./network";
import type { ProbeErrorCode } from "./probe";

export type ConnectivityReason = ProbeErrorCode | "not-allowed" | "invalid-target" | "tcp-failed" | "tcp-timeout";
export type ConnectivityResult = {
  state: "reachable" | "unreachable" | "unknown" | "checking";
  latencyMs?: number;
  source: "probe";
  reason?: string;
  reasonCode?: ConnectivityReason;
  checkedAt?: number;
  expiresAt?: number;
  refreshing?: boolean;
  stale?: boolean;
};
export const connectivityLifetime = 60_000;
// 留出探针 5 秒拨号超时后传回失败结果的时间。
export const probeRequestTimeout = 6500;

export function validLatency(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export async function checkConnectivity(url: string, signal: AbortSignal): Promise<ConnectivityResult> {
  const unknown = (reasonCode: ConnectivityReason, reason: string): ConnectivityResult => ({ state: "unknown", source: "probe", reasonCode, reason });
  try {
    return await withRequestTimeout(signal, async (requestSignal) => {
      const response = await fetch(url, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", signal: requestSignal });
      let value: Record<string, unknown>;
      try {
        const body: unknown = await response.json();
        if (!body || typeof body !== "object" || Array.isArray(body)) return unknown("invalid-response", "本机探针返回格式不正确");
        value = body as Record<string, unknown>;
      } catch (error) {
        if (requestSignal.aborted) throw error;
        return unknown(response.status === 403 ? "not-allowed" : "invalid-response", response.status === 403 ? "目标不在探针 allowlist 中" : "本机探针返回的内容不是有效 JSON");
      }
      const reason = typeof value.error === "string" ? value.error : "";
      if (response.status === 403) return unknown("not-allowed", reason || "目标不在探针 allowlist 中");
      if (!response.ok) return unknown(response.status === 400 ? "invalid-target" : "probe-unavailable", reason || `探针请求失败（HTTP ${response.status}）`);
      if (typeof value.ok !== "boolean") return unknown("invalid-response", "本机探针返回格式不正确");
      if (!value.ok) return { state: "unreachable", source: "probe", reasonCode: value.errorCode === "tcp-timeout" ? "tcp-timeout" : "tcp-failed", reason: reason || "TCP 连接失败" };
      if (!validLatency(value.latencyMs)) return unknown("invalid-response", "探针成功响应缺少有效延迟");
      return { state: "reachable", source: "probe", latencyMs: value.latencyMs };
    }, probeRequestTimeout);
  } catch (error) {
    if (signal.aborted) throw error;
    return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
      ? unknown("request-timeout", "本机探针请求超时，未取得 TCP 检测结果")
      : unknown("probe-unavailable", "本机探针未启动、不可访问或被浏览器权限限制");
  }
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
  const level = state === "reachable" && latency != null ? latency <= 100 ? "fast" : latency <= 300 ? "moderate" : "slow" : undefined;
  const value = latency != null ? `${latency} ms` : undefined;
  const unknownText = current?.reasonCode === "not-allowed" ? "未获探针允许" : current?.reasonCode === "invalid-response" ? "探针响应异常"
    : current?.reasonCode === "invalid-config" ? "探针地址错误" : current?.reasonCode === "probe-http" ? "探针请求失败"
    : current?.reasonCode === "request-timeout" ? "探针请求超时" : current?.reasonCode === "probe-unavailable" ? "探针未连接" : "未确认";
  const text = value ? `${stale ? "上次 " : ""}${value}` : state === "checking" ? "检测中" : state === "unreachable" ? "连接失败" : unknownText;
  const status = stale ? "上次结果，已过期或本次检测无法确认" : state === "reachable" ? "TCP 连接成功" : text;
  const title = ["本机 TCP 拨号（含 DNS）", status, value, current?.reason, current?.refreshing ? "正在刷新" : "",
    current?.checkedAt != null ? `测量于 ${new Date(current.checkedAt).toLocaleTimeString("zh-CN")}` : ""].filter(Boolean).join("；");
  return { state, level, text, title };
}

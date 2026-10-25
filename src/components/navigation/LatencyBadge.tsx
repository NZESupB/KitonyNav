import { validLatency, type ConnectivityResult } from "../../lib/connectivity";

export function LatencyBadge({ result }: { result?: ConnectivityResult }) {
  const state = result?.stale ? "stale" : result?.state ?? "unknown";
  const latencyMs = validLatency(result?.latencyMs) && (state === "reachable" || state === "stale") ? result.latencyMs : undefined;
  const value = latencyMs != null ? `${latencyMs} ms` : undefined;
  const level = state === "reachable" && latencyMs != null ? latencyMs <= 100 ? "fast" : latencyMs <= 300 ? "moderate" : "slow" : undefined;
  const quality = level === "fast" ? "低延迟（≤100 ms）" : level === "moderate" ? "中等延迟（>100–300 ms）" : level === "slow" ? "高延迟（>300 ms）" : undefined;
  const status = state === "stale" ? "上次结果，已过期或本次检测失败" : state === "reachable" ? "TCP 连接成功"
    : state === "unreachable" ? "TCP 连接失败" : state === "checking" ? "检测中" : "无法确认状态，需要可用的本机探针";
  const label = ["本机 TCP 拨号（含 DNS）", status, value, quality,
    result?.reason, result?.refreshing ? "正在刷新" : "",
    result?.checkedAt ? `测量于 ${new Date(result.checkedAt).toLocaleTimeString("zh-CN")}` : ""].filter(Boolean).join("；");
  return <span className={`link-metric ${state}${level ? ` latency-${level}` : ""}`} title={label} aria-label={label}>
    <span className="connectivity-dot" aria-hidden="true" />{value ? `${state === "stale" ? "上次 " : ""}${value}`
      : state === "checking" ? "检测中" : state === "unreachable" ? "连接失败" : "未确认"}
  </span>;
}

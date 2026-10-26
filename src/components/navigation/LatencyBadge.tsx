import { formatConnectivity, type ConnectivityResult } from "../../lib/connectivity";

export function LatencyBadge({ result }: { result?: ConnectivityResult }) {
  const { state, level, text, title } = formatConnectivity(result);
  return <span className={`link-metric ${state}${level ? ` latency-${level}` : ""}`} title={title} aria-label={title}>
    <span className="connectivity-dot" aria-hidden="true" />{text}
  </span>;
}

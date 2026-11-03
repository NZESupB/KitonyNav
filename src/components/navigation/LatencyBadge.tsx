import { memo, useMemo } from "react";
import { formatConnectivity } from "../../lib/connectivity";
import { CHECKING_RESULT, useConnectivity } from "../../stores/connectivity-store";

export const LatencyBadge = memo(function LatencyBadge({ connectivityKey }: { connectivityKey: string }) {
  const result = useConnectivity(connectivityKey) ?? CHECKING_RESULT;
  const display = useMemo(() => formatConnectivity(result), [result]);
  const { state, level, text, title } = display;

  return (
    <span
      className={`link-metric ${state}${level ? ` latency-${level}` : ""}`}
      title={title}
      aria-label={title}
    >
      <span className="connectivity-dot" aria-hidden="true" />
      <span className="latency-val">{text}</span>
    </span>
  );
});

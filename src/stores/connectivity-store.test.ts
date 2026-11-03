import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  useConnectivityStore,
  queueConnectivity,
  flushConnectivity,
  pruneConnectivity,
  CHECKING_RESULT,
} from "./connectivity-store";

describe("connectivity-store", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    flushConnectivity();
    useConnectivityStore.setState({ results: {} });
  });

  it("notifies subscriber only once after multiple queued updates", () => {
    vi.useFakeTimers();
    let notificationCount = 0;
    const unsubscribe = useConnectivityStore.subscribe(() => {
      notificationCount++;
    });

    queueConnectivity("link:1", () => ({ state: "reachable", latencyMs: 20, source: "browser" }));
    queueConnectivity("link:2", () => ({ state: "reachable", latencyMs: 50, source: "browser" }));
    queueConnectivity("link:3", () => ({ state: "unreachable", source: "browser" }));

    expect(notificationCount).toBe(0);

    vi.advanceTimersByTime(100);

    expect(notificationCount).toBe(1);
    expect(useConnectivityStore.getState().results["link:1"]?.latencyMs).toBe(20);
    expect(useConnectivityStore.getState().results["link:2"]?.latencyMs).toBe(50);
    expect(useConnectivityStore.getState().results["link:3"]?.state).toBe("unreachable");

    unsubscribe();
    vi.useRealTimers();
  });

  it("composes multiple updaters for the same key in order", () => {
    queueConnectivity("link:1", () => ({ state: "checking", source: "browser", refreshing: true }));
    queueConnectivity("link:1", (prev) => ({
      state: "reachable",
      source: "browser",
      latencyMs: 30,
      stale: prev?.refreshing,
    }));
    queueConnectivity("link:1", (prev) => ({
      ...(prev ?? CHECKING_RESULT),
      latencyMs: (prev?.latencyMs ?? 0) + 10,
    }));

    flushConnectivity();

    const result = useConnectivityStore.getState().results["link:1"];
    expect(result).toBeDefined();
    expect(result?.state).toBe("reachable");
    expect(result?.latencyMs).toBe(40);
    expect(result?.stale).toBe(true);
  });

  it("prunes extra keys and does not notify when no changes occur", () => {
    useConnectivityStore.setState({
      results: {
        "link:1": { state: "reachable", latencyMs: 20, source: "browser" },
        "link:2": { state: "reachable", latencyMs: 30, source: "browser" },
        "link:3": { state: "reachable", latencyMs: 40, source: "browser" },
      },
    });

    let notificationCount = 0;
    const unsubscribe = useConnectivityStore.subscribe(() => {
      notificationCount++;
    });

    // prune keys not in keep set
    pruneConnectivity(new Set(["link:1", "link:2"]));
    expect(notificationCount).toBe(1);
    expect(useConnectivityStore.getState().results["link:3"]).toBeUndefined();
    expect(useConnectivityStore.getState().results["link:1"]).toBeDefined();
    expect(useConnectivityStore.getState().results["link:2"]).toBeDefined();

    // prune with same keep set - no changes, should not notify
    pruneConnectivity(new Set(["link:1", "link:2"]));
    expect(notificationCount).toBe(1);

    unsubscribe();
  });
});

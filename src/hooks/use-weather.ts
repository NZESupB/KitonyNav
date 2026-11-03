import { useQuery } from "@tanstack/react-query";
import { resolveWeather, type ResolvedWeather } from "../lib/weather";
import { useVisitorGeo } from "./use-visitor-geo";

export function useWeather(fallbackCity?: string) {
  const geoQuery = useVisitorGeo();
  const geo = geoQuery.data;

  const lat =
    typeof geo?.latitude === "number" && Number.isFinite(geo.latitude)
      ? Number(geo.latitude.toFixed(2))
      : null;
  const lon =
    typeof geo?.longitude === "number" && Number.isFinite(geo.longitude)
      ? Number(geo.longitude.toFixed(2))
      : null;
  const coordKey = lat != null && lon != null ? `${lat},${lon}` : null;

  return useQuery<ResolvedWeather>({
    queryKey: ["weather", coordKey, fallbackCity?.trim() || ""],
    queryFn: ({ signal }) =>
      resolveWeather({
        geo,
        fallbackCity,
        signal,
      }),
    enabled: !geoQuery.isLoading,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}

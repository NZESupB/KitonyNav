import { useQuery } from "@tanstack/react-query";
import { fetchVisitorGeo, type VisitorGeo } from "../lib/network";

export function useVisitorGeo() {
  return useQuery<VisitorGeo>({
    queryKey: ["visitor-geo"],
    queryFn: ({ signal }) => fetchVisitorGeo(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}

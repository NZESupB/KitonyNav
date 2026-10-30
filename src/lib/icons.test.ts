import { describe, expect, it } from "vitest";
import { getWebsiteIconCandidates, sanitizeWebsiteUrl } from "./icons";

describe("icons utils", () => {
  it("sanitizes valid and invalid urls", () => {
    expect(sanitizeWebsiteUrl("https://example.com/foo")).not.toBeNull();
    expect(sanitizeWebsiteUrl("ftp://example.com")).toBeNull();
    expect(sanitizeWebsiteUrl("not-a-url")).toBeNull();
  });

  it("generates multi-tier icon candidates for public https website", () => {
    const candidates = getWebsiteIconCandidates("https://github.com/trending", "https:");
    expect(candidates).toContain("https://github.com/favicon.ico");
    expect(candidates).toContain("https://github.com/apple-touch-icon.png");
    expect(candidates).toContain("https://icons.duckduckgo.com/ip3/github.com.ico");
    expect(candidates).toContain("https://www.google.com/s2/favicons?domain=github.com&sz=64");
  });

  it("safely generates https proxy candidates for http website on https page without mixed content", () => {
    const candidates = getWebsiteIconCandidates("http://example.org/test", "https:");
    // Should NOT contain plain http candidate on https page
    expect(candidates.some((c) => c.startsWith("http://"))).toBe(false);
    // Should contain secure https resolvers
    expect(candidates).toContain("https://icons.duckduckgo.com/ip3/example.org.ico");
    expect(candidates).toContain("https://www.google.com/s2/favicons?domain=example.org&sz=64");
  });

  it("does not send local or private addresses to public icon resolvers", () => {
    const candidates = getWebsiteIconCandidates("https://192.168.1.100:8443", "https:");
    expect(candidates).toEqual([
      "https://192.168.1.100:8443/favicon.ico",
      "https://192.168.1.100:8443/apple-touch-icon.png",
    ]);
  });
});

import { fallbackBootstrap, type BootstrapData, type Category, type LinkItem, type ServiceStatus, type Subscription } from "./data";

export type SessionState = { authenticated: boolean; csrfToken?: string };

let csrfTokenMemory = "";

function storedCsrfToken() {
  if (csrfTokenMemory) return csrfTokenMemory;
  return typeof sessionStorage === "undefined" ? "" : sessionStorage.getItem("kitonynav-csrf") || "";
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const csrfToken = storedCsrfToken() || (typeof document === "undefined"
    ? ""
    : document.cookie.split("; ").find((part) => part.startsWith("kitonynav_csrf="))?.split("=")[1] || "");
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (method !== "GET" && method !== "HEAD" && csrfToken) headers.set("X-CSRF-Token", decodeURIComponent(csrfToken));
  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    throw new Error((await response.text()) || response.statusText);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export async function fetchBootstrap(): Promise<BootstrapData> {
  try {
    return await request<BootstrapData>("/api/v1/bootstrap");
  } catch {
    return fallbackBootstrap;
  }
}

export async function fetchSession(): Promise<SessionState> {
  try {
    return await request<SessionState>("/api/v1/auth/session");
  } catch {
    return { authenticated: false };
  }
}

export async function login(password: string) {
  const result = await request<SessionState>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ password }) });
  if (result.csrfToken) {
    csrfTokenMemory = result.csrfToken;
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem("kitonynav-csrf", result.csrfToken);
  }
  return result;
}

export async function logout() {
  const result = await request<void>("/api/v1/auth/logout", { method: "POST" });
  csrfTokenMemory = "";
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("kitonynav-csrf");
  return result;
}

export type CategoryPayload = { name: string; description: string; icon: string; iconKind?: "builtin" | "url"; iconUrl?: string };

export async function createCategory(payload: CategoryPayload) {
  return request<Category>("/api/v1/admin/categories", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateCategory(id: number, payload: CategoryPayload) {
  return request<Category>(`/api/v1/admin/categories/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteCategory(id: number) {
  return request<void>(`/api/v1/admin/categories/${id}`, { method: "DELETE" });
}

export async function createLink(payload: Omit<LinkItem, "id">) {
  return request<LinkItem>("/api/v1/admin/links", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateLink(id: number, payload: Omit<LinkItem, "id">) {
  return request<LinkItem>(`/api/v1/admin/links/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteLink(id: number) {
  return request<void>(`/api/v1/admin/links/${id}`, { method: "DELETE" });
}

export async function updateSettings(payload: {
  brandName: string;
  brandDescription: string;
  defaultEngine: string;
  weatherLocation: string;
  timezone: string;
  theme: "system" | "light" | "dark";
  clockStyle: "plain" | "flip" | "ticker" | "glow";
  clock24Hour: boolean;
  clockSeconds: boolean;
  clockColor: string;
  clockSpeed: number;
}) {
  return request<BootstrapData>("/api/v1/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
}

export type ServicePayload = { name: string; enabled: boolean; checkType: "none" | "http" | "tcp"; target: string; port: number };
export type SubscriptionPayload = { type: "rss" | "github" | "youtube"; name: string; url: string; enabled: boolean; intervalSeconds: number };

export async function createService(payload: ServicePayload) {
  return request<ServiceStatus>("/api/v1/admin/services", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateService(id: number, payload: ServicePayload) {
  return request<ServiceStatus>(`/api/v1/admin/services/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteService(id: number) {
  return request<void>(`/api/v1/admin/services/${id}`, { method: "DELETE" });
}

export async function refreshService(id: number) {
  return request<ServiceStatus>(`/api/v1/admin/services/${id}/refresh`, { method: "POST" });
}

export async function createSubscription(payload: SubscriptionPayload) {
  return request<Subscription>("/api/v1/admin/subscriptions", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateSubscription(id: number, payload: SubscriptionPayload) {
  return request<Subscription>(`/api/v1/admin/subscriptions/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteSubscription(id: number) {
  return request<void>(`/api/v1/admin/subscriptions/${id}`, { method: "DELETE" });
}

export async function refreshSubscription(id: number) {
  return request<Subscription>(`/api/v1/admin/subscriptions/${id}/refresh`, { method: "POST" });
}

export async function fetchClientNetwork() {
  return request<{ address?: string; family?: string; source?: string; status: string }>("/api/v1/network/client");
}

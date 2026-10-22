import { type BootstrapData, type Category, type LinkItem, type ServiceStatus, type Subscription } from "./data";

export type SessionState = { authenticated: boolean; csrfToken?: string };

let csrfTokenMemory = "";

function currentCsrfToken() {
  try {
    if (typeof document === "undefined") return csrfTokenMemory;
    const cookie = document.cookie.split(/;\s*/).find((part) => part.startsWith("kitonynav_csrf="));
    // Cookie 随同源会话跨标签页更新，不沿用另一会话留下的内存令牌。
    csrfTokenMemory = cookie ? decodeURIComponent(cookie.slice("kitonynav_csrf=".length)) : "";
  } catch {
    // Cookie 不可读时，仅保留本次登录响应中的令牌。
  }
  return csrfTokenMemory;
}

function clearLegacyCsrfStorage() {
  try {
    sessionStorage.removeItem("kitonynav-csrf");
  } catch {
    // 临时存储不可用不能改变已经完成的登录或退出结果。
  }
}

async function errorMessage(response: Response) {
  const text = (await response.text()).trim();
  if (!text) return response.statusText || `请求失败（HTTP ${response.status}）`;
  try {
    const value = JSON.parse(text) as { error?: string };
    return value.error || text;
  } catch {
    return text;
  }
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const csrfToken = method === "GET" || method === "HEAD" ? "" : currentCsrfToken();
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export function fetchBootstrap(signal?: AbortSignal): Promise<BootstrapData> {
  return request<BootstrapData>("/api/v1/bootstrap", { signal });
}

export function fetchSession(): Promise<SessionState> {
  return request<SessionState>("/api/v1/auth/session");
}

export async function login(password: string) {
  const result = await request<SessionState>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ password }) });
  if (result.csrfToken) {
    csrfTokenMemory = result.csrfToken;
    clearLegacyCsrfStorage();
  }
  return result;
}

export async function logout() {
  const result = await request<void>("/api/v1/auth/logout", { method: "POST" });
  csrfTokenMemory = "";
  clearLegacyCsrfStorage();
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

export async function fetchClientNetwork(signal?: AbortSignal) {
  return request<{ address?: string; family?: string; source?: string; status: string }>("/api/v1/network/client", { signal });
}

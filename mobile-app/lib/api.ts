import * as SecureStore from "expo-secure-store";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const TOKEN_KEY = "flownexa.access-token";
const DEVICE_TOKEN_KEY = "flownexa.device-token";
let refreshRequest: Promise<string | null> | null = null;
export type Task = { id: string; title: string; description?: string | null; status: string; priority: string; dueAt: string | null; progress?: number; project?: { id?: string; name: string; workspaceId?: string } | null; assignees?: { user: { id: string; name: string; email?: string } }[] };
export type Workspace = { id: string; name: string; logoUrl?: string | null };
export type Organization = { id: string; name: string; role?: string; workspaces: Workspace[] };
export type UserProfile = { id: string; name: string; email: string; phoneNumber?: string | null; avatarUrl?: string | null; role?: string; organizationName?: string | null; emailVerifiedAt?: string | null };
export class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }

// Keep mobile auth tokens in encrypted device storage rather than AsyncStorage.
export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (value: string) => SecureStore.setItemAsync(TOKEN_KEY, value),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
  getDevice: () => SecureStore.getItemAsync(DEVICE_TOKEN_KEY),
  setDevice: (value: string) => SecureStore.setItemAsync(DEVICE_TOKEN_KEY, value),
  clearDevice: () => SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY),
};

export async function refreshAccessToken() {
  if (!refreshRequest) {
    refreshRequest = fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async (response) => { if (!response.ok) return null; const session = await response.json() as { accessToken: string }; await tokenStore.set(session.accessToken); return session.accessToken; })
      .catch(() => null).finally(() => { refreshRequest = null; });
  }
  return refreshRequest;
}

export async function api<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const token = await tokenStore.get();
  const headers = new Headers(options.headers);
  const isMultipart = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isMultipart) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
  if (response.status === 401 && !retried && !path.startsWith("/auth/")) {
    if (await refreshAccessToken()) return api<T>(path, options, true);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new ApiError(body.message ?? `Request failed (${response.status})`, response.status);
  }
  return response.json() as Promise<T>;
}

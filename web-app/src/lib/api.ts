export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
type ApiOptions = RequestInit & { auth?: boolean; retried?: boolean };
let refreshInFlight: Promise<string | null> | null = null;

export async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${apiUrl}/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async response => {
        if (!response.ok) return null;
        const session = await response.json() as { accessToken: string };
        sessionStorage.setItem("flownexa-access-token", session.accessToken);
        return session.accessToken;
      }).catch(() => null).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { auth = true, retried = false, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);
  if (requestOptions.body && !(requestOptions.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const token = typeof window !== "undefined" ? sessionStorage.getItem("flownexa-access-token") : null;
  if (auth && token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${apiUrl}${path}`, { ...requestOptions, headers, credentials: "include" });
  const authRoute = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"].includes(path);
  if (response.status === 401 && auth && !retried && !authRoute) {
    if (await refreshAccessToken()) return apiFetch<T>(path, { ...options, retried: true });
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string | string[] };
    throw new Error(Array.isArray(error.message) ? error.message.join("; ") : error.message ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

// API DOWNLOAD: send the current access token for private evidence files and refresh once when needed.
export async function apiBlob(path: string, retried = false): Promise<Blob> {
  const headers = new Headers();
  const token = typeof window !== "undefined" ? sessionStorage.getItem("flownexa-access-token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${apiUrl}${path}`, { headers, credentials: "include" });
  if (response.status === 401 && !retried && await refreshAccessToken()) return apiBlob(path, true);
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string | string[] };
    throw new Error(Array.isArray(error.message) ? error.message.join("; ") : error.message ?? `Download failed (${response.status})`);
  }
  return response.blob();
}

export function saveAccessToken(token: string) { sessionStorage.setItem("flownexa-access-token", token); }

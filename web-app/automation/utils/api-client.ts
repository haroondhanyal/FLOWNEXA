import type { APIRequestContext, APIResponse } from "@playwright/test";

// API CLIENT: common request/response helpers keep endpoint tests short and readable.
export class FlowNexaApi {
  constructor(private readonly request: APIRequestContext, private readonly organizationId: string) {}
  async get(path: string, workspaceId?: string) {
    const suffix = workspaceId ? `${path.includes("?") ? "&" : "?"}workspaceId=${encodeURIComponent(workspaceId)}` : "";
    return this.request.get(`/organizations/${this.organizationId}${path}${suffix}`);
  }
  async json(response: APIResponse) { return response.json() as Promise<unknown>; }
  async isJson(response: APIResponse) { return (response.headers()["content-type"] ?? "").includes("application/json"); }
}

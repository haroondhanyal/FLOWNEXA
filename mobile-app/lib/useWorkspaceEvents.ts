import { useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL, refreshAccessToken, tokenStore } from "./api";

// Subscribe only to the selected organization after the API validates membership.
export function useWorkspaceEvents(organizationId: string | undefined, onEvent: () => void) {
  useEffect(() => {
    let socket: Socket | undefined;
    let cancelled = false;
    void tokenStore.get().then((token) => {
      if (!token || !organizationId || cancelled) return;
      const origin = API_URL.replace(/\/api\/v1\/?$/, "");
      socket = io(`${origin}/events`, { auth: { token }, transports: ["websocket"] });
      socket.on("connect", () => socket?.emit("join-organization", organizationId));
      socket.on("auth-expired", () => { void refreshAccessToken().then((nextToken) => { if (nextToken && socket) { socket.auth = { token: nextToken }; socket.connect(); } }); });
      ["task.updated", "work-update.created", "comment.created", "review.requested", "review.decided"].forEach((event) => socket?.on(event, onEvent));
    }).catch(() => undefined);
    return () => { cancelled = true; socket?.disconnect(); };
  }, [organizationId, onEvent]);
}

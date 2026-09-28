"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { apiUrl, refreshAccessToken } from "@/lib/api";

// Bridge authenticated organization events into local screen refresh events.
export function RealtimeBridge({ organizationId }: { organizationId: string }) {
  useEffect(() => {
    const token = sessionStorage.getItem("flownexa-access-token");
    if (!token || !organizationId) return;
    const origin = apiUrl.replace(/\/api\/v1\/?$/, "");
    const socket = io(`${origin}/events`, { auth: { token }, transports: ["websocket"] });
    socket.on("connect", () => socket.emit("join-organization", organizationId));
    socket.on("auth-expired", () => { void refreshAccessToken().then((nextToken) => { if (nextToken) { socket.auth = { token: nextToken }; socket.connect(); } }); });
    ["task.updated", "work-update.created", "comment.created", "review.requested", "review.decided"].forEach((event) => {
      socket.on(event, (detail) => window.dispatchEvent(new CustomEvent("flownexa:workspace-event", { detail: { event, ...detail } })));
    });
    return () => { socket.disconnect(); };
  }, [organizationId]);
  return null;
}

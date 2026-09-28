"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { WorkspaceScreenProps } from "./types";

type Notification = { id: string; title: string; body: string; readAt: string | null; createdAt: string };
// INBOX SCREEN: shows stored alerts, supports read state and lets the owner archive handled items.
export function InboxScreen({ organizationId }: WorkspaceScreenProps) {
  const [items, setItems] = useState<Notification[]>([]);
  const refresh = useCallback(() => apiFetch<Notification[]>(`/organizations/${organizationId}/notifications`).then(setItems).catch(() => setItems([])), [organizationId]);
  useEffect(() => {
    void refresh();
    const handleEvent = () => void refresh();
    window.addEventListener("flownexa:workspace-event", handleEvent);
    const timer = window.setInterval(() => void refresh(), 60000);
    return () => { window.removeEventListener("flownexa:workspace-event", handleEvent); window.clearInterval(timer); };
  }, [refresh]);
  const markRead = async (id: string) => { await apiFetch(`/organizations/${organizationId}/notifications/${id}/read`, { method: "PATCH" }); await refresh(); };
  const archive = async (id: string) => { await apiFetch(`/organizations/${organizationId}/notifications/${id}/archive`, { method: "PATCH" }); await refresh(); };
  return <div className="updates-list">{items.length ? items.map((item) => <article className="update-card" key={item.id}><div><b>{item.title}</b><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small>{!item.readAt && <button className="secondary-button" onClick={() => void markRead(item.id)}>Mark read</button>}<button className="secondary-button" onClick={() => void archive(item.id)}>Archive</button></div></article>) : <div className="empty-state"><b>Inbox is clear</b><span>Workspace task and review notifications will appear here.</span></div>}</div>;
}

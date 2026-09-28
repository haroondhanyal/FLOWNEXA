"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { WorkspaceScreenProps } from "./types";

type AuditItem = { id: string; action: string; createdAt: string; user: { name: string }; task?: { title: string } | null };
// AUDIT SCREEN: provides a read-only record of who changed workspace work and when.
export function AuditScreen({ organizationId }: WorkspaceScreenProps) {
  const [items, setItems] = useState<AuditItem[]>([]);
  useEffect(() => { void apiFetch<AuditItem[]>(`/organizations/${organizationId}/audit-history`).then(setItems).catch(() => setItems([])); }, [organizationId]);
  return <div className="updates-list">{items.length ? items.map((item) => <article className="update-card" key={item.id}><div><b>{item.action.replaceAll("_", " ")}</b><p>{item.task?.title ?? "Workspace"} · {item.user.name}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div></article>) : <div className="empty-state">No audit events yet.</div>}</div>;
}

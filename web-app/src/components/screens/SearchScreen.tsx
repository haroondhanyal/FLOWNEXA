"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { WorkspaceScreenProps } from "./types";

type SearchResult = { tasks: { id: string; title: string; status: string }[]; projects: { id: string; name: string; status: string }[]; comments?: { id: string; body: string; task: { title: string }; author: { name: string } }[] };
// SEARCH SCREEN: find tasks, projects and discussion text in this organization.
export function SearchScreen({ organizationId, workspaceId, query }: WorkspaceScreenProps) {
  const [results, setResults] = useState<SearchResult>({ tasks: [], projects: [] });
  useEffect(() => { if (query.trim().length < 2) { setResults({ tasks: [], projects: [] }); return; } const timer = window.setTimeout(() => { void apiFetch<SearchResult>(`/organizations/${organizationId}/search?q=${encodeURIComponent(query)}&workspaceId=${encodeURIComponent(workspaceId ?? "")}`).then(setResults).catch(() => setResults({ tasks: [], projects: [] })); }, 250); return () => window.clearTimeout(timer); }, [organizationId, workspaceId, query]);
  const matches = [...results.tasks.map((item) => ({ name: item.title, detail: `Task · ${item.status}` })), ...results.projects.map((item) => ({ name: item.name, detail: `Project · ${item.status}` })), ...(results.comments ?? []).map((item) => ({ name: item.body, detail: `Comment on ${item.task.title} · ${item.author.name}` }))];
  return <div className="form-card"><h2>Search results</h2><p>Matching “{query}” in this organization.</p>{matches.length ? matches.map((item, index) => <div className="day-task" key={`${item.name}-${index}`}><b>{item.name}</b><small>{item.detail}</small></div>) : <p>No matching tasks, projects or comments.</p>}</div>;
}

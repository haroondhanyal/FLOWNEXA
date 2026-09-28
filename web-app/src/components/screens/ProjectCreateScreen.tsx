"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { WorkspaceProject } from "./types";

// PROJECT CREATION SCREEN: saves the basic goal, status, and due date for a shared project.
export function ProjectCreateScreen({ organizationId, workspaceId, userName, onCreated, onMessage }: { organizationId: string; workspaceId: string; userName: string; onCreated: (project: WorkspaceProject) => void; onMessage: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const submit = async (form: FormData) => {
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    setBusy(true);
    try {
      const created = await apiFetch<{ id: string; name: string; status: string; targetDate: string | null }>(`/organizations/${organizationId}/projects`, { method: "POST", body: JSON.stringify({ workspaceId, name, description: String(form.get("description") ?? ""), status: String(form.get("status") ?? "PLANNING").toUpperCase().replaceAll(" ", "_"), targetDate: form.get("due") || undefined }) });
      onCreated({ id: created.id, name: created.name, status: created.status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()), due: created.targetDate ? new Date(created.targetDate).toLocaleDateString() : "No date", lead: userName, progress: 0 });
    } catch (cause) { onMessage(cause instanceof Error ? cause.message : "Project creation failed"); }
    finally { setBusy(false); }
  };
  return <form className="form-card" action={(form) => void submit(form)}><h2>Create a project</h2><p>Set up a shared space for a goal or initiative.</p><label className="field-label">Project name<input name="name" required placeholder="e.g. Mobile launch" /></label><label className="field-label">Description<input name="description" placeholder="What is this project about?" /></label><div className="modal-row"><label className="field-label">Status<select name="status"><option>Planning</option><option>Active</option><option>On hold</option></select></label><label className="field-label">Target date<input type="date" name="due" /></label></div><button className="primary-button" disabled={busy}>{busy ? "Creating project…" : "Create project"}<ArrowRight size={15}/></button></form>;
}

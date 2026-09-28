import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { TeamRecord } from "@/hooks/useWorkspaceData";

type CatalogPermission = { key: string; description: string };
type RoleRecord = { id: string; name: string; permissions: string[]; memberCount: number };
type RoleResponse = { catalog: CatalogPermission[]; roles: RoleRecord[] };

// ROLES SCREEN: define explicit permission sets and grant a custom role to an organization member.
export function RolesScreen({ organizationId, members, onMessage }: { organizationId: string; members: TeamRecord[]; onMessage: (message: string) => void }) {
  const [catalog, setCatalog] = useState<CatalogPermission[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [assignedRoles, setAssignedRoles] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const load = useCallback(async () => { try { const response = await apiFetch<RoleResponse>(`/organizations/${organizationId}/roles`); setCatalog(response.catalog); setRoles(response.roles); setLoadError(""); } catch (error) { setLoadError(error instanceof Error ? error.message : "Could not load roles"); } }, [organizationId]);
  useEffect(() => { void load(); }, [load]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true);
    try { await apiFetch(`/organizations/${organizationId}/roles`, { method: "POST", body: JSON.stringify({ id: editingId, name, permissions }) }); setName(""); setPermissions([]); setEditingId(undefined); await load(); onMessage("Access role saved"); }
    catch (error) { onMessage(error instanceof Error ? error.message : "Could not save role"); } finally { setBusy(false); }
  };
  const grant = async (userId: string, roleId: string) => { try { await apiFetch(`/organizations/${organizationId}/members/${userId}/role`, { method: "PATCH", body: JSON.stringify({ roleId: roleId || null }) }); setAssignedRoles({ ...assignedRoles, [userId]: roleId }); onMessage("Member access updated"); } catch (error) { onMessage(error instanceof Error ? error.message : "Could not update access"); } };
  return <>
    {loadError && <p role="alert" className="toolbar-note">{loadError}</p>}
    <div className="roles-grid">{["Owner", "Admin", "Member", "Viewer"].map((role) => <article className="role-card" key={role}><ShieldCheck size={17}/><b>{role}</b><p>{role === "Owner" ? "Full organization control." : role === "Admin" ? "Manage workspace settings and team access." : role === "Member" ? "Create and update delivery work." : "Read workspace data without editing."}</p></article>)}</div>
    <h2>Custom access roles</h2>
    <form className="project-view-card" onSubmit={save}><label className="field-label">Role name<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} placeholder="e.g. Reviewer" /></label><div className="roles-grid">{catalog.map((permission) => <label key={permission.key}><input type="checkbox" checked={permissions.includes(permission.key)} onChange={(event) => setPermissions(event.target.checked ? [...permissions, permission.key] : permissions.filter((key) => key !== permission.key))}/>{permission.description}</label>)}</div><div className="view-toolbar"><button className="primary-button" disabled={busy}>{editingId ? "Update role" : "Create role"}</button>{editingId && <button type="button" className="secondary-button" onClick={() => { setEditingId(undefined); setName(""); setPermissions([]); }}>Cancel</button>}</div></form>
    <div className="project-view-grid">{roles.map((role) => <article className="role-card" key={role.id}><b>{role.name}</b><p>{role.permissions.length} permissions · {role.memberCount} members</p><small>{role.permissions.join(" · ") || "No permissions granted"}</small><button className="secondary-button" onClick={() => { setEditingId(role.id); setName(role.name); setPermissions(role.permissions); }}>Edit role</button></article>)}</div>
    <h2>Member access</h2><div className="data-table">{members.map((member) => <div className="table-row team-row" key={member.id}><span>{member.name}<small>{member.email}</small></span><span>{member.role}</span><select value={assignedRoles[member.id] ?? member.customRoleId ?? ""} aria-label={`Custom role for ${member.name}`} onChange={(event) => void grant(member.id, event.target.value)}><option value="">Use organization role</option>{roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></div>)}</div>
  </>;
}

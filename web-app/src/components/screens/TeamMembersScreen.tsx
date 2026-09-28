import { useState, type FormEvent } from "react";
import { UserPlus, Users, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { TeamGroupRecord, TeamRecord } from "@/hooks/useWorkspaceData";

// TEAMS SCREEN: organization members retain their real role and can be assigned to teams.
export function TeamMembersScreen({ organizationId, workspaceId, members, teams, onTeamsChange, onInvite, onRoles, onMessage }: { organizationId: string; workspaceId: string; members: TeamRecord[]; teams: TeamGroupRecord[]; onTeamsChange: (teams: TeamGroupRecord[]) => void; onInvite: () => void; onRoles: () => void; onMessage: (message: string) => void }) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [newTeam, setNewTeam] = useState("");
  const [busy, setBusy] = useState(false);
  const createTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const name = newTeam.trim(); if (!name || !workspaceId) return;
    setBusy(true);
    try { const team = await apiFetch<TeamGroupRecord>(`/organizations/${organizationId}/teams`, { method: "POST", body: JSON.stringify({ workspaceId, name }) }); onTeamsChange([...teams, team].sort((a, b) => a.name.localeCompare(b.name))); setNewTeam(""); onMessage("Team created"); }
    catch (error) { onMessage(error instanceof Error ? error.message : "Could not create team"); } finally { setBusy(false); }
  };
  const assign = async (teamId: string, userId: string) => {
    if (!userId) return;
    try { await apiFetch(`/organizations/${organizationId}/teams/${teamId}/members`, { method: "POST", body: JSON.stringify({ userId }) }); const user = members.find((member) => member.id === userId); if (!user) return; onTeamsChange(teams.map((team) => team.id === teamId && !team.members.some((item) => item.user.id === userId) ? { ...team, members: [...team.members, { user: { id: user.id, name: user.name, email: user.email } }] } : team)); setSelected({ ...selected, [teamId]: "" }); onMessage("Member added to team"); }
    catch (error) { onMessage(error instanceof Error ? error.message : "Could not add member"); }
  };
  const remove = async (teamId: string, userId: string) => {
    try { await apiFetch(`/organizations/${organizationId}/teams/${teamId}/members/${userId}`, { method: "DELETE" }); onTeamsChange(teams.map((team) => team.id === teamId ? { ...team, members: team.members.filter((item) => item.user.id !== userId) } : team)); onMessage("Member removed from team"); }
    catch (error) { onMessage(error instanceof Error ? error.message : "Could not remove member"); }
  };
  return <>
    <div className="view-toolbar"><span className="toolbar-note">{members.length} organization members · {teams.length} teams</span><button className="secondary-button" onClick={onRoles}>Roles &amp; access</button><button className="primary-button" onClick={onInvite}><UserPlus size={15}/>Invite member</button></div>
    <form className="view-toolbar" onSubmit={createTeam}><label className="inline-search">New team<input value={newTeam} onChange={(event) => setNewTeam(event.target.value)} required minLength={2} maxLength={80} placeholder="e.g. Product design" /></label><button className="secondary-button" disabled={busy || !workspaceId}>Create team</button></form>
    <div className="data-table"><div className="table-head team-head"><span>Member</span><span>Team</span><span>Role</span><span>Membership</span><span>Access</span></div>{members.map((member, index) => <div className="table-row team-row" key={member.id}><span className="task-title-cell"><span className={`avatar avatar-${["lavender", "mint", "peach", "blue"][index % 4]}`}>{member.name.split(" ").map((part) => part[0]).join("")}</span><span><b>{member.name}</b><small>{member.email}</small></span></span><span>{member.teams.join(", ") || "No team"}</span><span>{member.role}</span><span>Organization member</span><span><em className="state-pill">Active</em></span></div>)}</div>
    <div className="project-view-grid">{teams.map((team) => <article className="project-view-card" key={team.id}><div className="project-card-top"><span className="project-title"><Users size={16}/>{team.name}</span></div><p>{team.members.length} team members</p>{team.members.map(({ user }) => <div className="view-toolbar" key={user.id}><span>{user.name} · {user.email}</span><button aria-label={`Remove ${user.name} from ${team.name}`} className="icon-button" onClick={() => void remove(team.id, user.id)}><X size={15}/></button></div>)}<div className="view-toolbar"><select value={selected[team.id] ?? ""} onChange={(event) => setSelected({ ...selected, [team.id]: event.target.value })}><option value="">Choose organization member</option>{members.filter((item) => !team.members.some(({ user }) => user.id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</select><button className="secondary-button" disabled={!selected[team.id]} onClick={() => void assign(team.id, selected[team.id])}>Add</button></div></article>)}</div>
    {!members.length && <div className="empty-state"><Users size={22}/><b>No team members yet</b><span>Invite teammates so they can join this organization.</span></div>}
  </>;
}

import { Users } from "lucide-react";
import type { WorkspaceMember } from "./types";

// TEAMS SCREEN: lets a workspace lead find members and understand their team and role.
export function TeamMembersScreen({ members, onInvite, onRoles }: { members: WorkspaceMember[]; onInvite: () => void; onRoles: () => void }) {
  return <>
    <div className="view-toolbar"><span className="toolbar-note">Members and workspace teams</span><button className="secondary-button" onClick={onRoles}>Roles &amp; access</button><button className="primary-button" onClick={onInvite}><Users size={15}/>Invite member</button></div>
    {members.length ? <div className="data-table"><div className="table-head team-head"><span>Member</span><span>Team</span><span>Role</span><span>Membership</span><span>Access</span></div>{members.map((member, index) => <div className="table-row team-row" key={`${member.email}-${member.team}`}><span className="task-title-cell"><span className={`avatar avatar-${["lavender", "mint", "peach", "blue"][index % 4]}`}>{member.name.split(" ").map((part) => part[0]).join("")}</span><span><b>{member.name}</b><small>{member.email}</small></span></span><span>{member.team}</span><span>{member.role}</span><span>Team member</span><span><em className="state-pill">Active</em></span></div>)}</div> : <div className="empty-state"><Users size={22}/><b>No team members yet</b><span>Invite teammates so they can join this organization.</span></div>}
  </>;
}

"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { AuditScreen, BoardScreen, CalendarScreen, InboxScreen, InviteMemberScreen, MyDayScreen, OverviewScreen, ProjectCreateScreen, ProjectListScreen, ReportsScreen, ReviewsScreen, RolesScreen, SearchScreen, TaskActivityScreen, TaskListScreen, TeamMembersScreen } from "@/components/screens";
import { AiAssistantScreen } from "@/components/AiAssistantScreen";
import { RealtimeBridge } from "@/components/RealtimeBridge";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import {
  Activity, ArrowRight, Bell, CalendarDays,
  Check, ChevronDown, CircleHelp, CirclePlus, Command, FolderKanban,
  LayoutDashboard, ListTodo, MoreHorizontal, PanelLeftClose, Plus, Search,
  ShieldCheck, Sparkles, Users, X,
} from "lucide-react";

const nav = [
  { label: "Workspace", items: [{ name: "Overview", icon: LayoutDashboard }, { name: "My work", icon: ListTodo }, { name: "Calendar", icon: CalendarDays }, { name: "Inbox", icon: Bell }] },
  { label: "Manage", items: [{ name: "Projects", icon: FolderKanban }, { name: "Teams", icon: Users }, { name: "Reviews", icon: ShieldCheck }, { name: "Audit history", icon: Activity }, { name: "Reports", icon: Activity }, { name: "AI assistant", icon: Sparkles }] },
];
// WORKSPACE APP SHELL: loads the signed-in user's organization and routes navigation to its screens.
// Data requests use the shared API client so session refresh and authentication stay consistent.
export default function Home() {
  const [active, setActive] = useState("Overview");
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3000); };
  const { ready, organizationId, organizationName, workspaceId, currentUser, taskRecords, projectRecords, setProjectRecords, teamRecords, teamGroups, setTeamGroups, workUpdates, visibleTasks, createTask, changeTaskStatus, changeProjectStatus } = useWorkspaceData(query, notify, () => setShowCreate(false));
  const signOut = async () => { try { await apiFetch("/auth/logout", { method: "POST", auth: false }); } catch { /* Clear this browser session even if the API is offline. */ } sessionStorage.removeItem("flownexa-access-token"); window.location.assign("/login"); };

  if (!ready) return <main className="auth-loading"><span className="brand-mark"><span/><span/><span/><span/></span><span>Loading your workspace…</span></main>;

  return <main className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#home"><span className="brand-mark"><span /><span /><span /><span /></span><span>flow<span className="brand-light">nexa</span></span><PanelLeftClose size={17} className="collapse" /></a>
      <button className="org-switch" onClick={()=>window.location.assign("/onboarding")} title="Set up an organization"><span className="org-icon">{organizationName[0]?.toUpperCase()}</span><span className="org-copy"><b>{organizationName}</b><small>Workspace</small></span><ChevronDown size={15} /></button>
      <button className="create-button" onClick={() => setShowCreate(true)}><CirclePlus size={17} /> Create new <span className="plus-shortcut">⌘ N</span></button>
      <nav>{nav.map((group) => <section className="nav-group" key={group.label}><p className="nav-label">{group.label}</p>{group.items.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${active === name ? "selected" : ""}`} onClick={() => setActive(name)}><Icon size={17} strokeWidth={1.8} /><span>{name}</span></button>)}</section>)}
        <section className="nav-group"><p className="nav-label">Your projects <button aria-label="Add project" onClick={() => setActive("Projects")}><Plus size={14}/></button></p>{projectRecords.slice(0,4).map((project,index)=><button className="project-link" key={project.name} onClick={()=>setActive("Projects")}><i className={`project-dot ${["purple","orange","green","blue"][index%4]}`}/>{project.name}</button>)}</section>
      </nav>
      <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={16}/></div><b>Make work flow</b><p>Bring your team together and get more done.</p><button onClick={() => setActive("Plans")}>Explore plans <ArrowRight size={14}/></button></div><button className="nav-item"><CircleHelp size={17}/><span>Help & support</span></button><button className="profile" onClick={signOut}><span className="avatar avatar-user">{currentUser.name.split(" ").map(part=>part[0]).join("").slice(0,2)}</span><span className="profile-copy"><b>{currentUser.name}</b><small>Sign out</small></span><MoreHorizontal size={18}/></button></div>
    </aside>

    <section className="main-panel">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><b>{active}</b></div><div className="top-actions"><label className="search-box"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") setActive("Search"); }} placeholder="Search anything..."/><kbd><Command size={11}/> K</kbd></label><button className="icon-button" aria-label="Notifications" onClick={() => setActive("Inbox")}><Bell size={18}/></button><span className="top-divider"/><button className="avatar avatar-user top-avatar" aria-label="Sign out" onClick={signOut}>{currentUser.name.split(" ").map(part=>part[0]).join("").slice(0,2)}</button></div></header>

      <div className={`content content-${active.replaceAll(" ", "-")}`} id="home">
        {active !== "Overview" && <section className="workspace-view"><div className="view-heading"><div><div className="eyebrow">FLOWNEXA WORKSPACE</div><h1>{active}</h1><p className="welcome-sub">Manage your {active.toLowerCase()} across {organizationName}.</p></div><div className="view-actions">{(active === "Projects" || active === "Teams" || active === "My work") && <button className="primary-button" onClick={() => active === "My work" ? setShowCreate(true) : active === "Projects" ? setActive("New project") : setActive("Invite member")}><Plus size={16}/>{active === "My work" ? "Create task" : active === "Projects" ? "New project" : "Invite member"}</button>}</div></div>
          {/* SEARCH SCREEN: find organization tasks and projects from one place. */}
          {active === "Search" && <SearchScreen organizationId={organizationId} tasks={taskRecords} query={query} onMessage={notify}/>}
          {/* AI ASSISTANT SCREEN: answer questions using the API's organization-scoped context. */}
          {active === "AI assistant" && <AiAssistantScreen organizationId={organizationId}/>}
          {/* MY WORK SCREEN: list tasks and let a teammate make a basic status change. */}
          {active === "My work" && <TaskListScreen tasks={visibleTasks} query={query} onQueryChange={setQuery} onOpenScreen={setActive} onChangeStatus={(task, state) => void changeTaskStatus(task, state)} />}
          {/* BOARD SCREEN: group tasks by status so blockers and active work are easy to see. */}
          {active === "Board" && <BoardScreen tasks={taskRecords} onChangeStatus={(task, state) => void changeTaskStatus(task, state)} />}
          {/* PROJECTS SCREEN: browse active projects and check delivery progress at a glance. */}
          {active === "Projects" && <ProjectListScreen projects={projectRecords} organizationName={organizationName} query={query} onQueryChange={setQuery} onCreate={() => setActive("New project")} onStatusChange={(project, status) => void changeProjectStatus(project, status)} />}
          {/* TEAMS SCREEN: see who belongs to each team before managing invitations. */}
          {active === "Teams" && <TeamMembersScreen organizationId={organizationId} workspaceId={workspaceId} members={teamRecords} teams={teamGroups} onTeamsChange={setTeamGroups} onInvite={() => setActive("Invite member")} onRoles={() => setActive("Roles & access")} onMessage={notify} />}
          {/* INVITE SCREEN: create a time-limited link so the right person can join this organization. */}
          {active === "Invite member" && <InviteMemberScreen organizationId={organizationId} onCreated={(inviteToken) => { setActive("Teams"); setToast(`Share: /login?organizationId=${organizationId}#${inviteToken}`); window.setTimeout(() => setToast(""), 20000); }} onMessage={notify} />}
          {/* NEW PROJECT SCREEN: collect the project basics before saving a shared delivery space. */}
          {active === "New project" && <ProjectCreateScreen organizationId={organizationId} workspaceId={workspaceId} userName={currentUser.name} onCreated={(project) => { setProjectRecords((current) => [project, ...current]); setActive("Projects"); notify("Project created"); }} onMessage={notify} />}
          {/* ROLES SCREEN: explain the access levels teammates can have in this workspace. */}
          {active === "Roles & access" && <RolesScreen organizationId={organizationId} members={teamRecords} onMessage={notify} />}
          {/* MY DAY SCREEN: focus the signed-in teammate on work due today. */}
          {active === "My day" && <MyDayScreen tasks={taskRecords} />}
          {/* CALENDAR SCREEN: show upcoming due dates across this organization's tasks. */}
          {active === "Calendar" && <CalendarScreen organizationId={organizationId} tasks={taskRecords} query={query} onMessage={notify}/>}
          {/* REPORTS SCREEN: make persisted task and time totals visible to workspace leads. */}
          {active === "Reports" && <ReportsScreen organizationId={organizationId} tasks={taskRecords} query={query} onMessage={notify}/>}
          {/* REVIEWS SCREEN: help managers make and explain decisions on submitted work. */}
          {active === "Reviews" && <ReviewsScreen organizationId={organizationId} tasks={taskRecords} query={query} onMessage={notify}/>}
          {/* AUDIT SCREEN: keep a read-only trail for accountability and troubleshooting. */}
          {active === "Audit history" && <AuditScreen organizationId={organizationId} tasks={taskRecords} query={query} onMessage={notify}/>}
          {/* INBOX SCREEN: collect review notifications and let each person track what they read. */}
          {active === "Inbox" && <InboxScreen organizationId={organizationId} tasks={taskRecords} query={query} onMessage={notify}/>}
          {/* WORK UPDATES SCREEN: record progress and supporting context on a selected task. */}
          {active === "Work updates" && <TaskActivityScreen organizationId={organizationId} tasks={taskRecords} query={query} onMessage={notify}/>}
          {!["My work","Board","Projects","Teams","Invite member","New project","Work updates","Roles & access","My day","Calendar","Reports","Reviews","Audit history","Inbox","Search","AI assistant"].includes(active) && <div className="empty-state"><Sparkles size={22}/><b>{active} is ready for the next phase</b><span>This workspace section will connect to the shared API and organization data in the following implementation phases.</span></div>}
        </section>}
        {/* OVERVIEW SCREEN: summarize real organization tasks, progress, projects, and recent updates. */}
        <OverviewScreen userName={currentUser.name} organizationName={organizationName} tasks={taskRecords} projects={projectRecords} teamCount={teamRecords.length} workUpdates={workUpdates} onCreateTask={() => setShowCreate(true)} onOpenScreen={setActive} onChangeStatus={(task, state) => void changeTaskStatus(task, state)} />
        <footer className="footer"><span>© 2026 FlowNexa</span><span><i className="live-dot"/> Workspace connected</span><span>Privacy</span><span>Terms</span></footer>
      </div>
    </section>
    {showCreate && <div className="modal-backdrop" onClick={() => setShowCreate(false)}><form className="create-modal" action={createTask} onClick={(event) => event.stopPropagation()}><div className="modal-top"><div><h2>Create a task</h2><p>Add a new task to your workspace</p></div><button type="button" aria-label="Close" onClick={() => setShowCreate(false)}><X size={18}/></button></div><label className="field-label">Task name<input autoFocus name="title" required placeholder="What needs to get done?" /></label><label className="field-label">Project<select name="project" defaultValue=""><option value="" disabled>Select a project</option>{projectRecords.map(p=><option key={p.name} value={p.id}>{p.name}</option>)}</select></label><div className="modal-row"><label className="field-label">Priority<select name="priority"><option>Medium</option><option>High</option><option>Urgent</option><option>Low</option></select></label><label className="field-label">Due date<input name="due" type="date"/></label></div><div className="modal-bottom"><span>Task ID assigned automatically</span><button className="primary-button">Create task <ArrowRight size={15}/></button></div></form></div>}
    <RealtimeBridge organizationId={organizationId}/>
    {toast && <div className="toast"><Check size={15}/>{toast}</div>}
  </main>;
}

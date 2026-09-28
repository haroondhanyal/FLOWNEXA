import { FolderKanban, Plus, Search } from "lucide-react";
import type { WorkspaceProject } from "./types";

type Props = { projects: WorkspaceProject[]; organizationName: string; query: string; onQueryChange: (value: string) => void; onCreate: () => void };

// PROJECTS SCREEN: shows a project's delivery progress, lead, and target date together.
export function ProjectListScreen({ projects, organizationName, query, onQueryChange, onCreate }: Props) {
  const visible = projects.filter((project) => project.name.toLowerCase().includes(query.toLowerCase()));
  return <>
    <div className="view-toolbar"><span className="toolbar-note">{projects.length} projects in {organizationName}</span><label className="inline-search"><Search size={14}/><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search projects"/></label><button className="primary-button" onClick={onCreate}><Plus size={15}/>New project</button></div>
    {visible.length ? <div className="project-view-grid">{visible.map((project, index) => <article className="project-view-card" key={project.id ?? project.name}><div className="project-card-top"><span className="project-title"><i className={`project-dot ${["purple", "orange", "green", "blue"][index % 4]}`}/>{project.name}</span></div><p>Shared project workspace and delivery plan</p><span className={`state-pill ${project.status.toLowerCase().replace(" ", "-")}`}>{project.status}</span><div className="project-progress"><div><i style={{ width: `${project.progress}%`, background: "#8272d8" }}/></div><span>{project.progress}%</span></div><div className="project-view-foot"><span>Lead · {project.lead}</span><span>Due {project.due}</span></div></article>)}</div> : <div className="empty-state"><FolderKanban size={22}/><b>{projects.length ? "No matching projects" : "No projects yet"}</b><span>{projects.length ? "Try another search." : "Create a project to organize the work in this organization."}</span></div>}
  </>;
}

import { Check, Search } from "lucide-react";
import type { WorkspaceTask } from "./types";

type Props = {
  tasks: WorkspaceTask[];
  query: string;
  onQueryChange: (value: string) => void;
  onOpenScreen: (screen: string) => void;
  onChangeStatus: (task: WorkspaceTask, status: string) => void;
};

// MY WORK SCREEN: gives a teammate one searchable list of assigned and shared tasks.
export function TaskListScreen({ tasks, query, onQueryChange, onOpenScreen, onChangeStatus }: Props) {
  return <>
    <div className="view-toolbar"><div className="task-tabs"><button className="tab-active">All tasks <span>{tasks.length}</span></button><button onClick={() => onOpenScreen("My day")}>My day</button><button onClick={() => onOpenScreen("Board")}>Board view</button><button onClick={() => onOpenScreen("Work updates")}>Work updates</button></div><label className="inline-search"><Search size={14}/><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Filter tasks"/></label></div>
    <div className="data-table"><div className="table-head"><span>Task</span><span>Project</span><span>Assignee</span><span>Priority</span><span>Status</span><span>Due date</span></div>{tasks.map((task) => <div className="table-row" key={task.id}><span className="task-title-cell"><button className={`task-check ${task.state === "Completed" ? "checked" : ""}`} onClick={() => onChangeStatus(task, task.state === "Completed" ? "To do" : "Completed")} aria-label="Toggle complete">{task.state === "Completed" && <Check size={12}/>}</button><span><b>{task.title}</b><small>{task.id.slice(-8).toUpperCase()}</small></span></span><span>{task.project}</span><span>{task.person}</span><span><i className={`priority-dot priority-${task.priority.toLowerCase()}`}/>{task.priority}</span><span><em className="state-pill">{task.state}</em></span><span>{task.date}</span></div>)}</div>
    {tasks.length === 0 && <div className="empty-state"><b>No matching tasks</b><span>Clear the search or create a task to get work moving.</span></div>}
  </>;
}

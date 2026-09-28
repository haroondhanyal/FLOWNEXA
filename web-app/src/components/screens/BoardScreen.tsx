import type { WorkspaceTask } from "./types";

const columns = ["To do", "In progress", "In review", "Completed"];
const nextStatus: Record<string, string> = { "To do": "In progress", "In progress": "In review", "In review": "Completed", Completed: "To do" };

// BOARD SCREEN: groups tasks by status so a team can spot blocked or unfinished work.
export function BoardScreen({ tasks, onChangeStatus }: { tasks: WorkspaceTask[]; onChangeStatus: (task: WorkspaceTask, status: string) => void }) {
  return <div className="board-columns">{columns.map((status) => {
    const columnTasks = tasks.filter((task) => task.state === status);
    return <section className="board-column" key={status}><h3>{status}<span>{columnTasks.length}</span></h3>{columnTasks.map((task) => <article className="board-card" key={task.id}><small>{task.id.slice(-8).toUpperCase()} · {task.project}</small><b>{task.title}</b><div><span className={`priority-dot priority-${task.priority.toLowerCase()}`}/>{task.priority}<button onClick={() => onChangeStatus(task, nextStatus[status])}>Move →</button></div></article>)}{columnTasks.length === 0 && <p className="empty-note">No tasks in this column</p>}</section>;
  })}</div>;
}

import { CalendarDays } from "lucide-react";
import type { WorkspaceTask } from "./types";

// MY DAY SCREEN: narrows workspace work to tasks due today for a quick daily plan.
export function MyDayScreen({ tasks }: { tasks: WorkspaceTask[] }) {
  const today = new Date().toLocaleDateString();
  const dueToday = tasks.filter((task) => task.date === today);
  return <div className="form-card"><h2>My day</h2><p>Plan and focus on the work that matters today.</p>{dueToday.map((task) => <div className="day-task" key={task.id}><CalendarDays size={15}/><span>{task.title}</span><small>{task.priority}</small></div>)}{dueToday.length === 0 && <div className="empty-state">No tasks due today. Enjoy the breathing room.</div>}</div>;
}

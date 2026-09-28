"use client";
import { useState } from "react";
import type { WorkspaceScreenProps } from "./types";

// CALENDAR SCREEN: a navigable month view of task due dates, using workspace task records.
export function CalendarScreen({ tasks }: WorkspaceScreenProps) {
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const dated = tasks.filter((task) => task.date !== "No date");
  const year = month.getFullYear(), monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const key = (day: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const display = (date: string) => { const parsed = new Date(date); return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`; };
  const [selected, setSelected] = useState<string>();
  const visible = selected ? dated.filter((task) => display(task.date) === selected) : dated.filter((task) => display(task.date).startsWith(`${year}-${String(monthIndex + 1).padStart(2, "0")}`)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return <div className="form-card"><h2>Task calendar</h2><p>Navigate months, inspect due dates, and open the task schedule.</p><div className="modal-row"><button className="secondary-button" onClick={() => { setMonth(new Date(year, monthIndex - 1, 1)); setSelected(undefined); }}>Previous</button><b>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</b><button className="secondary-button" onClick={() => { setMonth(new Date(year, monthIndex + 1, 1)); setSelected(undefined); }}>Next</button></div><div className="metric-grid" style={{ gridTemplateColumns: "repeat(7,minmax(0,1fr))" }}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <b key={day}>{day}</b>)}{Array.from({ length: firstDay }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: days }, (_, i) => { const day = i + 1, dateKey = key(day), count = dated.filter((task) => display(task.date) === dateKey).length; return <button key={day} className={selected === dateKey ? "primary-button" : "secondary-button"} onClick={() => setSelected(selected === dateKey ? undefined : dateKey)}>{day}{count ? ` · ${count}` : ""}</button>; })}</div>{visible.length ? visible.map((task) => <div className="day-task" key={task.id}><span>{task.date}</span><b>{task.title}</b><small>{task.project} · {task.state}</small></div>) : <p>{dated.length ? "No due tasks for this date or month." : "No tasks have due dates yet."}</p>}</div>;
}

"use client";
import { useMemo, useState } from "react";
import type { WorkspaceScreenProps } from "./types";

type CalendarMode = "day" | "week" | "month";
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parseTaskDate = (value: string) => { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed); };

// CALENDAR SCREEN: switch between day/week/month schedules and inspect the tasks on each date.
export function CalendarScreen({ tasks }: WorkspaceScreenProps) {
  const [mode, setMode] = useState<CalendarMode>("month");
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()));
  const dated = useMemo(() => tasks.flatMap((task) => { const dueDate = parseTaskDate(task.date); return dueDate ? [{ task, dueDate }] : []; }), [tasks]);
  const month = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const firstDay = month.getDay();
  const days = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0).getDate();
  const weekStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), focusDate.getDate() - focusDate.getDay());
  const weekDates = Array.from({ length: 7 }, (_, index) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index));
  const sameDay = (left: Date, right: Date) => dateKey(left) === dateKey(right);
  const visible = dated.filter(({ dueDate }) => mode === "day" ? sameDay(dueDate, focusDate) : mode === "week" ? dueDate >= weekStart && dueDate < new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7) : dueDate.getFullYear() === focusDate.getFullYear() && dueDate.getMonth() === focusDate.getMonth()).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const move = (amount: number) => setFocusDate((date) => mode === "month" ? new Date(date.getFullYear(), date.getMonth() + amount, 1) : new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount * (mode === "week" ? 7 : 1)));
  const title = mode === "month" ? focusDate.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : mode === "week" ? `${weekDates[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekDates[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : focusDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  return <div className="form-card"><h2>Task calendar</h2><p>Review due dates by day, week, or month. Select a date to focus the schedule.</p><div className="view-toolbar">{(["day", "week", "month"] as const).map((option) => <button key={option} className={mode === option ? "primary-button" : "secondary-button"} onClick={() => setMode(option)}>{option[0].toUpperCase() + option.slice(1)}</button>)}</div><div className="modal-row"><button className="secondary-button" onClick={() => move(-1)}>Previous</button><b>{title}</b><button className="secondary-button" onClick={() => move(1)}>Next</button><button className="secondary-button" onClick={() => setFocusDate(startOfDay(new Date()))}>Today</button></div>
    {mode === "month" ? <div className="metric-grid" style={{ gridTemplateColumns: "repeat(7,minmax(0,1fr))" }}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <b key={day}>{day}</b>)}{Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: days }, (_, index) => { const date = new Date(focusDate.getFullYear(), focusDate.getMonth(), index + 1), key = dateKey(date), count = dated.filter((entry) => sameDay(entry.dueDate, date)).length; return <button key={key} aria-pressed={sameDay(date, focusDate)} className={sameDay(date, focusDate) ? "primary-button" : "secondary-button"} onClick={() => setFocusDate(date)}>{date.getDate()}{count ? ` · ${count}` : ""}</button>; })}</div> : mode === "week" ? <div className="metric-grid" style={{ gridTemplateColumns: "repeat(7,minmax(0,1fr))" }}>{weekDates.map((date) => <button key={dateKey(date)} className={sameDay(date, focusDate) ? "primary-button" : "secondary-button"} onClick={() => setFocusDate(date)}>{date.toLocaleDateString(undefined, { weekday: "short" })}<br/>{date.getDate()}<small> · {dated.filter((entry) => sameDay(entry.dueDate, date)).length}</small></button>)}</div> : null}
    {visible.length ? visible.map(({ task, dueDate }) => <article className="day-task" key={task.id}><span>{dueDate.toLocaleDateString()}</span><b>{task.title}</b><small>{task.project} · {task.state}</small></article>) : <p>{dated.length ? "No tasks are due in this period." : "No tasks have due dates yet."}</p>}</div>;
}

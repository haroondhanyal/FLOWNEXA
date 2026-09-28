"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

export type TaskRecord = { id: string; title: string; project: string; projectId?: string; initials: string; person: string; color: string; date: string; state: string; priority: string };
export type ProjectRecord = { id?: string; name: string; status: string; due: string; lead: string; progress: number };
export type TeamRecord = { id: string; name: string; email: string; role: string; customRoleId?: string | null; teams: string[] };
export type TeamGroupRecord = { id: string; name: string; members: { user: { id: string; name: string; email: string } }[] };
export type WorkUpdateRecord = { task: string; taskId: string; progress: number; note: string; when: string; evidence?: string };
type Organization = { id: string; name: string; workspaces: { id: string; name: string }[] };
type ApiTask = { id: string; title: string; status: string; priority: string; dueAt: string | null; project: { id: string; name: string } | null; assignees: { user: { name: string } }[] };

const displayTaskStatus: Record<string, string> = { BACKLOG: "Backlog", TODO: "To do", IN_PROGRESS: "In progress", BLOCKED: "Blocked", READY_FOR_REVIEW: "In review", CHANGES_REQUESTED: "Changes requested", COMPLETED: "Completed", REOPENED: "Reopened", CANCELLED: "Cancelled" };
const apiTaskStatus: Record<string, string> = { "Backlog": "BACKLOG", "To do": "TODO", "In progress": "IN_PROGRESS", "Blocked": "BLOCKED", "In review": "READY_FOR_REVIEW", "Changes requested": "CHANGES_REQUESTED", "Completed": "COMPLETED", "Reopened": "REOPENED", "Cancelled": "CANCELLED" };

// WORKSPACE DATA HOOK: loads the signed-in organization's shared records and provides simple task actions.
export function useWorkspaceData(query: string, onMessage: (message: string) => void, onTaskCreated: () => void) {
  const [ready, setReady] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const [organizationName, setOrganizationName] = useState("FlowNexa workspace");
  const [workspaceId, setWorkspaceId] = useState("");
  const [currentUser, setCurrentUser] = useState({ name: "", email: "" });
  const [taskRecords, setTaskRecords] = useState<TaskRecord[]>([]);
  const [projectRecords, setProjectRecords] = useState<ProjectRecord[]>([]);
  const [teamRecords, setTeamRecords] = useState<TeamRecord[]>([]);
  const [teamGroups, setTeamGroups] = useState<TeamGroupRecord[]>([]);
  const [workUpdates, setWorkUpdates] = useState<WorkUpdateRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      try {
        const [organizations, user] = await Promise.all([
          apiFetch<Organization[]>("/organizations"),
          apiFetch<{ name: string; email: string }>("/auth/me"),
        ]);
        if (cancelled) return;
        if (!organizations.length) { window.location.replace("/onboarding"); return; }

        const requestedId = sessionStorage.getItem("flownexa-selected-org");
        const organization = organizations.find((item) => item.id === requestedId) ?? organizations[0];
        sessionStorage.removeItem("flownexa-selected-org");
        setOrganizationId(organization.id);
        setOrganizationName(organization.name);
        setWorkspaceId(organization.workspaces[0]?.id ?? "");
        setCurrentUser(user);

        const [projects, tasks, teams, members, updates] = await Promise.all([
          apiFetch<{ id: string; name: string; status: string; targetDate: string | null; creator: { name: string }; _count: { tasks: number } }[]>(`/organizations/${organization.id}/projects`),
          apiFetch<ApiTask[]>(`/organizations/${organization.id}/tasks`),
          apiFetch<TeamGroupRecord[]>(`/organizations/${organization.id}/teams`),
          apiFetch<TeamRecord[]>(`/organizations/${organization.id}/members`),
          apiFetch<{ task: { id: string; title: string }; progress: number; completed: string; submittedAt: string; evidence: { storageKey: string }[] }[]>(`/organizations/${organization.id}/work-updates`),
        ]);
        if (cancelled) return;

        setProjectRecords(projects.map((project) => {
          const related = tasks.filter((task) => task.project?.id === project.id);
          return { id: project.id, name: project.name, status: project.status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()), due: project.targetDate ? new Date(project.targetDate).toLocaleDateString() : "No date", lead: project.creator?.name ?? user.name, progress: related.length ? Math.round(related.filter((task) => task.status === "COMPLETED").length / related.length * 100) : 0 };
        }));
        setTaskRecords(tasks.map((task) => {
          const person = task.assignees[0]?.user.name ?? "Unassigned";
          return { id: task.id, title: task.title, project: task.project?.name ?? "No project", projectId: task.project?.id, initials: person === "Unassigned" ? "--" : person.split(" ").map((part) => part[0]).join("").slice(0, 2), person, color: "lavender", date: task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "No date", state: displayTaskStatus[task.status] ?? task.status, priority: task.priority[0] + task.priority.slice(1).toLowerCase() };
        }));
        setTeamGroups(teams);
        setTeamRecords(members);
        setWorkUpdates(updates.map((update) => ({ task: update.task.title, taskId: update.task.id, progress: update.progress, note: update.completed, when: new Date(update.submittedAt).toLocaleString(), evidence: update.evidence[0]?.storageKey })));
        setReady(true);
      } catch {
        if (!cancelled) window.location.replace("/login");
      }
    }
    void loadWorkspace();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleWorkspaceEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ event: string; taskId?: string; status?: string }>).detail;
      if (!detail?.taskId || !detail.status) return;
      const reviewState: Record<string, string> = { APPROVED: "Completed", CHANGES_REQUESTED: "Changes requested", REJECTED: "Reopened" };
      const state = detail.event === "review.decided" ? reviewState[detail.status] ?? detail.status : displayTaskStatus[detail.status] ?? detail.status;
      setTaskRecords((records) => records.map((task) => task.id === detail.taskId ? { ...task, state } : task));
    };
    window.addEventListener("flownexa:workspace-event", handleWorkspaceEvent);
    return () => window.removeEventListener("flownexa:workspace-event", handleWorkspaceEvent);
  }, []);

  const visibleTasks = useMemo(() => taskRecords.filter((task) => `${task.title} ${task.id} ${task.project}`.toLowerCase().includes(query.toLowerCase())), [taskRecords, query]);
  const createTask = async (form: FormData) => {
    const title = String(form.get("title") ?? "").trim();
    if (!title) return;
    const project = projectRecords.find((item) => item.id === String(form.get("project"))) ?? projectRecords[0];
    if (!project?.id) { onMessage("Create a project before adding tasks"); return; }
    try {
      const saved = await apiFetch<{ id: string; title: string; status: string; priority: string; project: { id: string; name: string }; dueAt: string | null }>(`/organizations/${organizationId}/tasks`, { method: "POST", body: JSON.stringify({ projectId: project.id, title, priority: String(form.get("priority") || "MEDIUM").toUpperCase(), dueAt: form.get("due") ? new Date(`${String(form.get("due"))}T23:59:00`).toISOString() : undefined }) });
      const initials = currentUser.name.split(" ").map((part) => part[0]).join("").slice(0, 2);
      const task: TaskRecord = { id: saved.id, title: saved.title, project: saved.project.name, projectId: saved.project.id, initials, person: "Unassigned", color: "lavender", date: saved.dueAt ? new Date(saved.dueAt).toLocaleDateString() : "No date", state: displayTaskStatus[saved.status] ?? "To do", priority: saved.priority[0] + saved.priority.slice(1).toLowerCase() };
      setTaskRecords((records) => [task, ...records]);
      onTaskCreated();
      onMessage("Task created");
    } catch (cause) { onMessage(cause instanceof Error ? cause.message : "Task could not be created"); }
  };
  const changeTaskStatus = async (task: TaskRecord, status: string) => {
    try {
      await apiFetch(`/organizations/${organizationId}/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: apiTaskStatus[status] }) });
      setTaskRecords((records) => records.map((item) => item.id === task.id ? { ...item, state: status } : item));
    } catch (cause) { onMessage(cause instanceof Error ? cause.message : "Task update failed"); }
  };
  const changeProjectStatus = async (project: ProjectRecord, status: string) => {
    if (!project.id) return;
    try { await apiFetch(`/organizations/${organizationId}/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); const display = status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); setProjectRecords((records) => records.map((item) => item.id === project.id ? { ...item, status: display } : item)); onMessage("Project status updated"); }
    catch (cause) { onMessage(cause instanceof Error ? cause.message : "Project update failed"); }
  };

  return { ready, organizationId, organizationName, workspaceId, currentUser, taskRecords, projectRecords, setProjectRecords, teamRecords, teamGroups, setTeamGroups, workUpdates, visibleTasks, createTask, changeTaskStatus, changeProjectStatus };
}

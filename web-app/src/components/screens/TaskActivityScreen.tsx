"use client";
/* eslint-disable @next/next/no-img-element -- Evidence thumbnails use short-lived authenticated blob URLs. */

import { useCallback, useEffect, useState } from "react";
import { apiBlob, apiFetch } from "@/lib/api";
import type { WorkspaceScreenProps } from "./types";

type Comment = { id: string; body: string; createdAt: string; parentId?: string | null; author: { name: string }; replies?: Comment[] };
type Update = { id: string; progress: number; completed: string; nextAction?: string; blocker?: string; submittedAt: string; evidence: { id: string; fileName: string; storageKey: string; mimeType: string; sizeBytes: string }[] };
type Evidence = { id: string; fileName: string; storageKey: string; mimeType: string; sizeBytes: string; createdAt: string; uploader: { name: string } };
type TimeEntry = { id: string; taskId: string; startedAt: string; endedAt?: string | null; durationMinutes?: number | null; note?: string; user: { name: string }; task?: { id: string; title: string } };
// TASK ACTIVITY: progress, evidence, discussion, timers and review requests for one task.
// This screen uses separate API records so other engineers can build each area independently.
export function TaskActivityScreen({ organizationId, tasks, onMessage }: WorkspaceScreenProps) {
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [comments, setComments] = useState<Comment[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [times, setTimes] = useState<TimeEntry[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [replyTo, setReplyTo] = useState<string>();
  const base = `/organizations/${organizationId}/tasks/${taskId}`;
  const refresh = useCallback(async () => {
    if (!taskId) return;
    const [c, u, t, r, e] = await Promise.allSettled([apiFetch<Comment[]>(`${base}/comments`), apiFetch<Update[]>(`${base}/work-updates`), apiFetch<TimeEntry[]>(`${base}/time-entries`), apiFetch<TimeEntry | null>(`/organizations/${organizationId}/time-entries/running`), apiFetch<Evidence[]>(`${base}/evidence`)]);
    setComments(c.status === "fulfilled" ? c.value : []); setUpdates(u.status === "fulfilled" ? u.value : []); setTimes(t.status === "fulfilled" ? t.value : []); setRunning(r.status === "fulfilled" ? r.value : null); setEvidence(e.status === "fulfilled" ? e.value : []);
  }, [base, organizationId, taskId]);
  useEffect(() => { void refresh(); const listener = (event: Event) => { if ((event as CustomEvent<{taskId?: string}>).detail?.taskId === taskId) void refresh(); }; window.addEventListener("flownexa:workspace-event", listener); return () => window.removeEventListener("flownexa:workspace-event", listener); }, [refresh, taskId]);
  // IMAGE EVIDENCE PREVIEWS: download private image files with auth and release each temporary URL on task change.
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    void Promise.all(evidence.filter((item) => item.mimeType.startsWith("image/") && !/^https?:\/\//i.test(item.storageKey)).map(async (item) => {
      try { const url = URL.createObjectURL(await apiBlob(`${base}/evidence/${item.id}/download`)); urls.push(url); return [item.id, url] as const; } catch { return null; }
    })).then((items) => { if (!cancelled) setImagePreviews(Object.fromEntries(items.filter((item): item is readonly [string, string] => Boolean(item)))); });
    return () => { cancelled = true; urls.forEach(URL.revokeObjectURL); setImagePreviews({}); };
  }, [base, evidence]);
  const submit = async (form: FormData, kind: "update" | "comment" | "time" | "review") => {
    try {
      if (kind === "update") { const evidence = String(form.get("evidence") ?? "").trim(); await apiFetch(`${base}/work-updates`, { method: "POST", body: JSON.stringify({ progress: Number(form.get("progress")), completed: String(form.get("completed") ?? ""), nextAction: String(form.get("nextAction") ?? ""), blocker: String(form.get("blocker") ?? ""), evidenceUrls: evidence ? [evidence] : [] }) }); }
      if (kind === "comment") { await apiFetch(`${base}/comments`, { method: "POST", body: JSON.stringify({ body: String(form.get("comment") ?? ""), ...(replyTo ? { parentId: replyTo } : {}) }) }); setReplyTo(undefined); }
      if (kind === "time") { const endedAt = new Date(); const durationMinutes = Number(form.get("minutes")); await apiFetch(`${base}/time-entries`, { method: "POST", body: JSON.stringify({ startedAt: new Date(endedAt.getTime() - durationMinutes * 60000).toISOString(), endedAt: endedAt.toISOString(), durationMinutes, note: String(form.get("note") ?? "") }) }); }
      if (kind === "review") await apiFetch(`${base}/reviews`, { method: "POST" });
      await refresh(); onMessage(kind === "review" ? "Sent for review" : kind === "time" ? "Time saved" : kind === "update" ? "Work update submitted" : "Comment posted");
    } catch (error) { onMessage(error instanceof Error ? error.message : "Could not save task activity"); }
  };
  const uploadEvidence = async (form: FormData) => {
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) { onMessage("Choose a file to upload"); return; }
    const body = new FormData(); body.append("file", file);
    try { await apiFetch(`${base}/evidence`, { method: "POST", body }); await refresh(); onMessage("Private evidence uploaded"); }
    catch (error) { onMessage(error instanceof Error ? error.message : "Evidence upload failed"); }
  };
  const downloadEvidence = async (evidence: Update["evidence"][number]) => {
    if (/^https?:\/\//i.test(evidence.storageKey)) { window.open(evidence.storageKey, "_blank", "noopener,noreferrer"); return; }
    try { const blob = await apiBlob(`${base}/evidence/${evidence.id}/download`); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = evidence.fileName; anchor.click(); URL.revokeObjectURL(url); }
    catch (error) { onMessage(error instanceof Error ? error.message : "Evidence download failed"); }
  };
  const startTimer = async () => { try { await apiFetch(`${base}/time-entries`, { method: "POST", body: JSON.stringify({ startedAt: new Date().toISOString(), note: "Running timer" }) }); await refresh(); } catch (error) { onMessage(error instanceof Error ? error.message : "Could not start timer"); } };
  const stopTimer = async (entry: TimeEntry) => { try { await apiFetch(`/organizations/${organizationId}/tasks/${entry.taskId}/time-entries/${entry.id}/stop`, { method: "PATCH" }); await refresh(); onMessage("Timer stopped and time saved"); } catch (error) { onMessage(error instanceof Error ? error.message : "Could not stop timer"); } };
  const commentCard = (comment: Comment, nested = false) => <div className="day-task" key={comment.id} style={nested ? { marginLeft: 24 } : undefined}><b>{comment.author.name}</b><span>{comment.body}</span><small>{new Date(comment.createdAt).toLocaleString()}</small>{!nested && <button className="secondary-button" onClick={() => setReplyTo(comment.id)}>Reply</button>}{comment.replies?.map((reply) => commentCard(reply, true))}</div>;
  return <div className="form-card"><h2>Task activity</h2><p>Progress updates, evidence, discussion, time tracking, and review requests for one task.</p><label className="field-label">Task<select value={taskId} onChange={(event) => setTaskId(event.target.value)}>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>{taskId ? <><form action={(form) => void submit(form, "update")}><div className="modal-row"><label className="field-label">Progress %<input name="progress" type="number" min="0" max="100" defaultValue="0" required /></label><label className="field-label">Evidence URL<input name="evidence" type="url" placeholder="https://… (optional)" /></label></div><label className="field-label">Work completed<textarea name="completed" required rows={2} /></label><div className="modal-row"><label className="field-label">Next action<input name="nextAction" /></label><label className="field-label">Blocker<input name="blocker" /></label></div><button className="primary-button">Submit update</button></form><form className="day-task" action={(form) => void uploadEvidence(form)}><b>Private file evidence</b><label className="field-label">File (PNG, JPEG, PDF, or text; up to 10 MB)<input name="file" type="file" accept="image/png,image/jpeg,application/pdf,text/plain" required /></label><button className="secondary-button">Upload evidence</button></form><section><h3>Task evidence</h3>{evidence.length ? evidence.map((item) => <div className="day-task" key={item.id}><b>{item.fileName}</b>{imagePreviews[item.id] && <img className="evidence-thumbnail" src={imagePreviews[item.id]} alt={item.fileName}/>}<span>{item.mimeType} · {Math.ceil(Number(item.sizeBytes) / 1024)} KB</span><small>Added by {item.uploader.name} · {new Date(item.createdAt).toLocaleString()}</small><button className="secondary-button" onClick={() => void downloadEvidence(item)}>Download private file</button></div>) : <p>No files uploaded.</p>}</section>{updates.map((u) => <div className="day-task" key={u.id}><b>{u.progress}% complete</b><span>{u.completed}</span>{u.nextAction && <small>Next: {u.nextAction}</small>}{u.blocker && <small>Blocker: {u.blocker}</small>}<small>{new Date(u.submittedAt).toLocaleString()}</small>{u.evidence.map((item) => <button className="secondary-button" key={item.id} onClick={() => void downloadEvidence(item)}>{/^https?:\/\//i.test(item.storageKey) ? "Open link" : "Download file"}: {item.fileName} · {Math.ceil(Number(item.sizeBytes) / 1024)} KB</button>)}</div>)}<form action={(form) => void submit(form, "comment")}><label className="field-label">{replyTo ? "Reply to comment" : "Comment"}<textarea name="comment" required rows={2} placeholder="Add a comment" /></label>{replyTo && <button type="button" className="secondary-button" onClick={() => setReplyTo(undefined)}>Cancel reply</button>}<button className="secondary-button">Post comment</button></form>{comments.filter((comment) => !comment.parentId).map((comment) => commentCard(comment))}<h3>Time tracking</h3>{running ? <div className="day-task"><b>Running on {running.task?.title ?? "another task"}</b><span>{running.note}</span><button className="secondary-button" onClick={() => void stopTimer(running)}>Stop timer</button></div> : <button className="secondary-button" onClick={() => void startTimer()}>Start timer for this task</button>}{times.filter((entry) => entry.endedAt).map((entry) => <div className="day-task" key={entry.id}><b>{entry.durationMinutes} min · {entry.user.name}</b><span>{entry.note}</span><small>{new Date(entry.startedAt).toLocaleString()}</small></div>)}<form className="modal-row" action={(form) => void submit(form, "time")}><label className="field-label">Manual minutes<input name="minutes" type="number" min="1" max="1440" required /></label><label className="field-label">Note<input name="note" placeholder="What was the time spent on?" /></label><button className="secondary-button">Save time</button></form><form action={(form) => void submit(form, "review")}><button className="primary-button">Submit task for review</button></form></> : <p>Create a task first to add activity.</p>}</div>;
}

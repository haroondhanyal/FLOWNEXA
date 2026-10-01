import { useCallback, useRef, useState } from "react";
import { Button, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import { API_URL, api, ApiError, Organization, Task, tokenStore } from "../../lib/api";

const DRAFT_KEY = "flownexa.work-update-drafts";
const CAMERA_DRAFT_KEY = "flownexa.local-evidence-drafts";
type Draft = { taskId: string; completed: string; progress: number; evidenceUrl: string; imageUri?: string; updateSubmitted?: boolean };
type Project = { id: string; name: string };
type LocalEvidence = { id: string; taskId: string; imageUri: string; note: string; capturedAt: string };

// This first mobile create flow drafts work updates offline and retries them later.
export default function CreateScreen() {
  const [organization, setOrganization] = useState<Organization>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [mode, setMode] = useState<"update" | "task">("update");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [completed, setCompleted] = useState("");
  const [progress, setProgress] = useState("0");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [comment, setComment] = useState("");
  const [minutes, setMinutes] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [localEvidence, setLocalEvidence] = useState<LocalEvidence[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [permission, askPermission] = useCameraPermissions();
  const [message, setMessage] = useState("");
  const cameraRef = useRef<CameraView>(null);
  const load = async () => { const orgs = await api<Organization[]>("/organizations"); const selected = orgs[0]; setOrganization(selected); const user = await api<{ id: string }>("/auth/me"); setCurrentUserId(user.id); setLocalEvidence(JSON.parse(await AsyncStorage.getItem(CAMERA_DRAFT_KEY) ?? "[]") as LocalEvidence[]); if (selected) { const [items, workspaceProjects] = await Promise.all([api<Task[]>(`/organizations/${selected.id}/tasks?mine=true`), api<Project[]>(`/organizations/${selected.id}/projects`)]); setTasks(items); setTaskId(items[0]?.id ?? ""); setProjects(workspaceProjects); setProjectId(workspaceProjects[0]?.id ?? ""); } };
  useFocusEffect(useCallback(() => { void load().catch((error) => setMessage(error.message)); }, []));
  const saveDraft = async () => {
    const draft: Draft = { taskId, completed, progress: Number(progress), evidenceUrl, imageUri: imageUri || undefined };
    const existing = JSON.parse(await AsyncStorage.getItem(DRAFT_KEY) ?? "[]") as Draft[];
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify([...existing, draft]));
    setMessage("Saved offline draft. Use Sync drafts when you're online.");
  };
  const submit = async () => {
    if (!organization || !taskId || !completed.trim()) return;
    try {
      await api(`/organizations/${organization.id}/tasks/${taskId}/work-updates`, { method: "POST", body: JSON.stringify({ progress: Number(progress), completed, evidenceUrls: evidenceUrl ? [evidenceUrl] : [] }) });
      if (imageUri) {
        try { await uploadEvidence(taskId, imageUri); await FileSystem.deleteAsync(imageUri, { idempotent: true }); setImageUri(""); setMessage("Work update and photo submitted."); }
        catch { await retainPhoto(); setImageUri(""); setMessage("Update submitted. Photo remains saved on this device because upload failed."); }
      }
      setCompleted(""); setEvidenceUrl(""); if (!imageUri) setMessage("Work update submitted.");
    } catch (cause) {
      // Only network failures become drafts; server validation errors stay visible.
      if (cause instanceof TypeError) await saveDraft();
      else setMessage(cause instanceof ApiError ? cause.message : "Update could not be saved.");
    }
  };
  const postComment = async () => {
    if (!organization || !taskId || !comment.trim()) return;
    try { await api(`/organizations/${organization.id}/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) }); setComment(""); setMessage("Comment posted."); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Comment could not be posted."); }
  };
  const saveTime = async () => {
    if (!organization || !taskId || Number(minutes) < 1) return;
    try { await api(`/organizations/${organization.id}/tasks/${taskId}/time-entries`, { method: "POST", body: JSON.stringify({ startedAt: new Date().toISOString(), durationMinutes: Number(minutes), note: "Mobile time entry" }) }); setMinutes(""); setMessage("Time entry saved."); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Time entry could not be saved."); }
  };
  const createTask = async () => {
    if (!organization || !projectId || !newTaskTitle.trim()) return;
    try { await api(`/organizations/${organization.id}/tasks`, { method: "POST", body: JSON.stringify({ projectId, title: newTaskTitle.trim(), assigneeIds: [currentUserId] }) }); setNewTaskTitle(""); setMessage("Task created and assigned to you."); await load(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Task could not be created."); }
  };
  const retainPhoto = async () => {
    const item: LocalEvidence = { id: `${Date.now()}`, taskId, imageUri, note: completed, capturedAt: new Date().toISOString() };
    const next = [...localEvidence, item];
    await AsyncStorage.setItem(CAMERA_DRAFT_KEY, JSON.stringify(next)); setLocalEvidence(next);
  };
  const uploadEvidence = async (selectedTaskId: string, uri: string) => {
    const token = await tokenStore.get();
    const result = await FileSystem.uploadAsync(`${API_URL}/organizations/${organization?.id}/tasks/${selectedTaskId}/evidence`, uri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType: "image/jpeg",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (result.status < 200 || result.status >= 300) {
      const payload = JSON.parse(result.body || "{}") as { message?: string };
      throw new Error(payload.message ?? `Evidence upload failed (${result.status})`);
    }
  };
  const discardPhoto = async (item: LocalEvidence) => {
    await FileSystem.deleteAsync(item.imageUri, { idempotent: true });
    const next = localEvidence.filter((photo) => photo.id !== item.id);
    await AsyncStorage.setItem(CAMERA_DRAFT_KEY, JSON.stringify(next)); setLocalEvidence(next);
  };
  const syncDrafts = async () => {
    if (!organization) return;
    const drafts = JSON.parse(await AsyncStorage.getItem(DRAFT_KEY) ?? "[]") as Draft[];
    const pending: Draft[] = [];
    for (const draft of drafts) {
      let updateSubmitted = draft.updateSubmitted ?? false;
      if (!updateSubmitted) {
        try { await api(`/organizations/${organization.id}/tasks/${draft.taskId}/work-updates`, { method: "POST", body: JSON.stringify({ progress: draft.progress, completed: draft.completed, evidenceUrls: draft.evidenceUrl ? [draft.evidenceUrl] : [] }) }); updateSubmitted = true; }
        catch { pending.push(draft); continue; }
      }
      if (draft.imageUri) {
        try { await uploadEvidence(draft.taskId, draft.imageUri); await FileSystem.deleteAsync(draft.imageUri, { idempotent: true }); }
        catch { pending.push({ ...draft, updateSubmitted: true }); }
      }
    }
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(pending)); setMessage(`${drafts.length - pending.length} draft(s) synced; ${pending.length} still pending.`);
  };
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}><Text style={styles.heading}>Quick create</Text><View style={styles.modeRow}><Pressable onPress={() => setMode("update")} style={[styles.mode, mode === "update" && styles.selected]}><Text>Work update</Text></Pressable><Pressable onPress={() => setMode("task")} style={[styles.mode, mode === "task" && styles.selected]}><Text>Task</Text></Pressable></View>{mode === "task" ? <><Text style={styles.label}>Project</Text><View style={styles.taskChoices}>{projects.map((project) => <Text key={project.id} onPress={() => setProjectId(project.id)} style={[styles.choice, projectId === project.id && styles.selected]}>{project.name}</Text>)}</View><TextInput value={newTaskTitle} onChangeText={setNewTaskTitle} placeholder="Task title" style={styles.input}/><Button title="Create task" onPress={() => void createTask()} disabled={!projectId || !newTaskTitle.trim()}/></> : <><Text style={styles.label}>Task (first 10 assigned)</Text><View style={styles.taskChoices}>{tasks.slice(0, 10).map((task) => <Text key={task.id} onPress={() => setTaskId(task.id)} style={[styles.choice, taskId === task.id && styles.selected]}>{task.title}</Text>)}</View><Text style={styles.label}>Progress percentage</Text><TextInput keyboardType="number-pad" value={progress} onChangeText={setProgress} style={styles.input}/><Text style={styles.label}>Work completed</Text><TextInput multiline value={completed} onChangeText={setCompleted} placeholder="What did you finish?" style={[styles.input, styles.multiline]}/><Text style={styles.label}>Evidence link (optional)</Text><TextInput autoCapitalize="none" value={evidenceUrl} onChangeText={setEvidenceUrl} placeholder="https://" style={styles.input}/>{cameraOpen ? <><CameraView style={styles.camera} facing="back" ref={(ref) => { cameraRef.current = ref; }}/><Button title="Capture photo" onPress={() => void capturePhoto()}/></> : <Button title={imageUri ? "Photo captured on device" : "Capture evidence photo"} onPress={() => void openCamera()}/>}<View style={styles.button}><Button title="Submit work update" onPress={() => void submit()} disabled={!taskId || !completed.trim()}/></View><Button title="Save offline draft" onPress={() => void saveDraft()} disabled={!taskId || !completed.trim()}/><Button title="Sync drafts" onPress={() => void syncDrafts()}/><Text style={styles.section}>Comment</Text><TextInput value={comment} onChangeText={setComment} placeholder="Add a task comment" style={styles.input}/><Button title="Post comment" onPress={() => void postComment()} disabled={!taskId || !comment.trim()}/><Text style={styles.section}>Manual time</Text><TextInput keyboardType="number-pad" value={minutes} onChangeText={setMinutes} placeholder="Minutes" style={styles.input}/><Button title="Save time entry" onPress={() => void saveTime()} disabled={!taskId || Number(minutes) < 1}/></>}{localEvidence.length ? <><Text style={styles.section}>Local photos waiting for upload</Text>{localEvidence.map((photo) => <View style={styles.photoRow} key={photo.id}><Image source={{ uri: photo.imageUri }} style={styles.thumbnail}/><View style={styles.photoText}><Text>{photo.note}</Text><Text style={styles.muted}>{new Date(photo.capturedAt).toLocaleString()}</Text><Button title="Discard local photo" color="#a43838" onPress={() => void discardPhoto(photo)}/></View></View>)}</> : null}{message ? <Text style={styles.message}>{message}</Text> : null}</ScrollView>;
  async function openCamera() { if (!permission?.granted) { const result = await askPermission(); if (!result.granted) { setMessage("Camera permission is needed to capture evidence."); return; } } setCameraOpen(true); }
  async function capturePhoto() { if (!cameraRef.current) return; const photo = await cameraRef.current.takePictureAsync(); if (photo?.uri) { const savedUri = `${FileSystem.documentDirectory}evidence-${Date.now()}.jpg`; await FileSystem.copyAsync({ from: photo.uri, to: savedUri }); setImageUri(savedUri); setCameraOpen(false); } }
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#f7f6fb" }, content: { padding: 20, gap: 10 }, heading: { fontSize: 24, fontWeight: "700", color: "#242138", marginBottom: 8 }, section: { fontSize: 18, fontWeight: "700", color: "#242138", marginTop: 16 }, label: { fontWeight: "600", color: "#4f4c5f", marginTop: 6 }, input: { backgroundColor: "white", padding: 13, borderWidth: 1, borderColor: "#e4e1ed", borderRadius: 11 }, multiline: { minHeight: 90, textAlignVertical: "top" }, taskChoices: { gap: 6 }, choice: { color: "#4f4c5f", padding: 9, backgroundColor: "white", borderRadius: 8 }, selected: { backgroundColor: "#e9e5fb", color: "#5949a8" }, modeRow: { flexDirection: "row", gap: 10 }, mode: { flex: 1, padding: 11, backgroundColor: "white", borderRadius: 9, alignItems: "center" }, camera: { height: 300, borderRadius: 14, overflow: "hidden" }, button: { marginTop: 8 }, message: { color: "#5f508f", marginTop: 8 }, photoRow: { flexDirection: "row", gap: 10, backgroundColor: "white", borderRadius: 11, padding: 10 }, thumbnail: { width: 78, height: 78, borderRadius: 8 }, photoText: { flex: 1, justifyContent: "center", gap: 4 }, muted: { color: "#777486", fontSize: 12 } });

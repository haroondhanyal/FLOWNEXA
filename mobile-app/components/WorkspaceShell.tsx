import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import { API_URL, api, Organization, Task, tokenStore, UserProfile, Workspace } from "../lib/api";

type ScreenName = "Overview" | "My work" | "My day" | "Board" | "Calendar" | "Inbox" | "Search" | "Projects" | "Teams" | "Invite member" | "Roles & access" | "Reviews" | "Audit history" | "Reports" | "AI assistant" | "Notes" | "Work updates" | "Profile & account" | "Help & support";
type Project = { id: string; name: string; status: string; targetDate?: string | null; workspaceId: string; creator?: { name: string }; _count?: { tasks: number } };
type Member = { id: string; name: string; email: string; role: string; customRoleId?: string | null; teams: string[] };
type Team = { id: string; name: string; workspaceId?: string; members?: { user: { id: string; name: string; email: string } }[]; _count?: { projects: number } };
type Row = Record<string, unknown>;
type NavGroup = { label: string; items: { name: ScreenName; icon: string }[] };

const NAV: NavGroup[] = [
  { label: "WORKSPACE", items: [{ name: "Overview", icon: "⌂" }, { name: "My work", icon: "✓" }, { name: "My day", icon: "☀" }, { name: "Board", icon: "▦" }, { name: "Calendar", icon: "▣" }, { name: "Inbox", icon: "◇" }, { name: "Search", icon: "⌕" }] },
  { label: "MANAGE", items: [{ name: "Projects", icon: "▤" }, { name: "Teams", icon: "♙" }, { name: "Invite member", icon: "+" }, { name: "Roles & access", icon: "⊙" }, { name: "Reviews", icon: "◉" }, { name: "Audit history", icon: "↻" }, { name: "Reports", icon: "▥" }, { name: "AI assistant", icon: "✦" }] },
  { label: "PERSONAL", items: [{ name: "Notes", icon: "▧" }, { name: "Work updates", icon: "↗" }, { name: "Profile & account", icon: "◎" }, { name: "Help & support", icon: "?" }] },
];
const TASK_STATES = ["BACKLOG", "TODO", "IN_PROGRESS", "BLOCKED", "READY_FOR_REVIEW", "CHANGES_REQUESTED", "COMPLETED", "REOPENED", "CANCELLED"];
const ACCENTS = [{ id: "violet", label: "Violet", color: "#7664c8" }, { id: "blue", label: "Blue", color: "#3781c5" }, { id: "green", label: "Green", color: "#388b70" }, { id: "rose", label: "Rose", color: "#cc6682" }, { id: "amber", label: "Amber", color: "#c58b36" }];
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const number = (value: unknown) => { const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0; return Number.isFinite(parsed) ? parsed : 0; };

export default function WorkspaceShell() {
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState<ScreenName>("Overview");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organization, setOrganization] = useState<Organization>();
  const [workspace, setWorkspace] = useState<Workspace>();
  const [user, setUser] = useState<UserProfile>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [invitations, setInvitations] = useState<Row[]>([]);
  const [inviteToken, setInviteToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task>();
  const [detail, setDetail] = useState<{ updates: Row[]; comments: Row[]; timeEntries: Row[]; evidence: Row[] }>({ updates: [], comments: [], timeEntries: [], evidence: [] });
  const [reviews, setReviews] = useState<Row[]>([]);
  const [audit, setAudit] = useState<Row[]>([]);
  const [report, setReport] = useState<Row>();
  const [notifications, setNotifications] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Row[]>([]);
  const [editingNoteId, setEditingNoteId] = useState("");
  const [searchResult, setSearchResult] = useState<Row>();
  const [roles, setRoles] = useState<{ catalog: { key: string; description: string }[]; roles: { id: string; name: string; permissions: string[]; memberCount: number }[] }>({ catalog: [], roles: [] });
  const [aiAnswer, setAiAnswer] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"avatar" | "logo">("avatar");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const loadSequence = useRef(0);
  const [avatarUri, setAvatarUri] = useState("");
  const [logoUri, setLogoUri] = useState("");
  const [theme, setTheme] = useState<"light" | "dark" | "warm">("light");
  const [accentId, setAccentId] = useState("violet");
  const organizationId = organization?.id ?? "";
  const workspaceId = workspace?.id ?? "";
  const setValue = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const notify = (value: string) => { setMessage(value); setTimeout(() => setMessage(""), 3500); };

  useEffect(() => { void AsyncStorage.multiGet(["flownexa.mobile.theme", "flownexa.mobile.accent"]).then(([[, savedTheme], [, savedAccent]]) => { if (savedTheme === "dark" || savedTheme === "warm" || savedTheme === "light") setTheme(savedTheme); if (ACCENTS.some(({ id }) => id === savedAccent)) setAccentId(savedAccent!); }); }, []);

  const load = useCallback(async (orgId?: string, spaceId?: string) => {
    const requestId = ++loadSequence.current;
    setError("");
    const [orgList, profile] = await Promise.all([api<Organization[]>("/organizations"), api<UserProfile>("/auth/me")]);
    if (requestId !== loadSequence.current) return;
    if (!orgList.length) { setOrganizations([]); setUser(profile); setReady(true); setActive("Overview"); return; }
    const requestedOrg = orgId ?? await AsyncStorage.getItem("flownexa.mobile.org");
    const selectedOrg = orgList.find((item) => item.id === requestedOrg) ?? orgList[0];
    const requestedSpace = spaceId ?? await AsyncStorage.getItem("flownexa.mobile.workspace");
    const selectedSpace = selectedOrg.workspaces.find((item) => item.id === requestedSpace) ?? selectedOrg.workspaces[0];
    setOrganizations(orgList); setOrganization(selectedOrg); setWorkspace(selectedSpace); setUser({ ...profile, role: selectedOrg.role, organizationName: selectedOrg.name });
    if (!selectedSpace) { setTasks([]); setMyTasks([]); setProjects([]); setMembers([]); setTeams([]); setReady(true); return; }
    const [allTasks, personalTasks, allProjects, allMembers, allTeams] = await Promise.all([
      api<Task[]>(`/organizations/${selectedOrg.id}/tasks`),
      api<Task[]>(`/organizations/${selectedOrg.id}/tasks?mine=true`).catch(() => []),
      api<Project[]>(`/organizations/${selectedOrg.id}/projects`),
      api<Member[]>(`/organizations/${selectedOrg.id}/members`).catch(() => []),
      api<Team[]>(`/organizations/${selectedOrg.id}/teams`).catch(() => []),
    ]);
    if (requestId !== loadSequence.current) return;
    setProjects(allProjects.filter((item) => item.workspaceId === selectedSpace.id));
    setTasks(allTasks.filter((item) => !item.project?.workspaceId || item.project.workspaceId === selectedSpace.id));
    setMyTasks(personalTasks.filter((item) => !item.project?.workspaceId || item.project.workspaceId === selectedSpace.id));
    setMembers(allMembers); setTeams(allTeams.filter((item) => !item.workspaceId || item.workspaceId === selectedSpace.id)); setReady(true);
  }, []);

  useEffect(() => {
    let activeRequest = true;
    void load().catch((cause) => { if (activeRequest) { setError(cause instanceof Error ? cause.message : "Could not connect to FlowNexa"); setReady(true); } });
    return () => { activeRequest = false; };
  }, [load]);

  const openScreen = async (name: ScreenName) => {
    setActive(name); setDrawerOpen(false); setSelectedTask(undefined); setForm({}); setError(""); setMessage("");
    if (name === "Profile & account") setForm({ profileName: user?.name ?? "", profilePhone: user?.phoneNumber ?? "" });
    if (!organizationId) return;
    const scoped = `?workspaceId=${encodeURIComponent(workspaceId)}`;
    try {
      if (name === "Inbox") setNotifications(await api<Row[]>(`/organizations/${organizationId}/notifications`));
      if (name === "Invite member") setInvitations(await api<Row[]>(`/organizations/${organizationId}/invitations`));
      if (name === "Reviews") setReviews(await api<Row[]>(`/organizations/${organizationId}/reviews${scoped}`));
      if (name === "Audit history") setAudit(await api<Row[]>(`/organizations/${organizationId}/audit-history${scoped}`));
      if (name === "Reports") setReport(await api<Row>(`/organizations/${organizationId}/reports/summary${scoped}`));
      if (name === "Notes") setNotes(await api<Row[]>(`/organizations/${organizationId}/workspaces/${workspaceId}/notes`));
      if (name === "Roles & access") setRoles(await api<typeof roles>(`/organizations/${organizationId}/roles`));
      if (name === "Work updates") setAudit(await api<Row[]>(`/organizations/${organizationId}/work-updates`));
    } catch (cause) { setError(cause instanceof Error ? cause.message : `${name} could not be loaded`); }
  };

  const updateTask = async (task: Task, patch: Row) => {
    if (!organizationId) return;
    try {
      const saved = await api<Task>(`/organizations/${organizationId}/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...saved } : item));
      setSelectedTask((current) => current?.id === task.id ? { ...current, ...saved } : current);
      notify("Task updated");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Task could not be updated"); }
  };

  const openTask = async (task: Task) => {
    setSelectedTask(task); setForm({});
    try {
      const [updates, comments, timeEntries] = await Promise.all([
        api<Row[]>(`/organizations/${organizationId}/tasks/${task.id}/work-updates`),
        api<Row[]>(`/organizations/${organizationId}/tasks/${task.id}/comments`),
        api<Row[]>(`/organizations/${organizationId}/tasks/${task.id}/time-entries`),
      ]);
      const evidence = await api<Row[]>(`/organizations/${organizationId}/tasks/${task.id}/evidence`);
      setDetail({ updates, comments, timeEntries, evidence });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Task details could not be loaded"); }
  };

  const submitTaskCreate = async (taskTitle = form.title) => {
    const projectId = form.projectId || projects[0]?.id;
    if (!organizationId || !projectId || !taskTitle?.trim()) { setError("Choose a project and enter a task name."); return; }
    setBusy(true);
    try {
      await api(`/organizations/${organizationId}/tasks`, { method: "POST", body: JSON.stringify({ projectId, title: taskTitle.trim(), description: form.description || undefined, priority: (form.priority || "MEDIUM").toUpperCase(), dueAt: form.dueAt ? new Date(`${form.dueAt}T23:59:00`).toISOString() : undefined }) });
      await load(organizationId, workspaceId); notify("Task created"); setForm({});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Task could not be created"); }
    finally { setBusy(false); }
  };

  const createProject = async () => {
    if (!form.name?.trim()) return;
    setBusy(true);
    try { await api(`/organizations/${organizationId}/projects`, { method: "POST", body: JSON.stringify({ organizationId, workspaceId, name: form.name.trim(), description: form.description || undefined, status: "PLANNING", targetDate: form.targetDate ? new Date(`${form.targetDate}T23:59:00`).toISOString() : undefined }) }); await load(organizationId, workspaceId); setForm({}); notify("Project created"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Project could not be created"); } finally { setBusy(false); }
  };

  const changeProjectStatus = async (project: Project, status: string) => {
    try {
      await api(`/organizations/${organizationId}/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, status } : item)); notify("Project status updated");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Project status could not be updated"); }
  };

  const sendInvite = async () => {
    try { const result = await api<Row>(`/organizations/${organizationId}/invitations`, { method: "POST", body: JSON.stringify({ email: form.email, role: form.role || "MEMBER" }) }); setInviteToken(text(result.inviteToken)); setInvitations((current) => [result, ...current]); notify("Invitation created. Share its one-time token through your approved channel."); setForm({}); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Invitation could not be sent"); }
  };

  const createNote = async () => {
    if (!form.title?.trim()) return;
    try {
      const path = `/organizations/${organizationId}/workspaces/${workspaceId}/notes`;
      const saved = await api<Row>(editingNoteId ? `${path}/${editingNoteId}` : path, { method: editingNoteId ? "PUT" : "POST", body: JSON.stringify({ title: form.title.trim(), content: form.content || "" }) });
      setNotes((current) => editingNoteId ? current.map((note) => note.id === editingNoteId ? saved : note) : [saved, ...current]);
      setForm({}); setEditingNoteId(""); notify(editingNoteId ? "Note updated" : "Note saved");
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Note could not be saved"); }
  };

  const createTeam = async () => {
    if (!form.name?.trim()) return;
    try { await api(`/organizations/${organizationId}/teams`, { method: "POST", body: JSON.stringify({ workspaceId, name: form.name.trim() }) }); setTeams(await api<Team[]>(`/organizations/${organizationId}/teams`)); setForm({}); notify("Team created"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Team could not be created"); }
  };

  const assignRole = async (member: Member, roleId: string | null) => {
    try {
      await api(`/organizations/${organizationId}/members/${member.id}/role`, { method: "PATCH", body: JSON.stringify({ roleId }) });
      setMembers((current) => current.map((item) => item.id === member.id ? { ...item, customRoleId: roleId } : item)); notify(`Access updated for ${member.name}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Role could not be assigned"); }
  };

  const addTeamMember = async (team: Team, memberId: string) => {
    try { await api(`/organizations/${organizationId}/teams/${team.id}/members`, { method: "POST", body: JSON.stringify({ userId: memberId }) }); setTeams(await api<Team[]>(`/organizations/${organizationId}/teams`)); notify("Team member added"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Member could not be added to team"); }
  };

  const removeTeamMember = async (team: Team, memberId: string) => {
    try { await api(`/organizations/${organizationId}/teams/${team.id}/members/${memberId}`, { method: "DELETE" }); setTeams(await api<Team[]>(`/organizations/${organizationId}/teams`)); notify("Team member removed"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Member could not be removed"); }
  };

  const bootstrapWorkspace = async () => {
    if (!form.orgName?.trim() || !form.spaceName?.trim()) { setError("Enter your organization and workspace names."); return; }
    setBusy(true);
    try {
      await api("/organizations/bootstrap", { method: "POST", body: JSON.stringify({ name: form.orgName.trim(), workspaceName: form.spaceName.trim(), teamName: form.teamName?.trim() || "Core team", projectName: form.projectName?.trim() || "Getting started", firstTask: "Plan the first milestone" }) });
      setForm({}); await load(); notify("Workspace is ready");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Workspace could not be created"); }
    finally { setBusy(false); }
  };

  const createWorkspace = async () => {
    if (!form.newWorkspace?.trim()) return;
    try {
      const created = await api<Workspace>(`/organizations/${organizationId}/workspaces`, { method: "POST", body: JSON.stringify({ name: form.newWorkspace.trim() }) });
      await AsyncStorage.multiSet([["flownexa.mobile.org", organizationId], ["flownexa.mobile.workspace", created.id]]);
      setValue("showSpaces", "false"); setForm({}); await load(organizationId, created.id); notify("Workspace created");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Workspace could not be created"); }
  };

  const renameWorkspace = async () => {
    if (!form.workspaceRename?.trim() || !workspace) return;
    try {
      const body = new FormData(); body.append("name", form.workspaceRename.trim());
      const saved = await api<Workspace>(`/organizations/${organizationId}/workspaces/${workspace.id}`, { method: "PATCH", body });
      setWorkspace(saved); setOrganizations((current) => current.map((org) => org.id === organizationId ? { ...org, workspaces: org.workspaces.map((space) => space.id === saved.id ? saved : space) } : org));
      notify("Workspace updated");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Workspace could not be updated"); }
  };

  const captureProfileOrLogo = async (target: "avatar" | "logo") => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) { setError("Allow camera access to capture a profile or workspace image."); return; }
    }
    setCameraTarget(target);
    setCameraOpen(true);
  };

  const takeProfileOrLogoPhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) return;
      const destination = `${FileSystem.documentDirectory}${cameraTarget}-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: photo.uri, to: destination });
      if (cameraTarget === "avatar") setAvatarUri(destination); else setLogoUri(destination);
      setCameraOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The camera could not capture an image"); }
  };

  const uploadAccountImage = async (kind: "avatar" | "logo") => {
    const uri = kind === "avatar" ? avatarUri : logoUri;
    if (!uri) return;
    const token = await tokenStore.get();
    const path = kind === "avatar" ? "/auth/me" : `/organizations/${organizationId}/workspaces/${workspaceId}`;
    const parameters: Record<string, string> = kind === "avatar"
      ? { name: form.profileName || user?.name || "", phoneNumber: form.profilePhone ?? user?.phoneNumber ?? "" }
      : { name: form.workspaceRename || workspace?.name || "" };
    const result = await FileSystem.uploadAsync(`${API_URL}${path}`, uri, {
      httpMethod: "PATCH", uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: kind, mimeType: "image/jpeg", parameters,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (result.status < 200 || result.status >= 300) {
      const payload = JSON.parse(result.body || "{}") as { message?: string };
      throw new Error(payload.message ?? `Image upload failed (${result.status})`);
    }
    const saved = JSON.parse(result.body) as UserProfile & Workspace;
    if (kind === "avatar") { setUser((current) => ({ ...current!, ...saved })); setAvatarUri(""); }
    else {
      setWorkspace(saved);
      setOrganizations((current) => current.map((org) => org.id === organizationId ? { ...org, workspaces: org.workspaces.map((space) => space.id === saved.id ? saved : space) } : org));
      setLogoUri("");
    }
    await FileSystem.deleteAsync(uri, { idempotent: true });
    notify(kind === "avatar" ? "Profile photo saved" : "Workspace logo saved");
  };

  const applyTheme = async (value: "light" | "dark" | "warm") => {
    setTheme(value);
    await AsyncStorage.setItem("flownexa.mobile.theme", value);
  };
  const applyAccent = async (value: string) => { setAccentId(value); await AsyncStorage.setItem("flownexa.mobile.accent", value); };

  const enablePush = async () => {
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    if (!projectId) { setError("Configure EXPO_PUBLIC_EAS_PROJECT_ID and use a development build to enable push."); return; }
    try {
      const current = await Notifications.getPermissionsAsync();
      const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
      if (!permission.granted) { setError("Notification permission was not granted."); return; }
      const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      await api(`/organizations/${organizationId}/device-tokens`, { method: "POST", body: JSON.stringify({ token: pushToken }) });
      await tokenStore.setDevice(pushToken); notify("This device can receive FlowNexa notifications.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Push notifications could not be enabled"); }
  };

  const statusChip = (value: string) => <View style={[styles.statusChip, { backgroundColor: softAccent }]}><Text style={[styles.statusText, { color: accentColor }]}>{label(value)}</Text></View>;
  const dark = theme === "dark";
  const warm = theme === "warm";
  const panelSurface = dark ? "#202431" : warm ? "#fffaf1" : "#ffffff";
  const pageSurface = dark ? "#151925" : warm ? "#f8f3e9" : "#f5f6fa";
  const mainText = dark ? "#f0f1f5" : "#25263c";
  const mutedText = dark ? "#b2b8c8" : "#82889a";
  const borderColor = dark ? "#343a4b" : warm ? "#eee3d1" : "#e9eaf0";
  const accentColor = ACCENTS.find(({ id }) => id === accentId)?.color ?? ACCENTS[0].color;
  const softAccent = `${accentColor}22`;
  const panel = (title: string, subtitle?: string, children?: ReactNode) => <View style={[styles.panel, { backgroundColor: panelSurface, borderColor }]}><View style={styles.panelHeader}><Text style={[styles.panelTitle, { color: mainText }]}>{title}</Text>{subtitle ? <Text style={[styles.panelSubtitle, { color: mutedText }]}>{subtitle}</Text> : null}</View>{children}</View>;
  const field = (key: string, placeholder: string, opts: { multiline?: boolean; secure?: boolean; keyboard?: "default" | "email-address" | "numeric" } = {}) => <TextInput key={key} value={form[key] ?? ""} onChangeText={(value) => setValue(key, value)} placeholder={placeholder} placeholderTextColor={mutedText} secureTextEntry={opts.secure} keyboardType={opts.keyboard} multiline={opts.multiline} autoCapitalize={opts.keyboard === "email-address" ? "none" : "sentences"} style={[styles.input, { backgroundColor: dark ? "#191e2a" : warm ? "#fffdf8" : "#fbfbfd", borderColor, color: mainText }, opts.multiline && styles.multiline]} />;
  const action = (title: string, run: () => void, secondary = false, disabled = false) => <Pressable accessibilityRole="button" onPress={run} disabled={disabled} style={[styles.action, { backgroundColor: secondary ? (dark ? "#2a3040" : warm ? "#f2eadb" : "#f2f0fb") : accentColor, borderColor: secondary ? borderColor : "transparent" }, secondary && styles.secondaryAction, disabled && styles.disabled]}><Text style={[styles.actionText, secondary && { color: accentColor }]}>{title}</Text></Pressable>;
  const taskCard = (task: Task, compact = false) => <Pressable key={task.id} style={[styles.taskCard, { backgroundColor: dark ? "#1b202d" : warm ? "#fffdf8" : "#fff", borderColor }, compact && styles.taskCardCompact]} onPress={() => void openTask(task)}><View style={styles.row}><Text style={[styles.taskTitle, { color: mainText }]} numberOfLines={2}>{task.title}</Text>{statusChip(task.status)}</View><Text style={[styles.meta, { color: mutedText }]}>{task.project?.name ?? "Workspace task"} · {label(task.priority)}{task.dueAt ? ` · ${new Date(task.dueAt).toLocaleDateString()}` : ""}</Text>{task.progress !== undefined ? <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, task.progress))}%`, backgroundColor: accentColor }]} /></View> : null}</Pressable>;

  const filteredTasks = useMemo(() => tasks.filter((task) => `${task.title} ${task.project?.name ?? ""}`.toLowerCase().includes(query.toLowerCase())), [tasks, query]);
  const filteredMyTasks = useMemo(() => myTasks.filter((task) => `${task.title} ${task.project?.name ?? ""}`.toLowerCase().includes(query.toLowerCase())), [myTasks, query]);

  if (!ready) return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color="#7664c8"/><Text style={[styles.meta, dark && styles.darkMeta]}>Loading your FlowNexa workspace…</Text></SafeAreaView>;
  if (!organization) return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><View style={styles.panel}><Text style={styles.brand}>flow<Text style={styles.brandAccent}>nexa</Text></Text><Text style={styles.title}>Set up your workspace</Text><Text style={[styles.meta, dark && styles.darkMeta]}>Create an organization with a workspace, team, and starter project.</Text>{field("orgName", "Organization name")}{field("spaceName", "Workspace name")}{field("teamName", "Team name (optional)")}{field("projectName", "First project (optional)")}{error ? <Text style={styles.errorText}>{error}</Text> : null}{action(busy ? "Creating…" : "Create my workspace", () => void bootstrapWorkspace(), false, busy || !form.orgName?.trim() || !form.spaceName?.trim())}{action("Refresh account", () => void load().catch((cause) => setError(cause.message)), true)}{action("Sign out", () => void signOut(), true)}</View></ScrollView></SafeAreaView>;

  const overview = () => <>
    <View style={styles.hero}><Text style={styles.eyebrow}>{organization.name.toUpperCase()} · WORKSPACE</Text><Text style={styles.heroTitle}>Plan. Execute. Prove.</Text><Text style={styles.heroText}>Your work, team progress, and delivery signals in one place.</Text></View>
    <View style={styles.metrics}><Metric theme={theme} title="Open tasks" value={tasks.filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status)).length}/><Metric theme={theme} title="Projects" value={projects.length}/><Metric theme={theme} title="Team" value={members.length}/></View>
    {panel("Needs attention", `${tasks.filter((task) => ["BLOCKED", "READY_FOR_REVIEW"].includes(task.status)).length} items`, tasks.filter((task) => ["BLOCKED", "READY_FOR_REVIEW"].includes(task.status)).slice(0, 5).map((task) => taskCard(task, true)))}
    {panel("Recent tasks", "Tap a task to open details", tasks.slice(0, 6).map((task) => taskCard(task, true)))}
    <View style={styles.quickActions}>{action("Create task", () => { setActive("My work"); setForm({}); })}{action("Find anything", () => void openScreen("Search"), true)}</View>
  </>;

  const taskList = (items: Task[], empty: string) => items.length ? items.map((task) => taskCard(task)) : <Empty text={empty}/>;
  const screenContent = () => {
    if (selectedTask) return <>
      {action("← Back to tasks", () => setSelectedTask(undefined), true)}
      {panel(selectedTask.title, `${selectedTask.project?.name ?? "Workspace task"} · ${label(selectedTask.priority)}`, <>
        <Text style={[styles.meta, dark && styles.darkMeta]}>{selectedTask.description || "No description added."}</Text>
        <Text style={[styles.fieldLabel, dark && styles.darkMeta]}>Status</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{TASK_STATES.map((status) => <Pressable key={status} onPress={() => void updateTask(selectedTask, { status })} style={[styles.choiceChip, selectedTask.status === status && { backgroundColor: softAccent }]}><Text style={[styles.choiceText, selectedTask.status === status && { color: accentColor }]}>{label(status)}</Text></Pressable>)}</ScrollView>
        <Text style={[styles.fieldLabel, dark && styles.darkMeta]}>Progress: {selectedTask.progress ?? 0}%</Text>{field("progress", "0–100", { keyboard: "numeric" })}{field("completed", "What did you finish?", { multiline: true })}{field("nextAction", "Next action (optional)")}{field("blocker", "Blocker (optional)")}{action("Submit work update", () => { const progress = Number(form.progress || selectedTask.progress || 0); void api(`/organizations/${organizationId}/tasks/${selectedTask.id}/work-updates`, { method: "POST", body: JSON.stringify({ progress: Math.min(100, Math.max(0, progress)), completed: form.completed, nextAction: form.nextAction || undefined, blocker: form.blocker || undefined }) }).then(() => { notify("Work update submitted"); setForm({}); void openTask(selectedTask); }).catch((cause) => setError(cause.message)); }, false, !form.completed?.trim())}
        <Text style={[styles.fieldLabel, dark && styles.darkMeta]}>Add comment</Text>{field("comment", "Write a comment", { multiline: true })}{action("Post comment", () => { void api(`/organizations/${organizationId}/tasks/${selectedTask.id}/comments`, { method: "POST", body: JSON.stringify({ body: form.comment }) }).then(() => { setForm((current) => ({ ...current, comment: "" })); void openTask(selectedTask); notify("Comment posted"); }).catch((cause) => setError(cause.message)); }, true, !form.comment?.trim())}
        <Text style={[styles.fieldLabel, dark && styles.darkMeta]}>Track time</Text>{field("minutes", "Duration in minutes", { keyboard: "numeric" })}{field("timeNote", "What was this time spent on?")}{action("Save time entry", () => { void api(`/organizations/${organizationId}/tasks/${selectedTask.id}/time-entries`, { method: "POST", body: JSON.stringify({ startedAt: new Date().toISOString(), durationMinutes: Number(form.minutes), note: form.timeNote || "Mobile time entry" }) }).then(() => { setForm({}); void openTask(selectedTask); notify("Time entry saved"); }).catch((cause) => setError(cause.message)); }, true, Number(form.minutes) < 1)}
        {action("Request review", () => { void api(`/organizations/${organizationId}/tasks/${selectedTask.id}/reviews`, { method: "POST" }).then(() => { void load(organizationId, workspaceId); notify("Review requested"); }).catch((cause) => setError(cause.message)); }, true)}
      </>)}
      {panel("Evidence", `${detail.evidence.length} files`, detail.evidence.length ? detail.evidence.map((item, index) => <View key={text(item.id, String(index))} style={styles.listRow}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{text(item.fileName, "Attached evidence")}</Text><Text style={[styles.meta, dark && styles.darkMeta]}>{text(item.mimeType)} · {Math.ceil(number(item.sizeBytes) / 1024)} KB · {text((item.uploader as Row | undefined)?.name, "Teammate")}</Text></View>) : <Empty text="No evidence has been attached."/>)}{panel("Activity", undefined, <>{detail.updates.map((item, index) => <Text key={`u-${index}`} style={[styles.activityText, dark && styles.darkMeta]}>↗ {number(item.progress)}% · {text(item.completed)} · {text(item.submittedAt) && new Date(text(item.submittedAt)).toLocaleString()}</Text>)}{detail.comments.map((item, index) => <Text key={`c-${index}`} style={[styles.activityText, dark && styles.darkMeta]}>“{text(item.body)}” · {text((item.author as Row | undefined)?.name, "Teammate")}</Text>)}{detail.timeEntries.map((item, index) => <Text key={`t-${index}`} style={[styles.activityText, dark && styles.darkMeta]}>◷ {number(item.durationMinutes)} minutes · {text(item.note, "Time entry")}</Text>)}{!detail.updates.length && !detail.comments.length && !detail.timeEntries.length ? <Empty text="No activity yet."/> : null}</>)}
    </>;

    switch (active) {
      case "Overview": return overview();
      case "My work": return <>{panel("My work", `${filteredMyTasks.length} assigned tasks · tap for activity, updates, comments and time`, <>{field("taskTitle", "Create a task…")}{field("description", "Description (optional)", { multiline: true })}{projects.length ? <ScrollView horizontal contentContainerStyle={styles.chipRow}>{projects.map((project) => <Pressable key={project.id} onPress={() => setValue("projectId", project.id)} style={[styles.choiceChip, (form.projectId || projects[0]?.id) === project.id && { backgroundColor: softAccent }]}><Text style={[styles.choiceText, (form.projectId || projects[0]?.id) === project.id && { color: accentColor }]}>{project.name}</Text></Pressable>)}</ScrollView> : <Text style={[styles.meta, dark && styles.darkMeta]}>Add a project first to create tasks.</Text>}<Text style={[styles.fieldLabel, dark && styles.darkMeta]}>Priority</Text><ScrollView horizontal contentContainerStyle={styles.chipRow}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => <Pressable key={priority} onPress={() => setValue("priority", priority)} style={[styles.choiceChip, (form.priority || "MEDIUM") === priority && { backgroundColor: softAccent }]}><Text style={styles.choiceText}>{label(priority)}</Text></Pressable>)}</ScrollView>{field("dueAt", "Due date · YYYY-MM-DD")}{action(busy ? "Creating…" : "Create task", () => void submitTaskCreate(form.taskTitle), false, busy || !form.taskTitle?.trim() || !projects.length)}</>)}{panel("Assigned to you", undefined, taskList(filteredMyTasks, "No tasks are assigned to you yet."))}</>;
      case "My day": { const today = new Date().toDateString(); const due = filteredMyTasks.filter((task) => task.dueAt && new Date(task.dueAt).toDateString() === today); return <>{panel("Today", new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }), <View style={styles.metrics}><Metric theme={theme} title="Due today" value={due.length}/><Metric theme={theme} title="Open" value={due.filter((task) => task.status !== "COMPLETED").length}/></View>)}{panel("Today's tasks", undefined, taskList(due, "Nothing assigned to you is due today."))}</>; }
      case "Board": return <>{TASK_STATES.slice(0, 7).filter((status) => filteredTasks.some((task) => task.status === status)).map((status) => panel(label(status), `${filteredTasks.filter((task) => task.status === status).length} tasks`, filteredTasks.filter((task) => task.status === status).map((task) => taskCard(task, true))))}{!filteredTasks.length ? <Empty text="The board is clear."/> : null}</>;
      case "Calendar": { const calendarTasks = [...filteredTasks].filter((task) => task.dueAt).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt))); return panel("Upcoming deadlines", "Tasks grouped by due date", calendarTasks.length ? calendarTasks.map((task) => <View key={task.id}><Text style={styles.dateHeading}>{new Date(task.dueAt!).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</Text>{taskCard(task, true)}</View>) : <Empty text="No dated tasks yet."/>); }
      case "Projects": return <>{panel("New project", "Create a project in this workspace", <>{field("name", "Project name")}{field("description", "Project description", { multiline: true })}{field("targetDate", "Target date · YYYY-MM-DD")}{action("Create project", () => void createProject(), false, !form.name?.trim())}</>)}{panel("Projects", `${projects.length} in ${workspace?.name ?? "this workspace"}`, projects.map((project) => { const related = tasks.filter((task) => task.project?.id === project.id); const progress = related.length ? Math.round(related.filter((task) => task.status === "COMPLETED").length / related.length * 100) : 0; return <View style={styles.projectCard} key={project.id}><View style={styles.row}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{project.name}</Text>{statusChip(project.status)}</View><Text style={[styles.meta, dark && styles.darkMeta]}>{related.length} tasks · {progress}% complete{project.targetDate ? ` · Target ${new Date(project.targetDate).toLocaleDateString()}` : ""}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]}/></View><ScrollView horizontal contentContainerStyle={styles.chipRow}>{["PLANNING", "ACTIVE", "ON_HOLD", "AT_RISK", "COMPLETED", "ARCHIVED"].map((status) => <Pressable key={status} onPress={() => void changeProjectStatus(project, status)} style={[styles.choiceChip, project.status === status && { backgroundColor: softAccent }]}><Text style={styles.choiceText}>{label(status)}</Text></Pressable>)}</ScrollView></View>; }))}</>;
      case "Teams": return <>{panel("Create team", "Teams organize people in this workspace", <>{field("name", "Team name")}{action("Create team", () => void createTeam(), false, !form.name?.trim())}</>)}{panel("Teams", `${teams.length} groups`, teams.map((team) => <View key={team.id} style={styles.listRow}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{team.name}</Text><Text style={[styles.meta, dark && styles.darkMeta]}>{team.members?.length ?? 0} team members · {team._count?.projects ?? 0} projects</Text><View style={styles.chipRow}>{team.members?.map(({ user: teammate }) => <Pressable key={teammate.id} onPress={() => void removeTeamMember(team, teammate.id)} style={styles.choiceChip}><Text style={styles.choiceText}>{teammate.name} ×</Text></Pressable>)}</View><Text style={[styles.fieldLabel, dark && styles.darkMeta]}>Add a person</Text><ScrollView horizontal contentContainerStyle={styles.chipRow}>{members.filter((member) => !team.members?.some(({ user: teammate }) => teammate.id === member.id)).map((member) => <Pressable key={member.id} onPress={() => void addTeamMember(team, member.id)} style={styles.choiceChip}><Text style={styles.choiceText}>+ {member.name}</Text></Pressable>)}</ScrollView></View>))}{panel("People", `${members.length} organization members`, members.map((member) => <View key={member.id} style={styles.listRow}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{member.name}</Text><Text style={[styles.meta, dark && styles.darkMeta]}>{member.email} · {label(member.role)}{member.teams.length ? ` · ${member.teams.join(", ")}` : ""}</Text></View>))}{action("Invite a teammate", () => void openScreen("Invite member"))}</>;
      case "Invite member": return <>{panel("Invite a teammate", "They will receive access to this organization", <>{field("email", "name@company.com", { keyboard: "email-address" })}<Text style={[styles.fieldLabel, dark && styles.darkMeta]}>Organization role</Text><ScrollView horizontal contentContainerStyle={styles.chipRow}>{["MEMBER", "ADMIN", "VIEWER"].map((role) => <Pressable key={role} onPress={() => setValue("role", role)} style={[styles.choiceChip, (form.role || "MEMBER") === role && { backgroundColor: softAccent }]}><Text style={styles.choiceText}>{label(role)}</Text></Pressable>)}</ScrollView>{action("Create invitation", () => void sendInvite(), false, !form.email?.includes("@"))}</>)}{inviteToken ? panel("One-time invite token", "Copy or share it through your approved channel", <Text selectable style={styles.inviteToken}>{inviteToken}</Text>) : null}{panel("Pending invitations", `${invitations.length} invitation records`, invitations.map((invite, index) => <View key={text(invite.id, String(index))} style={styles.listRow}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{text(invite.email, "Invitation")}</Text><Text style={[styles.meta, dark && styles.darkMeta]}>{label(text(invite.role, "MEMBER"))} · {label(text(invite.status, "PENDING"))}{text(invite.expiresAt) ? ` · Expires ${new Date(text(invite.expiresAt)).toLocaleDateString()}` : ""}</Text><View style={styles.inlineActions}>{action("Resend", () => void api(`/organizations/${organizationId}/invitations/${text(invite.id)}/resend`, { method: "POST" }).then(() => notify("Invitation resent")).catch((cause) => setError(cause.message)), true)}{action("Revoke", () => void api(`/organizations/${organizationId}/invitations/${text(invite.id)}`, { method: "DELETE" }).then(() => { setInvitations((current) => current.filter((item) => item.id !== invite.id)); notify("Invitation revoked"); }).catch((cause) => setError(cause.message)), true)}</View></View>))}</>;
      case "Roles & access": return <>{panel("Custom roles", "Access is enforced by the API for every action", roles.roles.map((role) => <View key={role.id} style={styles.listRow}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{role.name}</Text><Text style={[styles.meta, dark && styles.darkMeta]}>{role.memberCount} people · {role.permissions.map(label).join(", ") || "No permissions"}</Text></View>))}{panel("Assign access", "Choose an existing role for a teammate", members.map((member) => <View key={member.id} style={styles.listRow}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{member.name}</Text><Text style={[styles.meta, dark && styles.darkMeta]}>{member.email} · {label(member.role)}</Text><ScrollView horizontal contentContainerStyle={styles.chipRow}><Pressable onPress={() => void assignRole(member, null)} style={[styles.choiceChip, !member.customRoleId && { backgroundColor: softAccent }]}><Text style={styles.choiceText}>Default</Text></Pressable>{roles.roles.map((role) => <Pressable key={role.id} onPress={() => void assignRole(member, role.id)} style={[styles.choiceChip, member.customRoleId === role.id && { backgroundColor: softAccent }]}><Text style={styles.choiceText}>{role.name}</Text></Pressable>)}</ScrollView></View>))}{panel("Create role", undefined, <>{field("roleName", "Role name")}{roles.catalog.map((permission) => <Pressable key={permission.key} onPress={() => setSelectedPermissions((items) => items.includes(permission.key) ? items.filter((item) => item !== permission.key) : [...items, permission.key])} style={styles.permissionRow}><Text style={[styles.check, selectedPermissions.includes(permission.key) && styles.checkOn]}>{selectedPermissions.includes(permission.key) ? "✓" : "○"}</Text><View style={styles.permissionCopy}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{permission.description}</Text><Text style={[styles.meta, dark && styles.darkMeta]}>{permission.key}</Text></View></Pressable>)}{action("Save role", () => { void api(`/organizations/${organizationId}/roles`, { method: "POST", body: JSON.stringify({ name: form.roleName, permissions: selectedPermissions }) }).then(() => { setSelectedPermissions([]); setForm({}); void openScreen("Roles & access"); notify("Role saved"); }).catch((cause) => setError(cause.message)); }, false, !form.roleName?.trim())}</>)}</>;
      case "Reviews": return <>{panel("Review queue", `${reviews.length} review records`, reviews.map((item, index) => { const task = item.task as Row | undefined; const pending = item.status === "PENDING"; return <View key={text(item.id, String(index))} style={styles.listRow}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{text(task?.title, "Submitted work")}</Text><Text style={[styles.meta, dark && styles.darkMeta]}>{label(text(item.status, "PENDING"))} · Requested {text(item.createdAt) && new Date(text(item.createdAt)).toLocaleDateString()}</Text>{pending ? <View style={styles.inlineActions}>{action("Approve", () => void api(`/organizations/${organizationId}/reviews/${text(item.id)}`, { method: "PATCH", body: JSON.stringify({ status: "APPROVED" }) }).then(() => void openScreen("Reviews")).catch((cause) => setError(cause.message)), false)}{action("Request changes", () => { setValue("reviewComment", ""); setValue("reviewId", text(item.id)); }, true)}</View> : null}</View>; }))}{form.reviewId ? panel("Request changes", "A short reason is required", <>{field("reviewComment", "What should be changed?", { multiline: true })}{action("Send feedback", () => void api(`/organizations/${organizationId}/reviews/${form.reviewId}`, { method: "PATCH", body: JSON.stringify({ status: "CHANGES_REQUESTED", comment: form.reviewComment }) }).then(() => { setForm({}); void openScreen("Reviews"); notify("Feedback sent"); }).catch((cause) => setError(cause.message)), false, !form.reviewComment?.trim())}</>) : null}</>;
      case "Audit history": return panel("Audit history", `${audit.length} recent events`, audit.map((item, index) => <View key={text(item.id, String(index))} style={styles.listRow}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{label(text(item.action, "Workspace event"))}</Text><Text style={[styles.meta, dark && styles.darkMeta]}>{text((item.user as Row | undefined)?.name, "Member")} · {text(item.createdAt) && new Date(text(item.createdAt)).toLocaleString()}</Text>{text((item.task as Row | undefined)?.title) ? <Text style={[styles.meta, dark && styles.darkMeta]}>Task: {text((item.task as Row).title)}</Text> : null}</View>));
      case "Reports": return report ? <>{panel("Workspace delivery", "Live summary from project tasks", <View style={styles.metrics}><Metric theme={theme} title="Total" value={number(report.total)}/><Metric theme={theme} title="Overdue" value={number(report.overdue)}/><Metric theme={theme} title="Blocked" value={number(report.blocked)}/></View>)}{panel("Progress signals", undefined, <>{[["Awaiting review", number(report.awaitingReview)], ["Upcoming this week", number(report.upcoming)], ["Completed this week", number(report.completedThisWeek)], ["Tracked time", `${Math.round(number(report.trackedMinutes) / 60)}h ${number(report.trackedMinutes) % 60}m`]].map(([name, value]) => <View key={String(name)} style={styles.listRow}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{name}</Text><Text style={styles.reportValue}>{value}</Text></View>)}</>)}</> : <Empty text="Report data is not available for this account."/>;
      case "Inbox": return panel("Notifications", `${notifications.length} messages`, notifications.map((item, index) => <View key={text(item.id, String(index))} style={[styles.listRow, !item.readAt && styles.unreadRow]}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{text(item.title, "FlowNexa update")}</Text><Text style={[styles.meta, dark && styles.darkMeta]}>{text(item.body)}</Text><Text style={[styles.meta, dark && styles.darkMeta]}>{text(item.createdAt) && new Date(text(item.createdAt)).toLocaleString()}</Text><View style={styles.inlineActions}>{!item.readAt ? action("Mark read", () => void api(`/organizations/${organizationId}/notifications/${text(item.id)}/read`, { method: "PATCH" }).then(() => void openScreen("Inbox")).catch((cause) => setError(cause.message)), true) : null}{action("Archive", () => void api(`/organizations/${organizationId}/notifications/${text(item.id)}/archive`, { method: "PATCH" }).then(() => void openScreen("Inbox")).catch((cause) => setError(cause.message)), true)}</View></View>));
      case "Search": return panel("Search workspace", "Search tasks, projects, and comments", <>{field("search", "Type at least 2 characters…")}{action("Search", () => { const params = new URLSearchParams({ q: form.search ?? "", workspaceId }); void api<Row>(`/organizations/${organizationId}/search?${params}`).then(setSearchResult).catch((cause) => setError(cause.message)); }, false, (form.search?.trim().length ?? 0) < 2)}{([...(searchResult?.tasks as Row[] ?? []), ...(searchResult?.projects as Row[] ?? []), ...(searchResult?.comments as Row[] ?? [])]).map((item, index) => <View key={text(item.id, String(index))} style={styles.listRow}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{text(item.title) || text(item.name) || text(item.body)}</Text><Text style={[styles.meta, dark && styles.darkMeta]}>{text(item.status) ? label(text(item.status)) : "Search result"}</Text></View>)}</>);
      case "AI assistant": return <>{panel("FlowNexa AI", "Ask about your workspace and get delivery insights", <>{field("aiQuestion", "Ask a question…", { multiline: true })}{action("Ask AI", () => { setAiAnswer(""); void api<Row>("/ai/ask", { method: "POST", body: JSON.stringify({ organizationId, workspaceId, message: form.aiQuestion, language: "auto" }) }).then((result) => { setAiAnswer(text(result.answer, text(result.message, JSON.stringify(result)))); }).catch((cause) => setError(cause.message)); }, false, (form.aiQuestion?.trim().length ?? 0) < 2)}<View style={styles.inlineActions}>{action("Daily plan", () => void api<Row>("/ai/daily-plan", { method: "POST", body: JSON.stringify({ organizationId }) }).then((result) => setAiAnswer(text(result.answer, JSON.stringify(result)))).catch((cause) => setError(cause.message)), true)}{action("Weekly summary", () => void api<Row>("/ai/weekly-summary", { method: "POST", body: JSON.stringify({ organizationId }) }).then((result) => setAiAnswer(text(result.answer, JSON.stringify(result)))).catch((cause) => setError(cause.message)), true)}</View>{aiAnswer ? <Text style={styles.answer}>{aiAnswer}</Text> : null}</>)}{panel("Break down a task", "Generate suggested subtasks without creating records", <>{field("breakdownTitle", "Task or goal title")}{field("breakdownDescription", "Add context (optional)", { multiline: true })}{action("Generate breakdown", () => void api<Row>("/ai/task-breakdown", { method: "POST", body: JSON.stringify({ organizationId, title: form.breakdownTitle, description: form.breakdownDescription || undefined }) }).then((result) => setAiAnswer(text(result.answer, JSON.stringify(result)))).catch((cause) => setError(cause.message)), true, (form.breakdownTitle?.trim().length ?? 0) < 2)}</>)}</>;
      case "Notes": return <>{panel(editingNoteId ? "Edit note" : "New note", "Notes are shared in the selected workspace", <>{field("title", "Note title")}{field("content", "Write your note…", { multiline: true })}{action(editingNoteId ? "Save changes" : "Save note", () => void createNote(), false, !form.title?.trim())}{editingNoteId ? action("Cancel edit", () => { setEditingNoteId(""); setForm({}); }, true) : null}</>)}{panel("Workspace notes", `${notes.length} notes`, notes.map((item, index) => <View key={text(item.id, String(index))} style={styles.listRow}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{text(item.title, "Untitled note")}</Text><Text style={[styles.meta, dark && styles.darkMeta]}>{text((item.author as Row | undefined)?.name, "Member")} · {text(item.updatedAt) && new Date(text(item.updatedAt)).toLocaleDateString()}</Text><Text style={styles.noteContent}>{text(item.content).replace(/<[^>]*>/g, " ").slice(0, 300)}</Text><View style={styles.inlineActions}>{action("Edit", () => { setEditingNoteId(text(item.id)); setForm({ title: text(item.title), content: text(item.content).replace(/<[^>]*>/g, " ") }); }, true)}{action("Delete", () => void api(`/organizations/${organizationId}/workspaces/${workspaceId}/notes/${text(item.id)}`, { method: "DELETE" }).then(() => { setNotes((current) => current.filter((note) => note.id !== item.id)); notify("Note deleted"); }).catch((cause) => setError(cause.message)), true)}</View></View>))}</>;
      case "Work updates": return <>{panel("Submit progress", "Post a progress update for an assigned task", <>{<Text style={[styles.fieldLabel, dark && styles.darkMeta]}>Choose a task</Text>}<ScrollView horizontal contentContainerStyle={styles.chipRow}>{tasks.map((task) => <Pressable key={task.id} onPress={() => setValue("taskId", task.id)} style={[styles.choiceChip, form.taskId === task.id && { backgroundColor: softAccent }]}><Text style={styles.choiceText} numberOfLines={1}>{task.title}</Text></Pressable>)}</ScrollView>{field("progress", "Progress 0–100", { keyboard: "numeric" })}{field("completed", "What did you finish?", { multiline: true })}{field("nextAction", "Next action")}{field("blocker", "Blockers")}{action("Submit update", () => { void api(`/organizations/${organizationId}/tasks/${form.taskId}/work-updates`, { method: "POST", body: JSON.stringify({ progress: Number(form.progress || 0), completed: form.completed, nextAction: form.nextAction || undefined, blocker: form.blocker || undefined }) }).then(() => { setForm({}); notify("Update submitted"); void openScreen("Work updates"); }).catch((cause) => setError(cause.message)); }, false, !form.taskId || !form.completed?.trim())}</>)}{panel("Latest activity", `${audit.length} updates`, audit.map((item, index) => <View style={styles.listRow} key={text(item.id, String(index))}><Text style={[styles.taskTitle, dark && styles.darkMainText]}>{text((item.task as Row | undefined)?.title, text(item.completed, "Work update"))}</Text><Text style={[styles.meta, dark && styles.darkMeta]}>{number(item.progress)}% · {text(item.completed)} · {text(item.submittedAt) && new Date(text(item.submittedAt)).toLocaleString()}</Text></View>))}</>;
      case "Profile & account": return <>{panel("Appearance", "Saved on this device", <>{[ ["light", "Light"], ["dark", "Dark"], ["warm", "Warm"] ].map(([value, title]) => <Pressable key={value} onPress={() => void applyTheme(value as "light" | "dark" | "warm")} style={[styles.choiceChip, theme === value && { backgroundColor: softAccent }]}><Text style={styles.choiceText}>{theme === value ? "✓ " : ""}{title}</Text></Pressable>)}<Text style={[styles.fieldLabel, dark && styles.darkMeta]}>Accent</Text><View style={styles.chipRow}>{ACCENTS.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.label} accent`} onPress={() => void applyAccent(item.id)} style={[styles.choiceChip, { backgroundColor: accentId === item.id ? `${item.color}26` : panelSurface, borderWidth: 1, borderColor: item.color }]}><Text style={[styles.choiceText, { color: item.color }]}>{accentId === item.id ? "✓ " : ""}{item.label}</Text></Pressable>)}</View></>)}{panel("Account settings", "Manage your personal account", <>{user?.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={styles.avatarPreview}/> : null}{avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarPreview}/> : null}{action(avatarUri ? "Capture a different profile photo" : "Capture profile photo", () => void captureProfileOrLogo("avatar"), true)}{avatarUri ? action("Save profile photo", () => void uploadAccountImage("avatar"), false) : null}{field("profileName", "Full name")}{field("profilePhone", "Phone number")}{<Text style={[styles.readOnly, dark && styles.darkMeta]}>Email · {user?.email}</Text>}{<Text style={[styles.readOnly, dark && styles.darkMeta]}>Workspace role · {label(user?.role ?? "MEMBER")} · {organization.name}</Text>}{user?.emailVerifiedAt ? <Text style={[styles.readOnly, dark && styles.darkMeta]}>Email verified</Text> : action("Resend email verification", () => void api("/auth/verification-email", { method: "POST" }).then(() => notify("Verification email requested")).catch((cause) => setError(cause.message)), true)}{action("Save profile", () => void api<UserProfile>("/auth/me", { method: "PATCH", body: JSON.stringify({ name: form.profileName || user?.name, phoneNumber: form.profilePhone ?? user?.phoneNumber ?? "" }) }).then((saved) => { setUser((current) => ({ ...current!, ...saved })); notify("Profile saved"); }).catch((cause) => setError(cause.message)), false, (form.profileName ?? user?.name ?? "").trim().length < 2)}<Text style={[styles.sectionTitle, dark && styles.darkMainText]}>Change password</Text>{field("currentPassword", "Current password", { secure: true })}{field("newPassword", "New password · at least 12 characters", { secure: true })}{field("confirmPassword", "Confirm new password", { secure: true })}{action("Update password", () => void api("/auth/password", { method: "PATCH", body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) }).then(async () => { await api("/auth/logout", { method: "POST" }).catch(() => undefined); setForm({}); await tokenStore.clear(); notify("Password updated. Please sign in again."); router.replace("/"); }).catch((cause) => setError(cause.message)), true, !form.currentPassword || (form.newPassword?.length ?? 0) < 12 || form.newPassword !== form.confirmPassword)}{action("Enable push notifications", () => void enablePush(), true)}{action("Sign out", () => void signOut(), true)}</>)}</>;
      case "Help & support": return panel("FlowNexa support", "Workspace help and account guidance", <><Text style={[styles.meta, dark && styles.darkMeta]}>Find help with workspaces, projects, task delivery, reviews, and team access.</Text><Text style={[styles.meta, dark && styles.darkMeta]}>For technical support, open the FlowNexa repository issue tracker in a browser.</Text>{action("Refresh workspace data", () => void load(organizationId, workspaceId).then(() => notify("Workspace refreshed")).catch((cause) => setError(cause.message)), true)}</>);
      default: return overview();
    }
  };

  const signOut = async () => {
    const deviceToken = await tokenStore.getDevice();
    if (deviceToken && organizationId) await api(`/organizations/${organizationId}/device-tokens`, { method: "PATCH", body: JSON.stringify({ token: deviceToken }) }).catch(() => undefined);
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    await tokenStore.clear(); await tokenStore.clearDevice();
    await AsyncStorage.multiRemove(["flownexa.mobile.org", "flownexa.mobile.workspace"]);
    router.replace("/");
  };
  const activeGroup = NAV.find((group) => group.items.some((item) => item.name === active))?.label ?? "WORKSPACE";
  return <SafeAreaView style={[styles.page, { backgroundColor: pageSurface }]}>
    <View style={[styles.topbar, { backgroundColor: panelSurface, borderBottomColor: borderColor }]}><Pressable accessibilityRole="button" accessibilityLabel="Open navigation drawer" onPress={() => setDrawerOpen(true)} style={styles.menuButton}><Text style={styles.menuGlyph}>☰</Text></Pressable><View style={styles.topCopy}><Text style={[styles.topTitle, { color: mainText }]}>{active}</Text><Text style={[styles.topSubtitle, { color: mutedText }]} numberOfLines={1}>{workspace?.name ?? organization.name}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Refresh workspace" onPress={() => void load(organizationId, workspaceId).catch((cause) => setError(cause.message))} style={styles.refreshButton}><Text style={styles.refreshGlyph}>↻</Text></Pressable></View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load(organizationId, workspaceId).catch((cause) => setError(cause.message))} tintColor="#7664c8"/>}>
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
      {message ? <View style={styles.messageBox}><Text style={styles.messageText}>{message}</Text></View> : null}
      {active === "Search" ? null : null}
      {screenContent()}
      <Text style={[styles.footer, { color: mutedText }]}>FlowNexa · {activeGroup.toLowerCase()} · {user?.name ?? "Signed in"}</Text>
    </ScrollView>
    <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
      <View style={styles.drawerRoot}><View style={[styles.drawer, { backgroundColor: panelSurface }]}>
        <View style={styles.drawerBrandRow}><View style={styles.logoMark}><View style={styles.logoTile}/><View style={[styles.logoTile, styles.logoTile2]}/><View style={[styles.logoTile, styles.logoTile3]}/><View style={[styles.logoTile, styles.logoTile4]}/></View><Text style={styles.brand}>flow<Text style={styles.brandAccent}>nexa</Text></Text><Pressable onPress={() => setDrawerOpen(false)} style={styles.closeButton}><Text style={styles.closeGlyph}>×</Text></Pressable></View>
        <Pressable style={styles.workspacePicker} onPress={() => { setDrawerOpen(false); void openScreen("Overview"); setValue("workspaceRename", workspace?.name ?? ""); setValue("showSpaces", "true"); }}><View style={styles.workspaceBadge}><Text style={styles.workspaceInitial}>{workspace?.name?.slice(0, 1).toUpperCase() ?? "F"}</Text></View><View style={styles.workspaceCopy}><Text style={styles.workspaceName} numberOfLines={1}>{workspace?.name ?? "Select workspace"}</Text><Text style={styles.workspaceOrg} numberOfLines={1}>{organization.name} · {label(organization.role ?? "MEMBER")}</Text></View><Text style={styles.chevron}>⌄</Text></Pressable>
        <ScrollView style={styles.drawerNav}>
          {NAV.map((group) => <View key={group.label} style={styles.drawerGroup}><Text style={styles.drawerGroupLabel}>{group.label}</Text>{group.items.map((item) => <Pressable key={item.name} onPress={() => void openScreen(item.name)} style={[styles.drawerItem, active === item.name && styles.drawerItemActive]}><Text style={[styles.drawerIcon, active === item.name && styles.drawerIconActive]}>{item.icon}</Text><Text style={[styles.drawerLabel, active === item.name && styles.drawerLabelActive]}>{item.name}</Text></Pressable>)}</View>)}
        </ScrollView>
        <View style={styles.drawerBottom}><Text style={styles.drawerUser}>{user?.name ?? "FlowNexa user"}</Text><Text style={styles.drawerUserEmail}>{user?.email ?? ""}</Text><Pressable onPress={() => { void openScreen("Profile & account"); }} style={styles.drawerSignOut}><Text style={styles.drawerSignOutText}>Account settings</Text></Pressable><Pressable onPress={() => void signOut()} style={styles.drawerSignOut}><Text style={styles.drawerSignOutText}>Sign out</Text></Pressable></View>
      </View><Pressable style={styles.drawerShade} onPress={() => setDrawerOpen(false)}/></View>
    </Modal>
    <Modal visible={form.showSpaces === "true"} transparent animationType="slide" onRequestClose={() => setValue("showSpaces", "false")}><View style={styles.modalBackdrop}><View style={[styles.spaceSheet, { backgroundColor: panelSurface }]}><View style={styles.row}><Text style={[styles.panelTitle, { color: mainText }]}>Switch workspace</Text><Pressable onPress={() => setValue("showSpaces", "false")}><Text style={styles.closeGlyph}>×</Text></Pressable></View><ScrollView>{organizations.map((org) => <View key={org.id}><Text style={styles.drawerGroupLabel}>{org.name}</Text>{org.workspaces.map((space) => <Pressable key={space.id} style={styles.listRow} onPress={() => { setValue("showSpaces", "false"); void AsyncStorage.multiSet([["flownexa.mobile.org", org.id], ["flownexa.mobile.workspace", space.id]]).then(() => load(org.id, space.id)); }}><Text style={[styles.taskTitle, { color: mainText }]}>{space.name}</Text><Text style={[styles.meta, { color: mutedText }]}>{org.id === organizationId && space.id === workspaceId ? "Current workspace" : "Switch to workspace"}</Text></Pressable>)}</View>)}<Text style={styles.drawerGroupLabel}>EDIT CURRENT WORKSPACE</Text>{workspace?.logoUrl ? <Image source={{ uri: workspace.logoUrl }} style={styles.logoPreview}/> : null}{logoUri ? <Image source={{ uri: logoUri }} style={styles.logoPreview}/> : null}{action(logoUri ? "Capture a different logo" : "Capture workspace logo", () => void captureProfileOrLogo("logo"), true)}{logoUri ? action("Save workspace logo", () => void uploadAccountImage("logo"), false) : null}{field("workspaceRename", "Workspace name")}{action("Save workspace name", () => void renameWorkspace(), true, !form.workspaceRename?.trim())}<Text style={styles.drawerGroupLabel}>CREATE WORKSPACE</Text>{field("newWorkspace", "New workspace name")}{action("Create and switch", () => void createWorkspace(), false, !form.newWorkspace?.trim())}</ScrollView></View></View></Modal>
    <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}><SafeAreaView style={styles.cameraPage}><CameraView ref={cameraRef} style={styles.cameraView} facing="back"/><View style={styles.cameraActions}>{action("Cancel", () => setCameraOpen(false), true)}{action("Capture photo", () => void takeProfileOrLogoPhoto())}</View></SafeAreaView></Modal>
  </SafeAreaView>;
}

function Metric({ title, value, theme = "light" }: { title: string; value: number; theme?: "light" | "dark" | "warm" }) { const dark = theme === "dark"; return <View style={[styles.metric, dark && { backgroundColor: "#202431", borderColor: "#343a4b" }]}><Text style={[styles.metricLabel, dark && { color: "#b2b8c8" }]}>{title}</Text><Text style={[styles.metricValue, dark && { color: "#c3baff" }]}>{value}</Text></View>; }
function Empty({ text: emptyText }: { text: string }) { return <View style={styles.empty}><Text style={styles.emptyGlyph}>◇</Text><Text style={styles.emptyText}>{emptyText}</Text></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f5f6fa" }, cameraPage: { flex: 1, backgroundColor: "#111" }, cameraView: { flex: 1 }, cameraActions: { flexDirection: "row", padding: 16, gap: 12, backgroundColor: "#fff" }, avatarPreview: { width: 82, height: 82, borderRadius: 41, alignSelf: "center", backgroundColor: "#eee" }, logoPreview: { width: 72, height: 72, borderRadius: 14, alignSelf: "center", backgroundColor: "#eee" }, inviteToken: { padding: 12, backgroundColor: "#f4f1ff", borderRadius: 10, color: "#41377e", fontWeight: "700" }, darkMainText: { color: "#f0f1f5" }, darkMeta: { color: "#b2b8c8" }, loading: { flex: 1, backgroundColor: "#f5f6fa", alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
  topbar: { minHeight: 66, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e8eaf1", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12 }, menuButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#f3f0ff", alignItems: "center", justifyContent: "center" }, menuGlyph: { color: "#55469e", fontSize: 22, fontWeight: "700" }, topCopy: { flex: 1 }, topTitle: { fontSize: 17, fontWeight: "800", color: "#202235" }, topSubtitle: { marginTop: 3, color: "#83889a", fontSize: 12 }, refreshButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#f5f6fa", alignItems: "center", justifyContent: "center" }, refreshGlyph: { color: "#6254ad", fontSize: 24 }, scroll: { flex: 1 }, content: { padding: 16, paddingBottom: 32, gap: 14 },
  hero: { backgroundColor: "#25263c", borderRadius: 22, padding: 21, overflow: "hidden" }, eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4, color: "#bcb1ff" }, heroTitle: { marginTop: 14, fontSize: 25, fontWeight: "800", letterSpacing: -0.5, color: "white" }, heroText: { marginTop: 8, color: "#d5d6e2", fontSize: 13, lineHeight: 19, maxWidth: 300 }, metrics: { flexDirection: "row", gap: 9 }, metric: { flex: 1, backgroundColor: "white", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 13, borderWidth: 1, borderColor: "#eaebf1" }, metricLabel: { color: "#777d90", fontSize: 11, fontWeight: "600" }, metricValue: { marginTop: 8, fontSize: 23, fontWeight: "800", color: "#55469e" },
  panel: { backgroundColor: "white", borderRadius: 18, borderWidth: 1, borderColor: "#e9eaf0", padding: 16, gap: 12 }, panelHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 6 }, panelTitle: { color: "#25263c", fontSize: 16, fontWeight: "800", flexShrink: 1 }, panelSubtitle: { color: "#8a8fa1", fontSize: 11 }, taskCard: { backgroundColor: "#fff", borderColor: "#eceef3", borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 8, gap: 8 }, taskCardCompact: { backgroundColor: "#fafaff" }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, taskTitle: { flex: 1, color: "#2c2e42", fontSize: 14, lineHeight: 20, fontWeight: "700" }, meta: { color: "#82889a", fontSize: 12, lineHeight: 18 }, statusChip: { maxWidth: 120, backgroundColor: "#f1effb", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }, statusText: { color: "#6657af", fontSize: 9, fontWeight: "800" }, progressTrack: { height: 5, backgroundColor: "#eeeef4", borderRadius: 9, overflow: "hidden", marginTop: 3 }, progressFill: { height: "100%", backgroundColor: "#7664c8", borderRadius: 9 }, quickActions: { flexDirection: "row", gap: 10 }, action: { flex: 1, alignSelf: "stretch", minHeight: 42, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#6555b4" }, actionText: { textAlign: "center", color: "white", fontSize: 12, fontWeight: "800" }, secondaryAction: { backgroundColor: "#f2f0fb", borderWidth: 1, borderColor: "#e4e0f5" }, secondaryActionText: { color: "#5d4ea8" }, disabled: { opacity: 0.45 },
  input: { minHeight: 46, borderWidth: 1, borderColor: "#e5e7ee", backgroundColor: "#fbfbfd", borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: "#26283b" }, multiline: { minHeight: 94, textAlignVertical: "top" }, fieldLabel: { color: "#61677a", fontSize: 12, fontWeight: "700", marginTop: 4 }, choiceChip: { paddingVertical: 8, paddingHorizontal: 11, backgroundColor: "#f5f5f9", borderRadius: 18 }, choiceChipSelected: { backgroundColor: "#ece8ff" }, choiceText: { color: "#72778a", fontSize: 11, fontWeight: "700" }, choiceTextSelected: { color: "#57489f" }, chipRow: { gap: 8, paddingVertical: 3 }, dateHeading: { marginTop: 8, color: "#6254ad", fontWeight: "800", fontSize: 12 }, projectCard: { borderTopWidth: 1, borderTopColor: "#eff0f4", paddingTop: 12, gap: 8 }, listRow: { borderTopWidth: 1, borderTopColor: "#eff0f4", paddingVertical: 12, gap: 6 }, permissionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 }, check: { color: "#8e92a2", fontSize: 18, width: 26, textAlign: "center" }, checkOn: { color: "#6858b8" }, permissionCopy: { flex: 1 }, inlineActions: { flexDirection: "row", gap: 8, marginTop: 4 }, unreadRow: { borderLeftWidth: 3, borderLeftColor: "#7664c8", paddingLeft: 10 }, reportValue: { fontSize: 17, color: "#5c4da7", fontWeight: "800" }, answer: { backgroundColor: "#f7f6fb", padding: 13, borderRadius: 12, color: "#44465b", fontSize: 13, lineHeight: 20 }, noteContent: { color: "#5f6477", fontSize: 12, lineHeight: 18 }, activityText: { color: "#606579", fontSize: 12, lineHeight: 18, paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#f0f1f4" }, sectionTitle: { fontSize: 14, fontWeight: "800", color: "#34364a", marginTop: 10 }, readOnly: { padding: 10, borderRadius: 10, backgroundColor: "#f7f7fa", color: "#72778a", fontSize: 12 }, empty: { paddingVertical: 24, alignItems: "center", gap: 7 }, emptyGlyph: { fontSize: 23, color: "#9c91d9" }, emptyText: { color: "#878c9d", textAlign: "center", fontSize: 12 },
  errorBox: { padding: 12, borderRadius: 12, backgroundColor: "#fff0f0", borderWidth: 1, borderColor: "#f6cccc" }, errorText: { color: "#a13f45", fontSize: 12, lineHeight: 18 }, messageBox: { padding: 11, borderRadius: 12, backgroundColor: "#edfaf5" }, messageText: { color: "#217d5a", fontSize: 12, fontWeight: "700" }, footer: { textAlign: "center", color: "#a1a5b2", fontSize: 10, marginTop: 12 }, title: { color: "#25263c", fontWeight: "800", fontSize: 22 }, brand: { fontSize: 25, fontWeight: "900", color: "#27283d", letterSpacing: -1 }, brandAccent: { color: "#7867ca" },
  drawerRoot: { flex: 1, flexDirection: "row", backgroundColor: "rgba(20,22,37,0.45)" }, drawerShade: { flex: 1 }, drawer: { width: "84%", maxWidth: 340, backgroundColor: "#fff", paddingTop: 18, paddingHorizontal: 17, paddingBottom: 12, borderTopRightRadius: 22, borderBottomRightRadius: 22 }, drawerBrandRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }, logoMark: { width: 27, height: 27, flexDirection: "row", flexWrap: "wrap", gap: 3 }, logoTile: { width: 11, height: 11, borderRadius: 3, backgroundColor: "#7c6aca" }, logoTile2: { opacity: 0.64 }, logoTile3: { opacity: 0.43 }, logoTile4: { backgroundColor: "#55469e" }, closeButton: { marginLeft: "auto", padding: 7 }, closeGlyph: { color: "#777b8c", fontSize: 24, lineHeight: 27 }, workspacePicker: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#ececf2", borderRadius: 14, padding: 11, marginTop: 10 }, workspaceBadge: { height: 36, width: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#eeeaff" }, workspaceInitial: { color: "#6656b0", fontWeight: "900", fontSize: 16 }, workspaceCopy: { flex: 1 }, workspaceName: { color: "#303246", fontWeight: "800", fontSize: 12 }, workspaceOrg: { marginTop: 3, color: "#8b8fa0", fontSize: 10 }, chevron: { color: "#85899a", fontSize: 19 }, drawerNav: { flex: 1, marginTop: 10 }, drawerGroup: { marginTop: 10 }, drawerGroupLabel: { color: "#a1a4b1", fontWeight: "800", fontSize: 9, letterSpacing: 1, marginTop: 8, marginBottom: 5 }, drawerItem: { flexDirection: "row", alignItems: "center", gap: 11, height: 40, paddingHorizontal: 10, borderRadius: 10 }, drawerItemActive: { backgroundColor: "#f0edfc" }, drawerIcon: { width: 22, textAlign: "center", color: "#777c90", fontSize: 17, fontWeight: "700" }, drawerIconActive: { color: "#6352b1" }, drawerLabel: { color: "#5e6375", fontSize: 12, fontWeight: "600" }, drawerLabelActive: { color: "#514299", fontWeight: "800" }, drawerBottom: { borderTopWidth: 1, borderTopColor: "#eeeeF3", paddingTop: 12, gap: 5 }, drawerUser: { color: "#34364a", fontWeight: "800", fontSize: 13 }, drawerUserEmail: { color: "#85899a", fontSize: 10 }, drawerSignOut: { paddingVertical: 9 }, drawerSignOutText: { color: "#6254ad", fontWeight: "700", fontSize: 12 }, modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(24,25,40,0.45)" }, spaceSheet: { backgroundColor: "white", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: "70%" },
});

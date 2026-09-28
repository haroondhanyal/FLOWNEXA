import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api, Organization, Task } from "../../lib/api";
import { useWorkspaceEvents } from "../../lib/useWorkspaceEvents";

// Tasks refresh when the tab opens so task state isn't kept stale between visits.
export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [message, setMessage] = useState("");
  const [organizationId, setOrganizationId] = useState<string>();
  const load = useCallback(async () => {
    const orgs = await api<Organization[]>("/organizations");
    const organization = orgs[0];
    setOrganizationId(organization?.id);
    if (organization) setTasks(await api<Task[]>(`/organizations/${organization.id}/tasks?mine=true`));
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    void load().catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Could not load tasks"); });
    return () => { active = false; };
  }, [load]));
  const refreshOnEvent = useCallback(() => { void load().catch(() => undefined); }, [load]);
  useWorkspaceEvents(organizationId, refreshOnEvent);
  return <ScrollView style={styles.page}>{message ? <Text>{message}</Text> : null}{tasks.map((task) => <Pressable key={task.id} style={styles.card} onLongPress={() => setMessage(`Quick actions for ${task.title}: open Work Update from Create.`)}><Text style={styles.title}>{task.title}</Text><Text style={styles.meta}>{task.project?.name ?? "No project"} · {task.status.replaceAll("_", " ")}</Text><Text style={styles.meta}>{task.priority}{task.dueAt ? ` · Due ${new Date(task.dueAt).toLocaleDateString()}` : ""}</Text></Pressable>)}{tasks.length === 0 && !message ? <Text style={styles.meta}>No tasks assigned in this organization.</Text> : null}</ScrollView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#f7f6fb", padding: 16 }, card: { backgroundColor: "white", borderRadius: 14, padding: 16, marginBottom: 10 }, title: { fontSize: 16, fontWeight: "700", color: "#242138" }, meta: { marginTop: 7, color: "#777486" } });

import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api, Organization, Task } from "../../lib/api";
import { useWorkspaceEvents } from "../../lib/useWorkspaceEvents";

// Home counters come from the signed-in user's real organization tasks.
export default function HomeScreen() {
  const [organization, setOrganization] = useState<Organization>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      const organizations = await api<Organization[]>("/organizations");
      const selected = organizations[0];
      if (!selected) throw new Error("Create an organization in the web app first.");
      setOrganization(selected);
      setTasks(await api<Task[]>(`/organizations/${selected.id}/tasks?mine=true`));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load tasks"); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useWorkspaceEvents(organization?.id, load);
  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  const today = tasks.filter((task) => task.dueAt && new Date(task.dueAt).toDateString() === new Date().toDateString()).length;
  return <ScrollView style={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}/>}><Text style={styles.greeting}>Today at a glance</Text><Text style={styles.sub}>{organization?.name ?? "Your workspace"}</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<View style={styles.metrics}><Metric title="Open tasks" value={tasks.filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status)).length}/><Metric title="Due today" value={today}/><Metric title="Completed" value={completed}/></View><Text style={styles.section}>Needs attention</Text>{tasks.filter((task) => ["BLOCKED", "READY_FOR_REVIEW"].includes(task.status)).slice(0, 8).map((task) => <View style={styles.task} key={task.id}><Text style={styles.title}>{task.title}</Text><Text style={styles.sub}>{task.status.replaceAll("_", " ")} · {task.project?.name ?? "No project"}</Text></View>)}{!error && tasks.length === 0 ? <Text style={styles.sub}>No tasks yet.</Text> : null}</ScrollView>;
}
function Metric({ title, value }: { title: string; value: number }) { return <View style={styles.metric}><Text style={styles.sub}>{title}</Text><Text style={styles.value}>{value}</Text></View>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#f7f6fb", padding: 20 }, greeting: { fontSize: 27, fontWeight: "700", color: "#242138" }, section: { marginTop: 24, marginBottom: 12, fontSize: 18, fontWeight: "700", color: "#242138" }, sub: { color: "#777486", marginTop: 4 }, metrics: { flexDirection: "row", gap: 10, marginTop: 22 }, metric: { flex: 1, padding: 14, backgroundColor: "white", borderRadius: 14 }, value: { fontSize: 24, fontWeight: "700", color: "#7566c5", marginTop: 8 }, task: { backgroundColor: "white", padding: 15, borderRadius: 12, marginBottom: 9 }, title: { fontWeight: "600", color: "#242138" }, error: { color: "#b3261e", marginTop: 12 } });

import { useCallback, useState } from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api, Organization } from "../../lib/api";
import { useWorkspaceEvents } from "../../lib/useWorkspaceEvents";
type Notification = { id: string; title: string; body: string; readAt: string | null; createdAt: string };

// The mobile inbox uses the same stored notification records as the web app.
export default function InboxScreen() {
  const [organization, setOrganization] = useState<Organization>();
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => { const orgs = await api<Organization[]>("/organizations"); const selected = orgs[0]; setOrganization(selected); if (selected) setItems(await api<Notification[]>(`/organizations/${selected.id}/notifications`)); }, []);
  useFocusEffect(useCallback(() => { void refresh().catch((cause) => setError(cause.message)); }, [refresh]));
  const handleEvent = useCallback(() => { void refresh().catch(() => undefined); }, [refresh]);
  useWorkspaceEvents(organization?.id, handleEvent);
  const markRead = async (id: string) => { if (!organization) return; await api(`/organizations/${organization.id}/notifications/${id}/read`, { method: "PATCH" }); await refresh(); };
  return <ScrollView style={styles.page}>{error ? <Text style={styles.error}>{error}</Text> : null}{items.map((item) => <View key={item.id} style={[styles.card, !item.readAt && styles.unread]}><Text style={styles.title}>{item.title}</Text><Text style={styles.body}>{item.body}</Text><Text style={styles.body}>{new Date(item.createdAt).toLocaleString()}</Text>{!item.readAt ? <Button title="Mark read" onPress={() => void markRead(item.id)}/> : null}</View>)}{items.length === 0 && !error ? <Text style={styles.body}>Your inbox is clear.</Text> : null}</ScrollView>;
}
const styles = StyleSheet.create({ page: { flex: 1, padding: 16, backgroundColor: "#f7f6fb" }, card: { padding: 15, backgroundColor: "white", borderRadius: 13, marginBottom: 10, gap: 7 }, unread: { borderLeftWidth: 3, borderLeftColor: "#7566c5" }, title: { fontWeight: "700", color: "#242138" }, body: { color: "#777486" }, error: { color: "#b3261e" } });

import { useCallback, useState } from "react";
import { Button, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";
import { api, Organization, tokenStore } from "../../lib/api";

// Profile contains logout and opt-in device notification registration.
export default function ProfileScreen() {
  const [organization, setOrganization] = useState<Organization>();
  const [message, setMessage] = useState("");
  useFocusEffect(useCallback(() => { void api<Organization[]>("/organizations").then((orgs) => setOrganization(orgs[0])).catch(() => undefined); }, []));
  const enablePush = async () => {
    if (!organization) return;
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    if (!projectId) { setMessage("Set EXPO_PUBLIC_EAS_PROJECT_ID and build a development app to enable mobile push."); return; }
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!permission.granted) { setMessage("Notification permission was not granted."); return; }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api(`/organizations/${organization.id}/device-tokens`, { method: "POST", body: JSON.stringify({ token }) });
    await tokenStore.setDevice(token);
    setMessage("This device can receive task review notifications.");
  };
  const logout = async () => {
    const token = await tokenStore.getDevice();
    if (token && organization) await api(`/organizations/${organization.id}/device-tokens`, { method: "PATCH", body: JSON.stringify({ token }) }).catch(() => undefined);
    await tokenStore.clearDevice();
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    await tokenStore.clear(); router.replace("/");
  };
  return <SafeAreaView style={styles.page}><View style={styles.card}><Text style={styles.heading}>Profile & settings</Text><Text style={styles.meta}>{organization?.name ?? "FlowNexa"}</Text><Button title="Enable push notifications" onPress={() => void enablePush()}/>{message ? <Text style={styles.meta}>{message}</Text> : null}<Button title="Sign out" color="#a43838" onPress={() => void logout()}/></View></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#f7f6fb", padding: 18 }, card: { backgroundColor: "white", padding: 20, borderRadius: 14, gap: 16 }, heading: { fontSize: 21, fontWeight: "700", color: "#242138" }, meta: { color: "#777486" } });

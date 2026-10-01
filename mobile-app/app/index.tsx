import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { api, tokenStore } from "../lib/api";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void tokenStore.get().then((token) => { if (token) router.replace("/(tabs)"); }); }, []);
  const login = async () => {
    setBusy(true); setError("");
    try { const session = await api<{ accessToken: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) }); await tokenStore.set(session.accessToken); router.replace("/(tabs)"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Sign in failed"); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={styles.page}><View style={styles.card}>
    <View style={styles.brandRow}><View style={styles.mark}><View style={styles.tile}/><View style={[styles.tile, styles.tileSoft]}/><View style={[styles.tile, styles.tileFaint]}/><View style={[styles.tile, styles.tileDark]}/></View><Text style={styles.brand}>flow<Text style={styles.brandAccent}>nexa</Text></Text></View>
    <Text style={styles.heading}>Welcome back</Text><Text style={styles.muted}>Sign in to plan, execute, and prove your team’s work.</Text>
    <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email address" value={email} onChangeText={setEmail} style={styles.input}/>
    <TextInput secureTextEntry autoComplete="password" placeholder="Password" value={password} onChangeText={setPassword} style={styles.input}/>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" onPress={() => void login()} disabled={busy || !email || !password} style={[styles.primary, (busy || !email || !password) && styles.disabled]}>{busy ? <ActivityIndicator color="white"/> : <Text style={styles.primaryText}>Sign in</Text>}</Pressable>
    <View style={styles.linkRow}><Pressable onPress={() => router.push("/forgot-password" as never)}><Text style={styles.link}>Forgot password?</Text></Pressable><Pressable onPress={() => router.push("/register" as never)}><Text style={styles.link}>Create account</Text></Pressable></View>
  </View></SafeAreaView>;
}
export const authStyles = StyleSheet.create({ page: { flex: 1, justifyContent: "center", backgroundColor: "#f5f6fa", padding: 22 }, card: { backgroundColor: "white", padding: 24, borderRadius: 22, gap: 15, borderWidth: 1, borderColor: "#e9eaf0", shadowColor: "#24243a", shadowOpacity: 0.08, shadowRadius: 20, elevation: 3 }, brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }, mark: { width: 27, height: 27, flexDirection: "row", flexWrap: "wrap", gap: 3, transform: [{ rotate: "-8deg" }] }, tile: { width: 11, height: 11, borderRadius: 3, backgroundColor: "#8b7ee0" }, tileSoft: { opacity: 0.68 }, tileFaint: { opacity: 0.45 }, tileDark: { backgroundColor: "#514899" }, brand: { color: "#262638", fontSize: 21, fontWeight: "900", letterSpacing: -0.8 }, brandAccent: { color: "#8174ce" }, heading: { fontSize: 27, fontWeight: "800", color: "#242138" }, muted: { color: "#777486", fontSize: 13, lineHeight: 19 }, input: { backgroundColor: "#fbfbfd", borderWidth: 1, borderColor: "#e4e6ed", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: "#25263c", fontSize: 14 }, error: { color: "#a43838", fontSize: 12 }, primary: { backgroundColor: "#6655b5", borderRadius: 12, minHeight: 48, alignItems: "center", justifyContent: "center", padding: 12 }, primaryText: { color: "white", fontWeight: "800", fontSize: 14 }, disabled: { opacity: 0.52 }, linkRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 3 }, link: { color: "#5e4ea7", fontWeight: "700", fontSize: 12 } });
const styles = authStyles;

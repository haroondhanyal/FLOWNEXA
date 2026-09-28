import { useEffect, useState } from "react";
import { ActivityIndicator, Button, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { api, tokenStore } from "../lib/api";

// Login mirrors the web API and stores its short-lived access token securely.
export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void tokenStore.get().then((token) => { if (token) router.replace("/(tabs)"); }); }, []);
  const login = async () => {
    setBusy(true); setError("");
    try {
      const session = await api<{ accessToken: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      await tokenStore.set(session.accessToken); router.replace("/(tabs)");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Login failed"); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={styles.page}><View style={styles.card}><View style={styles.brandRow}><View style={styles.mark}><View style={styles.tile}/><View style={[styles.tile, styles.tileSoft]}/><View style={[styles.tile, styles.tileFaint]}/><View style={[styles.tile, styles.tileDark]}/></View><Text style={styles.brand}><Text style={styles.brandFlow}>flow</Text>nexa</Text></View><Text style={styles.heading}>Welcome back</Text><Text style={styles.muted}>Plan. Execute. Prove. Sign in to continue to your work.</Text><TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} style={styles.input}/><TextInput secureTextEntry placeholder="Password" value={password} onChangeText={setPassword} style={styles.input}/>{error ? <Text style={styles.error}>{error}</Text> : null}<Button title={busy ? "Signing in…" : "Sign in"} onPress={() => void login()} disabled={busy || !email || !password}/>{busy ? <ActivityIndicator/> : null}</View></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, justifyContent: "center", backgroundColor: "#f7f6fb", padding: 24 }, card: { backgroundColor: "white", padding: 24, borderRadius: 20, gap: 14 }, brandRow: { flexDirection: "row", alignItems: "center", gap: 10 }, mark: { width: 26, height: 26, flexDirection: "row", flexWrap: "wrap", gap: 3, transform: [{ rotate: "-8deg" }] }, tile: { width: 11, height: 11, borderRadius: 3, backgroundColor: "#8b7ee0" }, tileSoft: { opacity: 0.68 }, tileFaint: { opacity: 0.45 }, tileDark: { backgroundColor: "#514899" }, brand: { color: "#8174ce", fontSize: 20, fontWeight: "600", letterSpacing: -0.8 }, brandFlow: { color: "#262638", fontWeight: "800" }, heading: { fontSize: 26, fontWeight: "700", color: "#242138" }, muted: { color: "#777486" }, input: { borderWidth: 1, borderColor: "#e4e1ed", borderRadius: 12, padding: 13 }, error: { color: "#b3261e" } });

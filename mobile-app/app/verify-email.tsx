import { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../lib/api";
import { authStyles as styles } from "./index";

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ token?: string; email?: string }>(); const [token, setToken] = useState(params.token ?? ""); const [email, setEmail] = useState(params.email ?? ""); const [error, setError] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setError(""); try { await api("/auth/verify-email", { method: "POST", body: JSON.stringify({ token: token.trim() }) }); setDone(true); } catch (cause) { setError(cause instanceof Error ? cause.message : "Email could not be verified"); } finally { setBusy(false); } };
  return <SafeAreaView style={styles.page}><View style={styles.card}><Text style={styles.brand}>flow<Text style={styles.brandAccent}>nexa</Text></Text><Text style={styles.heading}>Verify your email</Text><Text style={styles.muted}>{email ? `Check ${email} for your verification token.` : "Enter the verification token from your email."}</Text><TextInput autoCapitalize="none" placeholder="Verification token" value={token} onChangeText={setToken} style={styles.input}/>{error ? <Text style={styles.error}>{error}</Text> : null}{done ? <Text style={styles.link}>Email verified. Sign in to continue.</Text> : null}<Pressable onPress={() => void submit()} disabled={busy || token.length < 32} style={styles.primary}>{busy ? <ActivityIndicator color="white"/> : <Text style={styles.primaryText}>Verify email</Text>}</Pressable><Pressable onPress={() => router.replace("/" as never)}><Text style={styles.link}>Back to sign in</Text></Pressable></View></SafeAreaView>;
}

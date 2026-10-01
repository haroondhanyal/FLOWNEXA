import { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../lib/api";
import { authStyles as styles } from "./index";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>(); const [token, setToken] = useState(params.token ?? ""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setError(""); try { await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token: token.trim(), password }) }); router.replace("/"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Password could not be reset"); } finally { setBusy(false); } };
  return <SafeAreaView style={styles.page}><View style={styles.card}><Text style={styles.brand}>flow<Text style={styles.brandAccent}>nexa</Text></Text><Text style={styles.heading}>Choose a new password</Text><Text style={styles.muted}>Use the token from your password reset email.</Text><TextInput autoCapitalize="none" placeholder="Reset token" value={token} onChangeText={setToken} style={styles.input}/><TextInput secureTextEntry placeholder="New password · at least 12 characters" value={password} onChangeText={setPassword} style={styles.input}/>{error ? <Text style={styles.error}>{error}</Text> : null}<Pressable onPress={() => void submit()} disabled={busy || token.length < 32 || password.length < 12} style={styles.primary}>{busy ? <ActivityIndicator color="white"/> : <Text style={styles.primaryText}>Update password</Text>}</Pressable><Pressable onPress={() => router.replace("/" as never)}><Text style={styles.link}>Back to sign in</Text></Pressable></View></SafeAreaView>;
}

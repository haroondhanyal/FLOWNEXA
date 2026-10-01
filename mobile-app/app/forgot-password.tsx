import { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { api } from "../lib/api";
import { authStyles as styles } from "./index";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState(""); const [error, setError] = useState(""); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setError(""); try { await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email.trim() }) }); setSent(true); } catch (cause) { setError(cause instanceof Error ? cause.message : "Request could not be sent"); } finally { setBusy(false); } };
  return <SafeAreaView style={styles.page}><View style={styles.card}><Text style={styles.brand}>flow<Text style={styles.brandAccent}>nexa</Text></Text><Text style={styles.heading}>Reset your password</Text><Text style={styles.muted}>Enter your account email. If it is registered, FlowNexa will send password reset instructions.</Text><TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email address" value={email} onChangeText={setEmail} style={styles.input}/>{error ? <Text style={styles.error}>{error}</Text> : null}{sent ? <Text style={styles.link}>If the account exists, reset instructions have been sent.</Text> : null}<Pressable onPress={() => void submit()} disabled={busy || !email.includes("@")} style={styles.primary}>{busy ? <ActivityIndicator color="white"/> : <Text style={styles.primaryText}>Send reset email</Text>}</Pressable><Pressable onPress={() => router.push("/reset-password" as never)}><Text style={styles.link}>Have a reset token? Enter it here</Text></Pressable><Pressable onPress={() => router.replace("/" as never)}><Text style={styles.link}>Back to sign in</Text></Pressable></View></SafeAreaView>;
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { apiFetch } from "@/lib/api";

// PASSWORD RESET: consume the single-use, expiring reset token from the emailed link.
export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("token") ?? ""); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const password = new FormData(event.currentTarget).get("password");
    try { await apiFetch("/auth/reset-password", { method: "POST", auth: false, body: JSON.stringify({ token, password }) }); setMessage("Password updated. You can now sign in."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Reset link could not be used"); }
    finally { setBusy(false); }
  }
  return <main className="login-shell"><section className="login-form-side"><div className="login-form-wrap"><div className="eyebrow">ACCOUNT SECURITY</div><h2>Choose a new password</h2><p className="login-sub">Use at least 12 characters. Reset links expire after one hour and work once.</p><form className="login-form" onSubmit={submit}><label className="field-label">New password<span className="input-icon"><LockKeyhole size={15}/><input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></span></label>{error && <p className="auth-error" role="alert">{error}</p>}{message && <p role="status" className="toolbar-note">{message}</p>}<button className="primary-button login-submit" disabled={busy || !token}>{busy ? "Saving…" : "Update password"}<ArrowRight size={16}/></button></form><p className="login-switch"><Link href="/login">Back to sign in</Link></p></div></section></main>;
}

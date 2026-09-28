"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { apiFetch, saveAccessToken } from "@/lib/api";

type Session = { accessToken: string; user: { name: string; email: string } };
// LOGIN / REGISTER SCREEN: authenticates a person before they can enter organization data.
// Keep sign-in behavior here so it does not become mixed into task and dashboard screens.
export default function Login() {
  const [mode, setMode] = useState<"login"|"register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const session = await apiFetch<Session>(`/auth/${mode === "login" ? "login" : "register"}`, { method: "POST", auth: false, body: JSON.stringify({ email: form.get("email"), password: form.get("password"), ...(mode === "register" ? { name: form.get("name") } : {}) }) });
      saveAccessToken(session.accessToken);
      const organizationId = new URLSearchParams(window.location.search).get("organizationId");
      const inviteToken = window.location.hash.slice(1);
      if (organizationId && inviteToken) {
        await apiFetch(`/organizations/${organizationId}/invitations/accept`, { method:"POST", body:JSON.stringify({token:inviteToken}) });
        sessionStorage.setItem("flownexa-selected-org", organizationId);
        window.location.assign("/");
        return;
      }
      const organizations = await apiFetch<unknown[]>("/organizations");
      window.location.assign(organizations.length ? "/" : "/onboarding");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not connect. Check that the FlowNexa API is running."); }
    finally { setBusy(false); }
  }
  return <main className="login-shell"><section className="login-brand-panel"><Link className="brand login-brand" href="/"><span className="brand-mark"><span/><span/><span/><span/></span><span>flow<span className="brand-light">nexa</span></span></Link><div className="login-pitch"><span className="login-pitch-icon"><Sparkles size={19}/></span><h1>Make meaningful work move forward.</h1><p>Plan together, keep the details close, and make progress visible.</p><div className="login-pitch-foot"><span className="live-dot"/> A calmer way to work as a team</div></div><span className="login-copyright">© 2026 FlowNexa · Plan. Execute. Prove.</span></section><section className="login-form-side"><div className="login-form-wrap"><div className="login-mobile-brand"><Link className="brand" href="/"><span className="brand-mark"><span/><span/><span/><span/></span><span>flow<span className="brand-light">nexa</span></span></Link></div><div className="eyebrow">YOUR WORKSPACE, IN FLOW</div><h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2><p className="login-sub">{mode === "login" ? "Sign in to pick up where your team left off." : "Start a workspace for your team. It only takes a minute."}</p><form className="login-form" onSubmit={submit}>
      {mode === "register" && <label className="field-label">Full name<input name="name" autoComplete="name" required minLength={2} placeholder="Your name"/></label>}
      <label className="field-label">Work email<span className="input-icon"><Mail size={15}/><input name="email" type="email" autoComplete="email" required placeholder="you@company.com"/></span></label>
      <label className="field-label">Password<span className="input-icon"><LockKeyhole size={15}/><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={12} maxLength={128} placeholder="At least 12 characters"/></span></label>
      {error && <p className="auth-error" role="alert">{error}</p>}<button className="primary-button login-submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}<ArrowRight size={16}/></button>
    </form><p className="login-switch">{mode === "login" ? "New to FlowNexa?" : "Already have an account?"} <button onClick={()=>{setMode(mode === "login" ? "register" : "login");setError("")}}>{mode === "login" ? "Create an account" : "Sign in"}</button></p><p className="auth-note">Your password is only sent to the FlowNexa API over your configured connection.</p></div></section></main>;
}

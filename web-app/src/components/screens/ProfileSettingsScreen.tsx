"use client";
/* eslint-disable @next/next/no-img-element -- The uploaded avatar is returned as a browser-local data URL. */

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { Check, Palette, Shield, UserRound } from "lucide-react";

type UserProfile = { id?: string; name: string; email: string; phoneNumber?: string | null; avatarUrl?: string | null; role?: string; organizationName?: string | null; emailVerifiedAt?: string | null };
type Tab = "Profile" | "Account" | "Appearance";
const accents = [{ id: "violet", name: "Violet", color: "#7668d0" }, { id: "blue", name: "Ocean blue", color: "#3781c5" }, { id: "green", name: "Sage green", color: "#388b70" }, { id: "rose", name: "Rose", color: "#cc6682" }, { id: "amber", name: "Amber", color: "#c58b36" }];

// PROFILE & PREFERENCES: keep personal details, login security, and appearance settings together.
export function ProfileSettingsScreen({ user, onSaved, onMessage }: { user: UserProfile; onSaved: (user: UserProfile) => void; onMessage: (message: string) => void }) {
  const [tab, setTab] = useState<Tab>("Profile");
  const [name, setName] = useState(user.name);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [avatarFile, setAvatarFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState("light");
  const [accent, setAccent] = useState("violet");
  const [texture, setTexture] = useState("plain");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const root = document.documentElement;
    const nextTheme = localStorage.getItem("flownexa-theme") ?? "light";
    const nextAccent = localStorage.getItem("flownexa-accent") ?? "violet";
    const nextTexture = localStorage.getItem("flownexa-texture") ?? "plain";
    setTheme(nextTheme); setAccent(nextAccent); setTexture(nextTexture);
    root.dataset.theme = nextTheme; root.dataset.accent = nextAccent; root.dataset.texture = nextTexture;
  }, []);
  const applyAppearance = (key: "theme" | "accent" | "texture", value: string) => {
    const root = document.documentElement;
    if (key === "theme") { setTheme(value); localStorage.setItem("flownexa-theme", value); root.dataset.theme = value; }
    if (key === "accent") { setAccent(value); localStorage.setItem("flownexa-accent", value); root.dataset.accent = value; }
    if (key === "texture") { setTexture(value); localStorage.setItem("flownexa-texture", value); root.dataset.texture = value; }
  };
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true);
    try { const data = new FormData(); data.set("name", name); data.set("phoneNumber", phoneNumber); if (avatarFile) data.set("avatar", avatarFile); const updated = await apiFetch<UserProfile>("/auth/me", { method: "PATCH", body: data }); setAvatarUrl(updated.avatarUrl ?? ""); setAvatarFile(undefined); onSaved(updated); onMessage("Profile saved"); }
    catch (error) { onMessage(error instanceof Error ? error.message : "Could not save profile"); }
    finally { setBusy(false); }
  };
  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (newPassword !== confirmPassword) { onMessage("New passwords do not match"); return; } setBusy(true);
    try { await apiFetch("/auth/password", { method: "PATCH", body: JSON.stringify({ currentPassword: oldPassword, newPassword }) }); sessionStorage.removeItem("flownexa-access-token"); window.location.assign("/login?passwordChanged=1"); }
    catch (error) { onMessage(error instanceof Error ? error.message : "Could not update password"); }
    finally { setBusy(false); }
  };

  return <div className="settings-layout"><nav className="settings-tabs" aria-label="Settings sections">{(["Profile", "Account", "Appearance"] as Tab[]).map((item) => <button key={item} className={tab === item ? "selected" : ""} onClick={() => setTab(item)}>{item === "Profile" ? <UserRound size={16}/> : item === "Account" ? <Shield size={16}/> : <Palette size={16}/>} {item}</button>)}</nav>
    {tab === "Profile" && <section className="settings-card"><div className="settings-card-head"><div><h2>Edit profile</h2><p>Update how your teammates see and contact you.</p></div></div><form onSubmit={(event) => void saveProfile(event)}><div className="profile-photo-row">{avatarUrl ? <img className="profile-photo" src={avatarUrl} alt="Profile"/> : <span className="profile-photo profile-photo-fallback">{name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>}<div><b>Profile photo</b><small>PNG or JPEG, up to 2 MB.</small><input type="file" accept="image/png,image/jpeg" onChange={(event) => setAvatarFile(event.target.files?.[0])}/></div></div><label className="field-label">Full name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required/></label><label className="field-label">Email address<input value={user.email} readOnly/><small>Email address is used for sign-in.</small></label><label className="field-label">Phone number<input type="tel" autoComplete="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} maxLength={40} placeholder="+1 555 000 0000"/></label><label className="field-label">Workspace role<input value={`${user.role ?? "MEMBER"}${user.organizationName ? ` · ${user.organizationName}` : ""}`} readOnly/><small>Ask a workspace owner to change your access role.</small></label><button className="primary-button" disabled={busy}><Check size={15}/>{busy ? "Saving…" : "Save profile"}</button></form></section>}
    {tab === "Account" && <section className="settings-card"><div className="settings-card-head"><div><h2>Account security</h2><p>Manage your sign-in details and password.</p></div></div><div className="account-status"><Shield size={19}/><div><b>{user.emailVerifiedAt ? "Email verified" : "Email verification not enabled"}</b><small>{user.email}</small></div></div><form className="settings-form" onSubmit={(event) => void changePassword(event)}><h3>Change password</h3><label className="field-label">Current password<input type="password" autoComplete="current-password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} minLength={12} required/></label><label className="field-label">New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} maxLength={128} required/><small>Use at least 12 characters. Changing it signs out other sessions.</small></label><label className="field-label">Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} maxLength={128} required/></label><button className="primary-button" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></form><div className="account-status"><div><b>Signed in securely</b><small>Refresh tokens are stored in an HTTP-only cookie.</small></div></div></section>}
    {tab === "Appearance" && <section className="settings-card"><div className="settings-card-head"><div><h2>Appearance</h2><p>Set a comfortable interface theme and accent color for this browser.</p></div></div><h3>Theme</h3><div className="choice-grid">{[{ id: "light", label: "Light" }, { id: "dark", label: "Dark" }, { id: "warm", label: "Warm" }].map((item) => <button key={item.id} className={`appearance-choice theme-swatch swatch-${item.id} ${theme === item.id ? "selected" : ""}`} onClick={() => applyAppearance("theme", item.id)}><span/><b>{item.label}</b>{theme === item.id && <Check size={15}/>}</button>)}</div><h3>Accent color</h3><div className="accent-options">{accents.map((item) => <button key={item.id} className={`accent-option ${accent === item.id ? "selected" : ""}`} title={item.name} aria-label={`${item.name} accent`} style={{ "--swatch": item.color } as CSSProperties} onClick={() => applyAppearance("accent", item.id)}>{accent === item.id && <Check size={15}/>}</button>)}</div><h3>Workspace texture</h3><div className="choice-grid">{[{ id: "plain", label: "Plain" }, { id: "dots", label: "Soft dots" }, { id: "grid", label: "Fine grid" }].map((item) => <button key={item.id} className={`appearance-choice texture-swatch texture-${item.id} ${texture === item.id ? "selected" : ""}`} onClick={() => applyAppearance("texture", item.id)}><span/><b>{item.label}</b>{texture === item.id && <Check size={15}/>}</button>)}</div><p className="settings-help">These preferences are saved in this browser and apply to your workspace immediately.</p></section>}
  </div>;
}

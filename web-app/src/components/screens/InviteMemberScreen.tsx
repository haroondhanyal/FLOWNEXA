"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, RotateCw, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

// INVITE SCREEN: creates an expiring invite link so an organization lead can add a teammate.
export function InviteMemberScreen({ organizationId, onCreated, onMessage }: { organizationId: string; onCreated: (inviteToken: string) => void; onMessage: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [invitations, setInvitations] = useState<{ id: string; email: string; role: string; expiresAt: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { try { setInvitations(await apiFetch<{ id: string; email: string; role: string; expiresAt: string; status: string }[]>(`/organizations/${organizationId}/invitations`)); } catch (cause) { onMessage(cause instanceof Error ? cause.message : "Could not load invitations"); } finally { setLoading(false); } }, [organizationId, onMessage]);
  useEffect(() => { void refresh(); }, [refresh]);
  const submit = async (form: FormData) => {
    const email = String(form.get("email") ?? "").trim();
    if (!email) return;
    setBusy(true);
    try {
      const invitation = await apiFetch<{ inviteToken: string }>(`/organizations/${organizationId}/invitations`, { method: "POST", body: JSON.stringify({ email, role: String(form.get("role") ?? "MEMBER") }) });
      onCreated(invitation.inviteToken);
    } catch (cause) { onMessage(cause instanceof Error ? cause.message : "Invitation failed"); }
    finally { setBusy(false); }
  };
  const revoke = async (id: string) => { try { await apiFetch(`/organizations/${organizationId}/invitations/${id}`, { method: "DELETE" }); onMessage("Invitation revoked"); await refresh(); } catch (cause) { onMessage(cause instanceof Error ? cause.message : "Could not revoke invitation"); } };
  const resend = async (id: string) => { try { const invitation = await apiFetch<{ inviteToken: string }>(`/organizations/${organizationId}/invitations/${id}/resend`, { method: "POST" }); onCreated(invitation.inviteToken); } catch (cause) { onMessage(cause instanceof Error ? cause.message : "Could not resend invitation"); } };
  return <><form className="form-card" action={(form) => void submit(form)}><h2>Invite a teammate</h2><p>Generate a seven-day invitation link for your organization.</p><label className="field-label">Email address<input type="email" name="email" required placeholder="name@company.com" /></label><div className="modal-row"><label className="field-label">Role<select name="role"><option value="MEMBER">Member</option><option value="ADMIN">Admin</option><option value="VIEWER">Viewer</option></select></label></div><button className="primary-button" disabled={busy}>{busy ? "Creating invite…" : "Create invitation"}<ArrowRight size={15}/></button></form><section className="form-card"><h2>Invitations</h2>{loading ? <p>Loading invitations…</p> : invitations.length ? invitations.map((invitation) => <article className="day-task" key={invitation.id}><b>{invitation.email}</b><span>{invitation.role} · {invitation.status.toLowerCase()}</span><small>Expires {new Date(invitation.expiresAt).toLocaleString()}</small>{invitation.status !== "ACCEPTED" && invitation.status !== "REVOKED" && <div className="view-toolbar"><button className="secondary-button" onClick={() => void resend(invitation.id)}><RotateCw size={14}/>Resend link</button><button className="secondary-button" onClick={() => void revoke(invitation.id)}><X size={14}/>Revoke</button></div>}</article>) : <p>No invitations yet.</p>}</section></>;
}

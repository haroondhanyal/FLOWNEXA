"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";

// INVITE SCREEN: creates an expiring invite link so an organization lead can add a teammate.
export function InviteMemberScreen({ organizationId, onCreated, onMessage }: { organizationId: string; onCreated: (inviteToken: string) => void; onMessage: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
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
  return <form className="form-card" action={(form) => void submit(form)}><h2>Invite a teammate</h2><p>Generate a seven-day invitation link for your organization.</p><label className="field-label">Email address<input type="email" name="email" required placeholder="name@company.com" /></label><div className="modal-row"><label className="field-label">Role<select name="role"><option value="MEMBER">Member</option><option value="ADMIN">Admin</option><option value="VIEWER">Viewer</option></select></label></div><button className="primary-button" disabled={busy}>{busy ? "Creating invite…" : "Create invitation"}<ArrowRight size={15}/></button></form>;
}

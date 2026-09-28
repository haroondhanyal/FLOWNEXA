"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

// EMAIL VERIFICATION: verify the account using the expiring one-time email link.
export default function VerifyEmailPage() {
  const [message, setMessage] = useState("Checking your verification link…");
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setMessage("This verification link is missing its token."); return; }
    void apiFetch("/auth/verify-email", { method: "POST", auth: false, body: JSON.stringify({ token }) }).then(() => setMessage("Email verified. Your FlowNexa account is ready."), (cause: unknown) => setMessage(cause instanceof Error ? cause.message : "This verification link could not be used."));
  }, []);
  return <main className="login-shell"><section className="login-form-side"><div className="login-form-wrap"><div className="eyebrow">ACCOUNT SECURITY</div><h2>Email verification</h2><p className="login-sub" role="status">{message}</p><Link className="primary-button" href="/login">Continue to sign in</Link></div></section></main>;
}

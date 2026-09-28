"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

// The assistant displays only answers returned from the server's grounded AI route.
export function AiAssistantScreen({ organizationId }: { organizationId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = async (kind: "ask" | "weekly" | "plan" | "breakdown" = "ask") => {
    setBusy(true); setAnswer("");
    try {
      const route = kind === "weekly" ? "/ai/weekly-summary" : kind === "plan" ? "/ai/daily-plan" : kind === "breakdown" ? "/ai/task-breakdown" : "/ai/ask";
      const payload = kind === "ask" ? { organizationId, message: question } : kind === "breakdown" ? { organizationId, title: question, description: question } : { organizationId };
      const result = await apiFetch<{ answer: string }>(route, { method: "POST", body: JSON.stringify(payload) });
      setAnswer(result.answer);
    } catch (error) { setAnswer(error instanceof Error ? error.message : "Assistant is unavailable"); }
    finally { setBusy(false); }
  };
  return <section className="form-card"><h2>Ask about your workspace</h2><p>Answers use this organization’s task and update records. Plans and breakdowns are suggestions; they do not write changes.</p><label className="field-label">Question or task title<textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} placeholder="What work is blocked this week?"/></label><div className="modal-row"><button className="primary-button" disabled={busy || question.trim().length < 2} onClick={() => void ask()}>{busy ? "Thinking…" : "Ask"}</button><button className="secondary-button" disabled={busy} onClick={() => void ask("weekly")}>Weekly summary</button><button className="secondary-button" disabled={busy} onClick={() => void ask("plan")}>Plan my day</button><button className="secondary-button" disabled={busy || question.trim().length < 2} onClick={() => void ask("breakdown")}>Break down task</button></div>{answer ? <article className="update-card"><div><b>Assistant suggestion</b><p>{answer}</p></div></article> : null}</section>;
}

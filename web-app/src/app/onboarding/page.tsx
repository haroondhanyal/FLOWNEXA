"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CirclePlus, Users, FolderKanban, ListTodo } from "lucide-react";
import { apiFetch } from "@/lib/api";

const steps = ["Organization", "Workspace", "Team", "Invite", "First project"];

// ONBOARDING SCREEN: creates the first organization and starter workspace after sign-in.
// One API bootstrap request saves the setup together and avoids a half-created workspace.
export default function Onboarding() {
  const [authReady, setAuthReady] = useState(false);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [inviteTokens, setInviteTokens] = useState<{email:string;token:string}[]>([]);
  const [draft, setDraft] = useState<Record<string,string>>({ organization: "Nexa Technologies", workspace: "Main workspace", team: "Product", firstProject: "First project" });
  useEffect(()=>{apiFetch("/auth/me").then(()=>setAuthReady(true)).catch(()=>window.location.replace("/login?next=/onboarding"));},[]);
  const next = async () => {
    if (step < steps.length - 1) setStep(step + 1);
    else {
      setError("");
      try {
        const result = await apiFetch<{organization:{id:string};invitations:{email:string;token:string}[] }>("/organizations/bootstrap", { method:"POST", body:JSON.stringify({name:draft.organization,workspaceName:draft.workspace,teamName:draft.team,projectName:draft.firstProject,firstTask:draft.firstTask,invitees:(draft.invitees??"").split(",").map(value=>value.trim()).filter(Boolean).map(email=>({email}))}) });
        localStorage.setItem("flownexa-onboarding-draft", JSON.stringify({ ...draft, organizationId:result.organization.id }));
        setDraft({...draft,organizationId:result.organization.id});setInviteTokens(result.invitations); setSaved(true);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not finish setup. Check your API connection and try again."); }
    }
  };

  if (!authReady) return <main className="auth-loading"><span className="brand-mark"><span/><span/><span/><span/></span><span>Checking your session…</span></main>;
  return <main className="onboarding-shell"><header className="onboarding-header"><Link className="brand" href="/"><span className="brand-mark"><span/><span/><span/><span/></span><span>flow<span className="brand-light">nexa</span></span></Link><span>Workspace setup</span><Link href="/" className="skip-link">Skip for now</Link></header><div className="onboarding-card"><div className="onboarding-intro"><div className="onboarding-symbol">{saved?<Check size={21}/>:<CirclePlus size={21}/>}</div><div className="eyebrow">STEP {saved?5:step+1} OF 5</div><h1>{saved?"Your workspace is ready":steps[step]}</h1><p>{saved?"Your workspace and starter project have been created.":"A few details will help shape your team's FlowNexa workspace."}</p></div>{!saved&&<><div className="stepper">{steps.map((name,index)=><div className={`stepper-step ${index<=step?"step-done":""}`} key={name}><span>{index<step?<Check size={12}/>:index+1}</span><small>{name}</small></div>)}</div><form id="onboarding-form" onSubmit={event=>{event.preventDefault();void next()}}>
      <section className="onboarding-fields" key={step}>
        {step===0&&<><label className="field-label">Organization name<input name="organization" required placeholder="e.g. Acme Studio" value={draft.organization??""} onChange={e=>setDraft({...draft,organization:e.target.value})}/></label><label className="field-label">Your role<select name="ownerRole" value={draft.ownerRole??"Founder / Owner"} onChange={e=>setDraft({...draft,ownerRole:e.target.value})}><option>Founder / Owner</option><option>Administrator</option><option>Project Manager</option><option>Team Lead</option></select></label></>}
        {step===1&&<><label className="field-label">Workspace name<input name="workspace" required placeholder="e.g. Product team" value={draft.workspace??""} onChange={e=>setDraft({...draft,workspace:e.target.value})}/></label><label className="field-label">How will you use FlowNexa?<select name="purpose" value={draft.purpose??"Plan and deliver projects"} onChange={e=>setDraft({...draft,purpose:e.target.value})}><option>Plan and deliver projects</option><option>Coordinate a department</option><option>Track client work</option><option>Manage personal work</option></select></label></>}
        {step===2&&<><label className="field-label">First team name<input name="team" required placeholder="e.g. Product" value={draft.team??""} onChange={e=>setDraft({...draft,team:e.target.value})}/></label><label className="field-label">Team focus<select name="teamFocus" value={draft.teamFocus??"Product and design"} onChange={e=>setDraft({...draft,teamFocus:e.target.value})}><option>Product and design</option><option>Engineering</option><option>Marketing</option><option>Operations</option></select></label></>}
        {step===3&&<><label className="field-label">Invite teammates <span className="optional-label">Optional · separate emails with commas</span><textarea name="invitees" rows={3} placeholder="alex@company.com, sam@company.com" value={draft.invitees??""} onChange={e=>setDraft({...draft,invitees:e.target.value})}/></label><p className="onboarding-note"><Users size={15}/> Invitations will be sent once email delivery is configured.</p></>}
        {step===4&&<><label className="field-label">Project name<input name="firstProject" required placeholder="e.g. Website refresh" value={draft.firstProject??""} onChange={e=>setDraft({...draft,firstProject:e.target.value})}/></label><label className="field-label">First task <span className="optional-label">Optional</span><input name="firstTask" placeholder="e.g. Outline project goals" value={draft.firstTask??""} onChange={e=>setDraft({...draft,firstTask:e.target.value})}/></label><p className="onboarding-note"><FolderKanban size={15}/> You can add dates, owners, and milestones after setup.</p></>}
      </section>{error&&<p className="auth-error" role="alert">{error}</p>}<div className="onboarding-actions">{step>0?<button type="button" className="secondary-button" onClick={()=>setStep(step-1)}><ArrowLeft size={14}/> Back</button>:<span/>}<button className="primary-button">{step===steps.length-1?"Finish setup":"Continue"}<ArrowRight size={14}/></button></div></form></>}{saved&&<><div className="onboarding-complete"><b>Organization, workspace, team, project{draft.firstTask?.trim()?", and first task":""} created.</b>{inviteTokens.length>0&&<div><p>Copy and send these one-time invite links. Email delivery is not configured yet.</p>{inviteTokens.map(invite=><code key={invite.email}>{invite.email}: /login?organizationId={draft.organizationId}#{invite.token}</code>)}</div>}</div><div className="onboarding-actions"><span/><Link className="primary-button" href="/">Open workspace <ArrowRight size={14}/></Link></div></>}</div><footer className="onboarding-footer"><span><ListTodo size={14}/> Plan. Execute. Prove.</span><span>Setup is saved locally on this device.</span></footer></main>;
}

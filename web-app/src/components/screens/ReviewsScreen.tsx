"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { WorkspaceScreenProps } from "./types";

type Review = { id: string; status: string; comment?: string; task: { id: string; title: string; status: string; project?: { name: string } }; reviewer: { name: string } };
// REVIEWS SCREEN: lets managers approve work or request changes with a written reason.
export function ReviewsScreen({ organizationId, workspaceId, onMessage }: WorkspaceScreenProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const refresh = useCallback(() => apiFetch<Review[]>(`/organizations/${organizationId}/reviews?workspaceId=${encodeURIComponent(workspaceId ?? "")}`).then(setReviews).catch(() => setReviews([])), [organizationId, workspaceId]);
  useEffect(() => { void refresh(); }, [refresh]);
  const decide = async (review: Review, status: string) => {
    const comment = status === "APPROVED" ? "" : window.prompt("Explain what needs attention:")?.trim();
    if (status !== "APPROVED" && !comment) return;
    try { await apiFetch(`/organizations/${organizationId}/reviews/${review.id}`, { method: "PATCH", body: JSON.stringify({ status, comment }) }); onMessage("Review saved"); await refresh(); }
    catch (error) { onMessage(error instanceof Error ? error.message : "Review failed"); }
  };
  return <div className="updates-list">{reviews.length ? reviews.map((review) => <article className="update-card" key={review.id}><div><b>{review.task.title}</b><p>{review.task.project?.name ?? "No project"} · {review.status.replaceAll("_", " ")}</p><small>Submitted by {review.reviewer.name}{review.comment ? ` · ${review.comment}` : ""}</small>{review.status === "PENDING" && <div className="modal-row"><button className="primary-button" onClick={() => void decide(review, "APPROVED")}>Approve</button><button className="secondary-button" onClick={() => void decide(review, "CHANGES_REQUESTED")}>Request changes</button><button className="secondary-button" onClick={() => void decide(review, "REJECTED")}>Reject</button></div>}</div></article>) : <div className="empty-state"><b>No reviews yet</b><span>Submit work for review from the task list.</span></div>}</div>;
}

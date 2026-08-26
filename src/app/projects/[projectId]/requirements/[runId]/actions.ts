"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
	createTrustedRequirementBaseline,
	mergeTrustedRequirementCandidates,
	reviewTrustedRequirementCandidate,
	splitTrustedRequirementCandidate,
	type CandidateReviewAction,
} from "../../../../../lib/requirements/trusted-requirement-review";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const REVIEW_ACTIONS: readonly CandidateReviewAction[] = [
	"SOURCE_VERIFIED",
	"APPROVE",
	"NEEDS_REVIEW",
	"REJECT",
	"EDIT",
];

const REVIEW_RESULT_PARAMS: Record<CandidateReviewAction, string> = {
	SOURCE_VERIFIED: "source_verified",
	APPROVE: "approved",
	NEEDS_REVIEW: "needs_review",
	REJECT: "rejected",
	EDIT: "edited",
};

type ReviewContext = {
	actorId: string;
	runId: string;
};

async function loadReviewContext(
	projectId: string,
	runId: string,
): Promise<ReviewContext | null> {
	if (!UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(runId)) {
		return null;
	}
	const supabase = await createServerSupabaseClient();
	const { data: claimsData } = await supabase.auth.getClaims();
	const actorId =
		typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
	if (!actorId) {
		return null;
	}

	const { data: run } = await supabase
		.from("requirement_extraction_runs")
		.select("id, tenant_id")
		.eq("id", runId)
		.eq("project_id", projectId)
		.maybeSingle();
	if (!run) {
		return null;
	}

	const [projectMembership, tenantMembership] = await Promise.all([
		supabase
			.from("project_memberships")
			.select("role")
			.eq("project_id", projectId)
			.eq("user_id", actorId)
			.maybeSingle(),
		supabase
			.from("tenant_memberships")
			.select("role")
			.eq("tenant_id", run.tenant_id)
			.eq("user_id", actorId)
			.maybeSingle(),
	]);
	const canReview =
		projectMembership.data?.role === "EDITOR" ||
		projectMembership.data?.role === "PROJECT_ADMIN" ||
		tenantMembership.data?.role === "TENANT_ADMIN";
	if (!canReview) {
		return null;
	}
	return { actorId, runId };
}

function redirectToRun(
	projectId: string,
	runId: string,
	reviewParam: string,
): never {
	revalidatePath(`/projects/${projectId}/requirements/${runId}`);
	redirect(`/projects/${projectId}/requirements/${runId}?review=${reviewParam}`);
}

function readText(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value : "";
}

export async function reviewCandidateAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const candidateId = readText(formData, "candidateId");
	const actionText = readText(formData, "action");

	if (
		!UUID_PATTERN.test(candidateId) ||
		!(REVIEW_ACTIONS as readonly string[]).includes(actionText)
	) {
		redirectToRun(projectId, runId, "failed");
	}
	const action = actionText as CandidateReviewAction;
	const context = await loadReviewContext(projectId, runId);
	if (!context) {
		redirect("/login");
	}

	const newInterpretation =
		action === "EDIT" ? readText(formData, "newInterpretation").trim() : null;
	if (action === "EDIT" && !newInterpretation) {
		redirectToRun(projectId, runId, "failed");
	}

	try {
		await reviewTrustedRequirementCandidate({
			actorId: context.actorId,
			runId: context.runId,
			candidateId,
			action,
			newInterpretation,
		});
	} catch {
		redirectToRun(projectId, runId, "failed");
	}
	redirectToRun(projectId, runId, REVIEW_RESULT_PARAMS[action]);
}

export async function mergeCandidatesAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const candidateIds = formData
		.getAll("candidateIds")
		.filter(
			(value): value is string =>
				typeof value === "string" && UUID_PATTERN.test(value),
		);
	const interpretation = readText(formData, "interpretation").trim();

	if (candidateIds.length < 2 || candidateIds.length > 8 || !interpretation) {
		redirectToRun(projectId, runId, "failed");
	}
	const context = await loadReviewContext(projectId, runId);
	if (!context) {
		redirect("/login");
	}

	try {
		await mergeTrustedRequirementCandidates({
			actorId: context.actorId,
			runId: context.runId,
			candidateIds,
			interpretation,
		});
	} catch {
		redirectToRun(projectId, runId, "failed");
	}
	redirectToRun(projectId, runId, "merged");
}

export async function splitCandidateAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const candidateId = readText(formData, "candidateId");
	const newInterpretation = readText(formData, "newInterpretation").trim();

	if (!UUID_PATTERN.test(candidateId) || !newInterpretation) {
		redirectToRun(projectId, runId, "failed");
	}
	const context = await loadReviewContext(projectId, runId);
	if (!context) {
		redirect("/login");
	}

	const supabase = await createServerSupabaseClient();
	const { data: links } = await supabase
		.from("requirement_candidate_source_spans")
		.select("source_span_id, source_order")
		.eq("run_id", context.runId)
		.eq("candidate_id", candidateId)
		.order("source_order", { ascending: true });
	const { data: candidate } = await supabase
		.from("requirement_candidates")
		.select("interpretation")
		.eq("id", candidateId)
		.eq("run_id", context.runId)
		.maybeSingle();
	if (!links || links.length < 2 || !candidate) {
		redirectToRun(projectId, runId, "failed");
	}

	const { data: spans } = await supabase
		.from("source_spans")
		.select("id, ordinal")
		.in(
			"id",
			links.map((link) => link.source_span_id),
		)
		.eq("project_id", projectId);
	if (!spans || spans.length !== links.length) {
		redirectToRun(projectId, runId, "failed");
	}
	const ordinalById = new Map(spans.map((span) => [span.id, span.ordinal]));
	const ordinals = links
		.map((link) => ordinalById.get(link.source_span_id))
		.filter((ordinal): ordinal is number => typeof ordinal === "number")
		.sort((left, right) => left - right);
	if (ordinals.length < 2) {
		redirectToRun(projectId, runId, "failed");
	}

	try {
		await splitTrustedRequirementCandidate({
			actorId: context.actorId,
			runId: context.runId,
			candidateId,
			parts: [
				{
					interpretation: newInterpretation,
					sourceSpanOrdinals: [ordinals[0]!],
				},
				{
					interpretation: candidate.interpretation,
					sourceSpanOrdinals: ordinals.slice(1),
				},
			],
		});
	} catch {
		redirectToRun(projectId, runId, "failed");
	}
	redirectToRun(projectId, runId, "split");
}

export async function createBaselineAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const context = await loadReviewContext(projectId, runId);
	if (!context) {
		redirect("/login");
	}

	try {
		await createTrustedRequirementBaseline({
			actorId: context.actorId,
			runId: context.runId,
		});
	} catch {
		redirectToRun(projectId, runId, "failed");
	}
	redirectToRun(projectId, runId, "created");
}

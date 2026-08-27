import "server-only";

import { createTrustedSupabaseClient } from "../supabase/trusted-server";

export type CandidateReviewAction =
	| "SOURCE_VERIFIED"
	| "APPROVE"
	| "NEEDS_REVIEW"
	| "REJECT"
	| "EDIT";

export type CandidateReviewState =
	| "AI_DRAFT"
	| "SOURCE_VERIFIED"
	| "HUMAN_VERIFIED"
	| "REVIEW_REQUIRED"
	| "REJECTED";

export type ReviewCandidateInput = {
	actorId: string;
	runId: string;
	candidateId: string;
	action: CandidateReviewAction;
	newInterpretation: string | null;
};

export type MergeCandidatesInput = {
	actorId: string;
	runId: string;
	candidateIds: string[];
	interpretation: string;
};

export type SplitCandidateInput = {
	actorId: string;
	runId: string;
	candidateId: string;
	parts: Array<{
		interpretation: string;
		sourceSpanOrdinals: number[];
	}>;
};

type ReviewCandidateResult = {
	candidateId: string;
	provenanceState: string;
};

type MergeCandidatesResult = {
	candidateId: string;
};

type SplitCandidatesResult = {
	candidateIds: string[];
};

function isReviewResult(value: unknown): value is ReviewCandidateResult {
	return (
		value !== null &&
		typeof value === "object" &&
		typeof (value as Record<string, unknown>).candidateId === "string" &&
		typeof (value as Record<string, unknown>).provenanceState === "string"
	);
}

function isMergeResult(value: unknown): value is MergeCandidatesResult {
	return (
		value !== null &&
		typeof value === "object" &&
		typeof (value as Record<string, unknown>).candidateId === "string"
	);
}

function isSplitResult(value: unknown): value is SplitCandidatesResult {
	const ids = (value as Record<string, unknown> | null)?.candidateIds;
	return (
		value !== null &&
		typeof value === "object" &&
		Array.isArray(ids) &&
		ids.length > 0 &&
		ids.every((id) => typeof id === "string")
	);
}

export async function reviewTrustedRequirementCandidate(
	input: ReviewCandidateInput,
): Promise<ReviewCandidateResult> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("review_requirement_candidate", {
		p_actor_id: input.actorId,
		p_run_id: input.runId,
		p_candidate_id: input.candidateId,
		p_action: input.action,
		p_new_interpretation: input.newInterpretation,
	});

	if (error || !isReviewResult(data)) {
		throw new Error("Trusted requirement review failed.");
	}
	return data;
}

export async function mergeTrustedRequirementCandidates(
	input: MergeCandidatesInput,
): Promise<MergeCandidatesResult> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("merge_requirement_candidates", {
		p_actor_id: input.actorId,
		p_run_id: input.runId,
		p_candidate_ids: input.candidateIds,
		p_interpretation: input.interpretation,
	});

	if (error || !isMergeResult(data)) {
		throw new Error("Trusted requirement review failed.");
	}
	return { candidateId: data.candidateId };
}

export async function splitTrustedRequirementCandidate(
	input: SplitCandidateInput,
): Promise<SplitCandidatesResult> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("split_requirement_candidate", {
		p_actor_id: input.actorId,
		p_run_id: input.runId,
		p_candidate_id: input.candidateId,
		p_parts: input.parts,
	});

	if (error || !isSplitResult(data)) {
		throw new Error("Trusted requirement review failed.");
	}
	return { candidateIds: data.candidateIds };
}

export type CreateBaselineInput = {
	actorId: string;
	runId: string;
};

export type CreateBaselineResult = {
	baselineId: string;
	version: number;
	contentSha256: string;
	candidateCount: number;
};

export type CreateProposalResult = never;
function isBaselineResult(value: unknown): value is CreateBaselineResult {
	if (value === null || typeof value !== "object") {
		return false;
	}
	const record = value as Record<string, unknown>;
	return (
		typeof record.baselineId === "string" &&
		typeof record.version === "number" &&
		typeof record.contentSha256 === "string" &&
		typeof record.candidateCount === "number"
	);
}


export async function createTrustedRequirementBaseline(
	input: CreateBaselineInput,
): Promise<CreateBaselineResult> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("create_requirement_baseline", {
		p_actor_id: input.actorId,
		p_run_id: input.runId,
	});

	if (error || !isBaselineResult(data)) {
		throw new Error("Trusted requirement baseline failed.");
	}
	return data;
}

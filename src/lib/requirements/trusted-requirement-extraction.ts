import "server-only";

import type { PrivacyClassification } from "../documents/rfp-original";
import { createTrustedSupabaseClient } from "../supabase/trusted-server";
import type {
	AiUsage,
	ExtractionPolicyDecision,
	RequirementExtractionErrorCode,
} from "./requirement-extraction";
import type { PersistableRequirementCandidate } from "./requirement-output";

export type PersistRequirementExtractionInput = {
	actorId: string;
	documentParseId: string;
	privacyClassification: Extract<
		PrivacyClassification,
		"PUBLIC" | "INTERNAL"
	>;
	provider: "OPENAI";
	model: string;
	policyVersion: string;
	promptVersion: string;
	schemaVersion: string;
	parseResultSha256: string;
	canonicalInputSha256: string;
	fingerprintSha256: string;
	acceptedOutputSha256: string;
	providerResponseId: string | null;
	usage: AiUsage;
	candidates: PersistableRequirementCandidate[];
};

export type RecordRequirementExtractionOutcomeInput = {
	actorId: string;
	documentParseId: string;
	policyDecision: ExtractionPolicyDecision;
	outcomeCode:
		| RequirementExtractionErrorCode
		| "POLICY_REVIEW_REQUIRED"
		| "POLICY_BLOCKED";
	fingerprintSha256: string | null;
	provider: "OPENAI";
	model: string;
	policyVersion: string;
	promptVersion: string;
	schemaVersion: string;
	durationMs: number;
};

type PersistRequirementExtractionResult = {
	runId: string;
	reused: boolean;
};

function isPersistResult(
	value: unknown,
): value is PersistRequirementExtractionResult {
	return (
		value !== null &&
		typeof value === "object" &&
		typeof (value as Record<string, unknown>).runId === "string" &&
		typeof (value as Record<string, unknown>).reused === "boolean"
	);
}

export async function persistTrustedRequirementExtraction(
	input: PersistRequirementExtractionInput,
): Promise<PersistRequirementExtractionResult> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("persist_requirement_extraction", {
		p_actor_id: input.actorId,
		p_document_parse_id: input.documentParseId,
		p_privacy_classification: input.privacyClassification,
		p_provider: input.provider,
		p_model: input.model,
		p_policy_version: input.policyVersion,
		p_prompt_version: input.promptVersion,
		p_schema_version: input.schemaVersion,
		p_parse_result_sha256: input.parseResultSha256,
		p_canonical_input_sha256: input.canonicalInputSha256,
		p_fingerprint_sha256: input.fingerprintSha256,
		p_accepted_output_sha256: input.acceptedOutputSha256,
		p_provider_response_id: input.providerResponseId,
		p_input_tokens: input.usage.inputTokens,
		p_output_tokens: input.usage.outputTokens,
		p_candidates: input.candidates.map((candidate) => ({
			candidateOrder: candidate.candidateOrder,
			officialId: candidate.officialId,
			interpretation: candidate.interpretation,
			type: candidate.type,
			atomicity: candidate.atomicity,
			provenanceState: candidate.provenanceState,
			contentSha256: candidate.contentSha256,
			sources: candidate.sources,
		})),
	});

	if (error || !isPersistResult(data)) {
		throw new Error("Trusted requirement persistence failed.");
	}
	return data;
}

export async function recordTrustedRequirementExtractionOutcome(
	input: RecordRequirementExtractionOutcomeInput,
): Promise<void> {
	const client = createTrustedSupabaseClient();
	const { error } = await client.rpc("record_requirement_extraction_outcome", {
		p_actor_id: input.actorId,
		p_document_parse_id: input.documentParseId,
		p_policy_decision: input.policyDecision,
		p_outcome_code: input.outcomeCode,
		p_fingerprint_sha256: input.fingerprintSha256,
		p_provider: input.provider,
		p_model: input.model,
		p_policy_version: input.policyVersion,
		p_prompt_version: input.promptVersion,
		p_schema_version: input.schemaVersion,
		p_duration_ms: input.durationMs,
	});

	if (error) {
		throw new Error("Trusted requirement outcome recording failed.");
	}
}

import "server-only";

import type { RequirementAiProvider } from "../ai/ai-provider";
import type { PrivacyClassification } from "../documents/rfp-original";
import { decideRequirementExtractionPolicy } from "./privacy-policy";
import {
	REQUIREMENT_POLICY_VERSION,
	REQUIREMENT_PROMPT_VERSION,
	REQUIREMENT_SCHEMA_VERSION,
	RequirementExtractionError,
	type RequirementExtractionErrorCode,
} from "./requirement-extraction";
import {
	buildRequirementExtractionInput,
	type RequirementExtractionInput,
} from "./requirement-extraction-input";
import { validateAndMapRequirementOutput } from "./requirement-output";
import type {
	PersistRequirementExtractionInput,
	RecordRequirementExtractionOutcomeInput,
} from "./trusted-requirement-extraction";

type AllowedPrivacyClassification = Extract<
	PrivacyClassification,
	"PUBLIC" | "INTERNAL"
>;

export type AuthorizedRequirementExtractionInput = Omit<
	RequirementExtractionInput,
	"provider" | "model"
> & {
	actorId: string;
	privacyClassification: unknown;
};

export type FindExistingRunInput = {
	tenantId: string;
	projectId: string;
	documentId: string;
	documentParseId: string;
	fingerprintSha256: string;
};

export type ExtractRequirementsDependencies = {
	provider: RequirementAiProvider;
	findExisting(input: FindExistingRunInput): Promise<string | null>;
	persist(
		input: PersistRequirementExtractionInput,
	): Promise<{ runId: string; reused: boolean }>;
	recordOutcome(input: RecordRequirementExtractionOutcomeInput): Promise<void>;
};

export type ExtractRequirementsResult =
	| { kind: "BLOCKED"; decision: "REVIEW_REQUIRED" | "BLOCK" }
	| { kind: "REUSED"; runId: string }
	| { kind: "CREATED"; runId: string }
	| { kind: "FAILED"; code: RequirementExtractionErrorCode };

function isAllowedPrivacyClassification(
	value: unknown,
): value is AllowedPrivacyClassification {
	return value === "PUBLIC" || value === "INTERNAL";
}

function elapsedMilliseconds(startedAt: number): number {
	return Math.max(0, Date.now() - startedAt);
}

async function recordOutcomeBestEffort(
	input: Omit<RecordRequirementExtractionOutcomeInput, "durationMs">,
	startedAt: number,
	deps: ExtractRequirementsDependencies,
): Promise<void> {
	try {
		await deps.recordOutcome({
			...input,
			durationMs: elapsedMilliseconds(startedAt),
		});
	} catch {
		// A safe audit failure must not replace the primary extraction result.
	}
}

function outcomeBase(
	input: AuthorizedRequirementExtractionInput,
	deps: ExtractRequirementsDependencies,
): Pick<
	RecordRequirementExtractionOutcomeInput,
	| "actorId"
	| "documentParseId"
	| "provider"
	| "model"
	| "policyVersion"
	| "promptVersion"
	| "schemaVersion"
> {
	return {
		actorId: input.actorId,
		documentParseId: input.documentParseId,
		provider: deps.provider.name,
		model: deps.provider.model,
		policyVersion: REQUIREMENT_POLICY_VERSION,
		promptVersion: REQUIREMENT_PROMPT_VERSION,
		schemaVersion: REQUIREMENT_SCHEMA_VERSION,
	};
}

async function failedResult(
	input: AuthorizedRequirementExtractionInput,
	deps: ExtractRequirementsDependencies,
	startedAt: number,
	code: RequirementExtractionErrorCode,
	fingerprintSha256: string | null,
): Promise<ExtractRequirementsResult> {
	await recordOutcomeBestEffort(
		{
			...outcomeBase(input, deps),
			policyDecision: "ALLOW",
			outcomeCode: code,
			fingerprintSha256,
		},
		startedAt,
		deps,
	);
	return { kind: "FAILED", code };
}

export async function extractRequirements(
	input: AuthorizedRequirementExtractionInput,
	deps: ExtractRequirementsDependencies,
): Promise<ExtractRequirementsResult> {
	const startedAt = Date.now();
	const policyDecision = decideRequirementExtractionPolicy(
		input.privacyClassification,
	);

	if (policyDecision !== "ALLOW") {
		await recordOutcomeBestEffort(
			{
				...outcomeBase(input, deps),
				policyDecision,
				outcomeCode:
					policyDecision === "REVIEW_REQUIRED"
						? "POLICY_REVIEW_REQUIRED"
						: "POLICY_BLOCKED",
				fingerprintSha256: null,
			},
			startedAt,
			deps,
		);
		return { kind: "BLOCKED", decision: policyDecision };
	}

	let builtInput: Awaited<ReturnType<typeof buildRequirementExtractionInput>>;
	try {
		builtInput = await buildRequirementExtractionInput({
			tenantId: input.tenantId,
			projectId: input.projectId,
			documentId: input.documentId,
			documentParseId: input.documentParseId,
			parserName: input.parserName,
			parserVersion: input.parserVersion,
			normalizationVersion: input.normalizationVersion,
			parseResultSha256: input.parseResultSha256,
			provider: deps.provider.name,
			model: deps.provider.model,
			spans: input.spans,
		});
	} catch (error) {
		if (error instanceof RequirementExtractionError) {
			return failedResult(input, deps, startedAt, error.code, null);
		}
		throw error;
	}

	let existingRunId: string | null;
	try {
		existingRunId = await deps.findExisting({
			tenantId: input.tenantId,
			projectId: input.projectId,
			documentId: input.documentId,
			documentParseId: input.documentParseId,
			fingerprintSha256: builtInput.fingerprintSha256,
		});
	} catch {
		return failedResult(
			input,
			deps,
			startedAt,
			"PERSIST_FAILED",
			builtInput.fingerprintSha256,
		);
	}
	if (existingRunId !== null) {
		return { kind: "REUSED", runId: existingRunId };
	}

	let providerResult: Awaited<ReturnType<RequirementAiProvider["extract"]>>;
	try {
		providerResult = await deps.provider.extract(builtInput.canonicalInput);
	} catch (error) {
		if (error instanceof RequirementExtractionError) {
			return failedResult(
				input,
				deps,
				startedAt,
				error.code,
				builtInput.fingerprintSha256,
			);
		}
		throw error;
	}

	let mappedOutput: Awaited<ReturnType<typeof validateAndMapRequirementOutput>>;
	try {
		mappedOutput = await validateAndMapRequirementOutput({
			value: providerResult.value,
			spans: input.spans,
		});
	} catch (error) {
		if (error instanceof RequirementExtractionError) {
			return failedResult(
				input,
				deps,
				startedAt,
				error.code,
				builtInput.fingerprintSha256,
			);
		}
		throw error;
	}

	if (!isAllowedPrivacyClassification(input.privacyClassification)) {
		throw new Error("Allowed privacy policy invariant failed.");
	}

	let persisted: { runId: string; reused: boolean };
	try {
		persisted = await deps.persist({
			actorId: input.actorId,
			documentParseId: input.documentParseId,
			privacyClassification: input.privacyClassification,
			provider: deps.provider.name,
			model: deps.provider.model,
			policyVersion: REQUIREMENT_POLICY_VERSION,
			promptVersion: REQUIREMENT_PROMPT_VERSION,
			schemaVersion: REQUIREMENT_SCHEMA_VERSION,
			parseResultSha256: input.parseResultSha256,
			canonicalInputSha256: builtInput.canonicalInputSha256,
			fingerprintSha256: builtInput.fingerprintSha256,
			acceptedOutputSha256: mappedOutput.acceptedOutputSha256,
			providerResponseId: providerResult.providerResponseId,
			usage: providerResult.usage,
			candidates: mappedOutput.candidates,
		});
	} catch {
		return failedResult(
			input,
			deps,
			startedAt,
			"PERSIST_FAILED",
			builtInput.fingerprintSha256,
		);
	}

	return persisted.reused
		? { kind: "REUSED", runId: persisted.runId }
		: { kind: "CREATED", runId: persisted.runId };
}

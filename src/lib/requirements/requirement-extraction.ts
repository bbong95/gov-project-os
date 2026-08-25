export const REQUIREMENT_POLICY_VERSION = "document-privacy-v1";
export const REQUIREMENT_PROMPT_VERSION = "requirement-extraction-v1";
export const REQUIREMENT_SCHEMA_VERSION = "requirement-candidates-v1";

export const REQUIREMENT_EXTRACTION_LIMITS = {
	maxCanonicalInputUtf8Bytes: 1_048_576,
	maxProviderResponseUtf8Bytes: 4_194_304,
	maxCandidates: 500,
	maxOfficialIdChars: 128,
	maxInterpretationUtf8Bytes: 8_192,
	maxSourceSpansPerCandidate: 64,
	maxOutputTokens: 32_768,
} as const;

export const REQUIREMENT_TYPES = [
	"FUNCTIONAL",
	"SYSTEM_CONFIGURATION",
	"PERFORMANCE",
	"INTERFACE",
	"DATA",
	"TEST",
	"SECURITY",
	"QUALITY",
	"CONSTRAINT",
	"PROJECT_MANAGEMENT",
	"PROJECT_SUPPORT",
	"OTHER",
] as const;

export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

export const REQUIREMENT_ATOMICITIES = [
	"ATOMIC",
	"COMPOSITE",
	"REVIEW_REQUIRED",
] as const;

export type RequirementAtomicity = (typeof REQUIREMENT_ATOMICITIES)[number];

export const REQUIREMENT_PROVENANCE_STATES = ["AI_DRAFT"] as const;

export type RequirementProvenanceState =
	(typeof REQUIREMENT_PROVENANCE_STATES)[number];

export type ExtractionPolicyDecision =
	| "ALLOW"
	| "REVIEW_REQUIRED"
	| "BLOCK";

export type AiUsage = {
	inputTokens: number | null;
	outputTokens: number | null;
};

export const REQUIREMENT_EXTRACTION_ERROR_CODES = [
	"AI_INPUT_LIMIT_EXCEEDED",
	"AI_INPUT_INVALID",
	"AI_CONFIG_MISSING",
	"AI_PROVIDER_UNAVAILABLE",
	"AI_PROVIDER_REFUSED",
	"AI_PROVIDER_INCOMPLETE",
	"AI_OUTPUT_INVALID",
	"AI_OUTPUT_LIMIT_EXCEEDED",
	"PERSIST_FAILED",
] as const;

export type RequirementExtractionErrorCode =
	(typeof REQUIREMENT_EXTRACTION_ERROR_CODES)[number];

export class RequirementExtractionError extends Error {
	readonly code: RequirementExtractionErrorCode;

	constructor(code: RequirementExtractionErrorCode) {
		super(code);
		this.name = "RequirementExtractionError";
		this.code = code;
	}
}

export const EVAL_ERROR_TAXONOMY = {
	E01_MISSING_REQUIREMENT: "E01",
	E02_SOURCE_MUTATION: "E02",
	E03_UNSUPPORTED_INFERENCE: "E03",
	E04_FALSE_DUPLICATE: "E04",
	E05_MISSED_DUPLICATE: "E05",
	E06_WRONG_CLASSIFICATION: "E06",
	E07_OVER_SPLIT: "E07",
	E08_OVER_MERGE: "E08",
	E09_WRONG_MAPPING: "E09",
	E10_TRACEABILITY_BREAK: "E10",
	E11_SECURITY_PRIVACY_VIOLATION: "E11",
	E12_ACCESSIBILITY_BLOCKER: "E12",
} as const;

export type EvalErrorCode =
	(typeof EVAL_ERROR_TAXONOMY)[keyof typeof EVAL_ERROR_TAXONOMY];

export type EvalErrorDefinition = {
	code: EvalErrorCode;
	name: string;
	description: string;
};

export const EVAL_ERROR_DEFINITIONS: readonly EvalErrorDefinition[] = [
	{
		code: "E01",
		name: "Missing Requirement",
		description: "A golden source requirement has no extracted candidate.",
	},
	{
		code: "E02",
		name: "Source Mutation",
		description:
			"Stored source text differs from the immutable original span text.",
	},
	{
		code: "E03",
		name: "Unsupported Inference",
		description:
			"A candidate asserts facts without cited source evidence support.",
	},
	{
		code: "E04",
		name: "False Duplicate",
		description:
			"Distinct requirements were merged into one duplicated candidate.",
	},
	{
		code: "E05",
		name: "Missed Duplicate",
		description:
			"The same requirement appears as multiple accepted candidates.",
	},
	{
		code: "E06",
		name: "Wrong Classification",
		description: "Type or atomicity does not match the golden expectation.",
	},
	{
		code: "E07",
		name: "Over-Split",
		description: "One atomic requirement was split into multiple candidates.",
	},
	{
		code: "E08",
		name: "Over-Merge",
		description: "Multiple requirements were merged into one candidate.",
	},
	{
		code: "E09",
		name: "Wrong Mapping",
		description: "A candidate cites the wrong SourceSpan evidence.",
	},
	{
		code: "E10",
		name: "Traceability Break",
		description:
			"A candidate lacks a resolvable link back to immutable source evidence.",
	},
	{
		code: "E11",
		name: "Security/Privacy Policy Violation",
		description:
			"Content outside the allowed privacy policy reached an AI call or output.",
	},
	{
		code: "E12",
		name: "Accessibility Blocker",
		description: "A rendered result blocks keyboard or screen-reader access.",
	},
] as const;

export function evalErrorByCode(code: string): EvalErrorDefinition | null {
	return (
		EVAL_ERROR_DEFINITIONS.find(
			(definition) => definition.code === code,
		) ?? null
	);
}

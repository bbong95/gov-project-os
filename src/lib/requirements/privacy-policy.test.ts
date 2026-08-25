import { describe, expect, it } from "vitest";

import {
	REQUIREMENT_ATOMICITIES,
	REQUIREMENT_EXTRACTION_ERROR_CODES,
	REQUIREMENT_EXTRACTION_LIMITS,
	REQUIREMENT_POLICY_VERSION,
	REQUIREMENT_PROMPT_VERSION,
	REQUIREMENT_PROVENANCE_STATES,
	REQUIREMENT_SCHEMA_VERSION,
	REQUIREMENT_TYPES,
} from "./requirement-extraction";
import { decideRequirementExtractionPolicy } from "./privacy-policy";

describe("decideRequirementExtractionPolicy", () => {
	it.each([
		["PUBLIC", "ALLOW"],
		["INTERNAL", "ALLOW"],
		["PERSONAL", "REVIEW_REQUIRED"],
		["SENSITIVE", "BLOCK"],
		["RESTRICTED", "BLOCK"],
		["UNKNOWN", "BLOCK"],
		[null, "BLOCK"],
	] as const)("maps %j to %s", (value, expected) => {
		expect(decideRequirementExtractionPolicy(value)).toBe(expected);
	});

	it.each([undefined, "public", " internal ", 1, {}, []])(
		"blocks malformed or inferred classification %j",
		(value) => {
			expect(decideRequirementExtractionPolicy(value)).toBe("BLOCK");
		},
	);
});

describe("M08 requirement extraction contract", () => {
	it("keeps the structured candidate vocabulary closed", () => {
		expect(REQUIREMENT_TYPES).toEqual([
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
		]);
		expect(REQUIREMENT_ATOMICITIES).toEqual([
			"ATOMIC",
			"COMPOSITE",
			"REVIEW_REQUIRED",
		]);
		expect(REQUIREMENT_PROVENANCE_STATES).toEqual(["AI_DRAFT"]);
	});

	it("pins versioned safety limits without a silent truncation mode", () => {
		expect({
			policyVersion: REQUIREMENT_POLICY_VERSION,
			promptVersion: REQUIREMENT_PROMPT_VERSION,
			schemaVersion: REQUIREMENT_SCHEMA_VERSION,
			limits: REQUIREMENT_EXTRACTION_LIMITS,
		}).toEqual({
			policyVersion: "document-privacy-v1",
			promptVersion: "requirement-extraction-v1",
			schemaVersion: "requirement-candidates-v1",
			limits: {
				maxCanonicalInputUtf8Bytes: 1_048_576,
				maxProviderResponseUtf8Bytes: 4_194_304,
				maxCandidates: 500,
				maxOfficialIdChars: 128,
				maxInterpretationUtf8Bytes: 8_192,
				maxSourceSpansPerCandidate: 64,
				maxOutputTokens: 32_768,
			},
		});
	});

	it("keeps every fail-closed boundary error representable", () => {
		expect(REQUIREMENT_EXTRACTION_ERROR_CODES).toEqual([
			"AI_INPUT_LIMIT_EXCEEDED",
			"AI_INPUT_INVALID",
			"AI_CONFIG_MISSING",
			"AI_PROVIDER_UNAVAILABLE",
			"AI_PROVIDER_REFUSED",
			"AI_PROVIDER_INCOMPLETE",
			"AI_OUTPUT_INVALID",
			"AI_OUTPUT_LIMIT_EXCEEDED",
			"PERSIST_FAILED",
		]);
	});
});

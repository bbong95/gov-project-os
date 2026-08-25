import type { ExtractionPolicyDecision } from "./requirement-extraction";

export function decideRequirementExtractionPolicy(
	classification: unknown,
): ExtractionPolicyDecision {
	switch (classification) {
		case "PUBLIC":
		case "INTERNAL":
			return "ALLOW";
		case "PERSONAL":
			return "REVIEW_REQUIRED";
		case "SENSITIVE":
		case "RESTRICTED":
		default:
			return "BLOCK";
	}
}

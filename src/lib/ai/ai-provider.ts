import type { AiUsage } from "../requirements/requirement-extraction";

export interface RequirementAiProvider {
	readonly name: "OPENAI";
	readonly model: string;
	extract(canonicalInput: string): Promise<{
		providerResponseId: string | null;
		value: unknown;
		usage: AiUsage;
	}>;
}

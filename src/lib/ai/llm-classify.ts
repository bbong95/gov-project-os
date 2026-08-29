import "server-only";

import {
	dispatchResponses,
	type DispatchOptions,
	type ResponsesRequest,
	type ResponsesResult,
} from "./dispatch";
import type { RequirementKind, RiskSeverity } from "./llm-types";

export type ClassificationInput = {
	requirementText: string;
	projectType: "SW" | "CLOUD" | "DR" | "ISP" | "PMO" | "OPS" | "OTHER";
	promptVersion: string;
	fixtureMode: boolean;
	provider?: DispatchOptions["provider"];
};

export type ClassificationResult = {
	kind: RequirementKind;
	priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
	risk: RiskSeverity;
	justification: string;
	modelFingerprint: string;
};

const REQUIREMENT_KIND_VALUES: RequirementKind[] = [
	"FUNCTIONAL",
	"NON_FUNCTIONAL",
	"INTERFACE",
	"DATA",
	"SECURITY",
	"PERFORMANCE",
	"COMPLIANCE",
	"OPERATIONAL",
	"DELIVERY",
	"OTHER",
];

const PRIORITY_VALUES: Array<ClassificationResult["priority"]> = [
	"CRITICAL",
	"HIGH",
	"NORMAL",
	"LOW",
];

const RISK_VALUES: RiskSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const CLASSIFICATION_SCHEMA = {
	type: "object",
	required: ["kind", "priority", "risk", "justification"],
	additionalProperties: false,
	properties: {
		kind: { type: "string", enum: REQUIREMENT_KIND_VALUES },
		priority: { type: "string", enum: PRIORITY_VALUES },
		risk: { type: "string", enum: RISK_VALUES },
		justification: { type: "string" },
	},
} as const;

export async function classifyRequirementWithLlm(
	input: ClassificationInput,
): Promise<ClassificationResult> {
	const request: ResponsesRequest = {
		model: input.provider === "openai" ? "gpt-5-mini" : "qwen/qwen3.8-27b",
		input: [
			{
				role: "system",
				content: [
					"You classify Korean public-project RFP requirements.",
					`Project type: ${input.projectType}.`,
					"Use only the allowed enum values. Justification must be in Korean and stay under 200 characters.",
				].join(" "),
			},
			{
				role: "user",
				content: `Original requirement text:\n<<<\n${input.requirementText}\n>>>`,
			},
		],
		maxOutputTokens: 220,
		temperature: 0,
		structuredSchema: CLASSIFICATION_SCHEMA as unknown as Record<string, unknown>,
	};
	const result: ResponsesResult = await dispatchResponses(request, {
		model: request.model,
		promptVersion: input.promptVersion,
		fixtureMode: input.fixtureMode,
		provider: input.provider,
	});
	if (result.kind !== "json") {
		throw new Error("classifyRequirementWithLlm: expected JSON response");
	}
	const value = result.value as Record<string, unknown>;
	const kind = REQUIREMENT_KIND_VALUES.find((k) => k === value.kind) ?? "OTHER";
	const priority = PRIORITY_VALUES.find((p) => p === value.priority) ?? "NORMAL";
	const risk = RISK_VALUES.find((r) => r === value.risk) ?? "LOW";
	const justification =
		typeof value.justification === "string" ? value.justification : "";
	return { kind, priority, risk, justification, modelFingerprint: result.modelFingerprint };
}

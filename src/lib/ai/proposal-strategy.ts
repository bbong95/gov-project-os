import "server-only";

import { dispatchResponses, type DispatchOptions, type ResponsesRequest, type ResponsesResult } from "./dispatch";

export type ProposalStrategyInput = {
	projectName: string;
	projectType: "SW" | "CLOUD" | "DR" | "ISP" | "PMO" | "OPS" | "OTHER";
	requirements: Array<{ externalId: string; title: string }>;
	evaluationItems: Array<{ externalId: string; category: string; title: string; maxScore: number }>;
	promptVersion: string;
	fixtureMode: boolean;
	provider?: DispatchOptions["provider"];
};

export type ComplianceEntry = {
	requirementExternalId: string;
	evaluationItemExternalId: string | null;
	proposalSectionKey: string;
	status: "ADDRESSED" | "PARTIAL" | "PLANNED" | "GAP";
	notes: string;
};

export type WinningPoint = {
	theme: string;
	rationale: string;
	targetEvaluationItems: string[];
};

export type ProposalStrategy = {
	complianceMatrix: ComplianceEntry[];
	winningPoints: WinningPoint[];
	proposedSections: Array<{ sectionKey: string; title: string; outline: string[] }>;
	modelFingerprint: string;
};

const COMPLIANCE_SCHEMA = {
	type: "object",
	required: ["complianceMatrix", "winningPoints", "proposedSections"],
	additionalProperties: false,
	properties: {
		complianceMatrix: {
			type: "array",
			items: {
				type: "object",
				required: [
					"requirementExternalId",
					"proposalSectionKey",
					"status",
					"notes",
				],
				additionalProperties: false,
				properties: {
					requirementExternalId: { type: "string" },
					evaluationItemExternalId: { type: ["string", "null"] },
					proposalSectionKey: { type: "string" },
					status: {
						type: "string",
						enum: ["ADDRESSED", "PARTIAL", "PLANNED", "GAP"],
					},
					notes: { type: "string" },
				},
			},
		},
		winningPoints: {
			type: "array",
			items: {
				type: "object",
				required: ["theme", "rationale", "targetEvaluationItems"],
				additionalProperties: false,
				properties: {
					theme: { type: "string" },
					rationale: { type: "string" },
					targetEvaluationItems: { type: "array", items: { type: "string" } },
				},
			},
		},
		proposedSections: {
			type: "array",
			items: {
				type: "object",
				required: ["sectionKey", "title", "outline"],
				additionalProperties: false,
				properties: {
					sectionKey: { type: "string" },
					title: { type: "string" },
					outline: { type: "array", items: { type: "string" } },
				},
			},
		},
	},
} as const;

const KNOWN_PROPOSAL_SECTIONS = [
	"사업이해도",
	"추진전략",
	"기술방안",
	"사업관리",
	"품질관리",
	"지원체계",
	"기타",
] as const;

export async function draftProposalStrategy(
	input: ProposalStrategyInput,
): Promise<ProposalStrategy> {
	const requirementDigest = input.requirements
		.slice(0, 80)
		.map((r) => `${r.externalId}: ${r.title.slice(0, 80)}`)
		.join("\n");
	const evaluationDigest = input.evaluationItems
		.slice(0, 30)
		.map((e) => `${e.externalId} [${e.category}, ${e.maxScore}점]: ${e.title.slice(0, 80)}`)
		.join("\n");

	const request: ResponsesRequest = {
		model: input.provider === "openai" ? "gpt-5-mini" : "qwen/qwen3.8-27b",
		input: [
			{
				role: "system",
				content: [
					"You are a senior public-sector proposal strategist.",
					`Project: ${input.projectName} (${input.projectType}).`,
					"Map every requirement to a proposal section in `complianceMatrix`.",
					"For every evaluation category, recommend a winning point that maximises the score.",
					"Output ONLY the JSON object matching the schema. Every Korean proposal section key must be one of: " +
						KNOWN_PROPOSAL_SECTIONS.join(", "),
				].join(" "),
			},
			{
				role: "user",
				content: [
					`# Requirements (${input.requirements.length} total):`,
					requirementDigest,
					`# Evaluation items (${input.evaluationItems.length} total):`,
					evaluationDigest,
				].join("\n\n"),
			},
		],
		maxOutputTokens: 2400,
		temperature: 0,
		structuredSchema: COMPLIANCE_SCHEMA as unknown as Record<string, unknown>,
	};
	const result: ResponsesResult = await dispatchResponses(request, {
		model: request.model,
		promptVersion: input.promptVersion,
		fixtureMode: input.fixtureMode,
		provider: input.provider,
	});
	if (result.kind !== "json") {
		throw new Error("draftProposalStrategy: expected JSON response");
	}
	const value = result.value as Record<string, unknown>;
	const matrix = Array.isArray(value.complianceMatrix) ? value.complianceMatrix : [];
	const winningPoints = Array.isArray(value.winningPoints) ? value.winningPoints : [];
	const proposedSections = Array.isArray(value.proposedSections) ? value.proposedSections : [];

	return {
		complianceMatrix: matrix
			.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
			.map((row) => ({
				requirementExternalId: String(row.requirementExternalId ?? ""),
				evaluationItemExternalId:
					typeof row.evaluationItemExternalId === "string"
						? row.evaluationItemExternalId
						: null,
				proposalSectionKey: String(row.proposalSectionKey ?? "기타"),
				status: (["ADDRESSED", "PARTIAL", "PLANNED", "GAP"] as const).find(
					(s) => s === row.status,
				) ?? "PLANNED",
				notes: typeof row.notes === "string" ? row.notes : "",
			})),
		winningPoints: winningPoints
			.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
			.map((row) => ({
				theme: String(row.theme ?? ""),
				rationale: String(row.rationale ?? ""),
				targetEvaluationItems: Array.isArray(row.targetEvaluationItems)
					? row.targetEvaluationItems.filter((x): x is string => typeof x === "string")
					: [],
			})),
		proposedSections: proposedSections
			.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
			.map((row) => ({
				sectionKey: String(row.sectionKey ?? "기타"),
				title: String(row.title ?? ""),
				outline: Array.isArray(row.outline)
					? row.outline.filter((x): x is string => typeof x === "string")
					: [],
			})),
		modelFingerprint: result.modelFingerprint,
	};
}

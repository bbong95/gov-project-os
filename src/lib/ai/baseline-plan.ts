import "server-only";

import { dispatchResponses, type DispatchOptions, type ResponsesRequest, type ResponsesResult } from "./dispatch";

export type WbsTaskInput = Array<{
	requirementExternalId: string;
	taskTitle: string;
	startDay: number;
	endDay: number;
	owner: string;
}>;

export type InspectionCriterionInput = {
	requirementExternalId: string;
	deliverableExternalId: string;
	criterion: string;
	method: string;
	acceptance: string;
};

export type BaselinePlanInput = {
	projectName: string;
	projectType: "SW" | "CLOUD" | "DR" | "ISP" | "PMO" | "OPS" | "OTHER";
	projectStartDay: number;
	requirements: Array<{ externalId: string; title: string; priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW" }>;
	deliverables: Array<{ externalId: string; title: string; submissionPhase: string }>;
	promptVersion: string;
	fixtureMode: boolean;
	provider?: DispatchOptions["provider"];
};

export type BaselinePlan = {
	wbs: WbsTaskInput;
	inspectionCriteria: InspectionCriterionInput[];
	modelFingerprint: string;
};

const BASELINE_SCHEMA = {
	type: "object",
	required: ["wbs", "inspectionCriteria"],
	additionalProperties: false,
	properties: {
		wbs: {
			type: "array",
			items: {
				type: "object",
				required: ["requirementExternalId", "taskTitle", "startDay", "endDay", "owner"],
				additionalProperties: false,
				properties: {
					requirementExternalId: { type: "string" },
					taskTitle: { type: "string" },
					startDay: { type: "integer" },
					endDay: { type: "integer" },
					owner: { type: "string" },
				},
			},
		},
		inspectionCriteria: {
			type: "array",
			items: {
				type: "object",
				required: [
					"requirementExternalId",
					"deliverableExternalId",
					"criterion",
					"method",
					"acceptance",
				],
				additionalProperties: false,
				properties: {
					requirementExternalId: { type: "string" },
					deliverableExternalId: { type: "string" },
					criterion: { type: "string" },
					method: { type: "string" },
					acceptance: { type: "string" },
				},
			},
		},
	},
} as const;

export async function draftBaselinePlan(
	input: BaselinePlanInput,
): Promise<BaselinePlan> {
	const requirementDigest = input.requirements
		.slice(0, 50)
		.map((r) => `${r.externalId} [${r.priority}]: ${r.title.slice(0, 80)}`)
		.join("\n");
	const deliverableDigest = input.deliverables
		.slice(0, 30)
		.map((d) => `${d.externalId} [${d.submissionPhase}]: ${d.title.slice(0, 80)}`)
		.join("\n");

	const request: ResponsesRequest = {
		model: input.provider === "openai" ? "gpt-5-mini" : "qwen/qwen3.8-27b",
		input: [
			{
				role: "system",
				content: [
					"You are a senior public-sector project manager.",
					`Project: ${input.projectName} (${input.projectType}). Project starts on day ${input.projectStartDay}.`,
					"Build a WBS that covers every requirement and an inspection criterion per (requirement, deliverable) pair.",
					"startDay and endDay are integer day offsets from project start. endDay >= startDay. owner is a role label.",
					"criterion must be observable in under 5 minutes; method must be executable; acceptance must be a clear pass/fail.",
					"Output ONLY the JSON object matching the schema.",
				].join(" "),
			},
			{
				role: "user",
				content: [
					`# Requirements (${input.requirements.length} total):`,
					requirementDigest,
					`# Deliverables (${input.deliverables.length} total):`,
					deliverableDigest,
				].join("\n\n"),
			},
		],
		maxOutputTokens: 2200,
		temperature: 0,
		structuredSchema: BASELINE_SCHEMA as unknown as Record<string, unknown>,
	};
	const result: ResponsesResult = await dispatchResponses(request, {
		model: request.model,
		promptVersion: input.promptVersion,
		fixtureMode: input.fixtureMode,
		provider: input.provider,
	});
	if (result.kind !== "json") {
		throw new Error("draftBaselinePlan: expected JSON response");
	}
	const value = result.value as Record<string, unknown>;
	const wbs = Array.isArray(value.wbs) ? value.wbs : [];
	const inspectionCriteria = Array.isArray(value.inspectionCriteria) ? value.inspectionCriteria : [];

	return {
		wbs: wbs
			.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
			.map((row) => ({
				requirementExternalId: String(row.requirementExternalId ?? ""),
				taskTitle: String(row.taskTitle ?? ""),
				startDay: Number(row.startDay ?? 0),
				endDay: Number(row.endDay ?? 0),
				owner: String(row.owner ?? ""),
			})),
		inspectionCriteria: inspectionCriteria
			.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
			.map((row) => ({
				requirementExternalId: String(row.requirementExternalId ?? ""),
				deliverableExternalId: String(row.deliverableExternalId ?? ""),
				criterion: String(row.criterion ?? ""),
				method: String(row.method ?? ""),
				acceptance: String(row.acceptance ?? ""),
			})),
		modelFingerprint: result.modelFingerprint,
	};
}

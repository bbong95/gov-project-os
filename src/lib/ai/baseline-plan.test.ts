// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { draftBaselinePlan } from "./baseline-plan";

type GoldenRow = {
	projectName: string;
	projectType: "SW" | "CLOUD" | "DR" | "ISP" | "PMO" | "OPS" | "OTHER";
	projectStartDay: number;
	requirements: Array<{ externalId: string; title: string; priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW" }>;
	deliverables: Array<{ externalId: string; title: string; submissionPhase: string }>;
	expectedWbsRows: number;
	expectedInspectionCriteria: number;
};

const GOLDEN_PATH = resolve(process.cwd(), "evals/golden/baseline-plan.jsonl");

function loadGolden(): GoldenRow[] {
	const text = readFileSync(GOLDEN_PATH, "utf8");
	const rows: GoldenRow[] = [];
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		rows.push(JSON.parse(trimmed) as GoldenRow);
	}
	return rows;
}

function liveProviderConfigured(): boolean {
	return (process.env.GROQ_API_KEY ?? "").length > 0;
}

describe("MVP3 baseline plan (Golden Set, fixture mode)", () => {
	const rows = loadGolden();
	for (const row of rows) {
		it(`drafts a baseline for ${row.projectName}`, async () => {
			const result = await draftBaselinePlan({
				projectName: row.projectName,
				projectType: row.projectType,
				projectStartDay: row.projectStartDay,
				requirements: row.requirements,
				deliverables: row.deliverables,
				promptVersion: "v1",
				fixtureMode: true,
			});
			expect(result.wbs.length).toBeGreaterThanOrEqual(row.expectedWbsRows);
			expect(result.inspectionCriteria.length).toBeGreaterThanOrEqual(row.expectedInspectionCriteria);
			// endDay >= startDay invariant
			for (const task of result.wbs) {
				expect(task.endDay).toBeGreaterThanOrEqual(task.startDay);
			}
			expect(result.modelFingerprint).toMatch(/^fixture@/);
		});
	}
});

describe("MVP3 baseline plan (Golden Set, Groq live)", () => {
	const skip = !liveProviderConfigured();
	const rows = loadGolden();
	const itFn = skip ? it.skip : it;
	for (const row of rows) {
		itFn(`drafts a baseline for ${row.projectName}`, async () => {
			const result = await draftBaselinePlan({
				projectName: row.projectName,
				projectType: row.projectType,
				projectStartDay: row.projectStartDay,
				requirements: row.requirements,
				deliverables: row.deliverables,
				promptVersion: "v1-groq",
				fixtureMode: false,
				provider: "groq",
			});
			expect(result.wbs.length).toBeGreaterThan(0);
			expect(result.inspectionCriteria.length).toBeGreaterThan(0);
			expect(result.modelFingerprint).toMatch(/^groq:qwen\/qwen3\.8-27b@/);
		});
	}
});

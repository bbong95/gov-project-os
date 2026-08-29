// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { draftProposalStrategy } from "./proposal-strategy";

type GoldenRow = {
	projectName: string;
	projectType: "SW" | "CLOUD" | "DR" | "ISP" | "PMO" | "OPS" | "OTHER";
	requirements: Array<{ externalId: string; title: string }>;
	evaluationItems: Array<{ externalId: string; category: string; title: string; maxScore: number }>;
	expectedComplianceRows: number;
	expectedWinningPoints: number;
};

const GOLDEN_PATH = resolve(process.cwd(), "evals/golden/proposal-strategy.jsonl");

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

describe("MVP2 proposal strategy (Golden Set, fixture mode)", () => {
	const rows = loadGolden();
	for (const row of rows) {
		it(`drafts a strategy for ${row.projectName}`, async () => {
			const result = await draftProposalStrategy({
				projectName: row.projectName,
				projectType: row.projectType,
				requirements: row.requirements,
				evaluationItems: row.evaluationItems,
				promptVersion: "v1",
				fixtureMode: true,
			});
			expect(result.complianceMatrix.length).toBeGreaterThanOrEqual(row.expectedComplianceRows);
			expect(result.winningPoints.length).toBeGreaterThanOrEqual(row.expectedWinningPoints);
			expect(result.proposedSections.length).toBeGreaterThan(0);
			expect(result.modelFingerprint).toMatch(/^fixture@/);
		});
	}
});

describe("MVP2 proposal strategy (Golden Set, Groq live)", () => {
	const skip = !liveProviderConfigured();
	const rows = loadGolden();
	const itFn = skip ? it.skip : it;
	for (const row of rows) {
		itFn(`drafts a strategy for ${row.projectName}`, async () => {
			const result = await draftProposalStrategy({
				projectName: row.projectName,
				projectType: row.projectType,
				requirements: row.requirements,
				evaluationItems: row.evaluationItems,
				promptVersion: "v1-groq",
				fixtureMode: false,
				provider: "groq",
			});
			expect(result.complianceMatrix.length).toBeGreaterThan(0);
			expect(result.winningPoints.length).toBeGreaterThan(0);
			expect(result.modelFingerprint).toMatch(/^groq:qwen\/qwen3\.8-27b@/);
		});
	}
});

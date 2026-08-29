// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifyRequirementWithLlm } from "./llm-classify";

type GoldenRow = {
	id: string;
	requirementText: string;
	expectedKind: "FUNCTIONAL" | "NON_FUNCTIONAL" | "INTERFACE" | "DATA" | "SECURITY" | "PERFORMANCE" | "COMPLIANCE" | "OPERATIONAL" | "DELIVERY" | "OTHER";
	expectedPriority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
	projectType: "SW" | "CLOUD" | "DR" | "ISP" | "PMO" | "OPS" | "OTHER";
};

const GOLDEN_PATH = resolve(process.cwd(), "evals/golden/requirement-classification.jsonl");

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

describe("LLM requirement classifier (Golden Set, fixture mode)", () => {
	const rows = loadGolden();
	for (const row of rows) {
		it(`classifies ${row.id} (${row.expectedKind}/${row.expectedPriority})`, async () => {
			const r = await classifyRequirementWithLlm({
				requirementText: row.requirementText,
				projectType: row.projectType,
				promptVersion: "v1",
				fixtureMode: true,
			});
			expect(r.kind).toBe(row.expectedKind);
			expect(r.priority).toBe(row.expectedPriority);
			expect(r.modelFingerprint).toMatch(/^fixture@/);
		});
	}
});

// Live Groq test — runs only when GROQ_API_KEY is configured. Skipped otherwise.
describe("LLM requirement classifier (Golden Set, Groq live)", () => {
	const skip = !liveProviderConfigured();
	const rows = loadGolden();
	const itFn = skip ? it.skip : it;
	for (const row of rows) {
		itFn(`classifies ${row.id} (${row.expectedKind}/${row.expectedPriority})`, async () => {
			const r = await classifyRequirementWithLlm({
				requirementText: row.requirementText,
				projectType: row.projectType,
				promptVersion: "v1-groq",
				fixtureMode: false,
				provider: "groq",
			});
			expect(r.kind).toBe(row.expectedKind);
			expect(r.priority).toBe(row.expectedPriority);
			expect(r.modelFingerprint).toMatch(/^groq:qwen\/qwen3\.8-27b@/);
		});
	}
});

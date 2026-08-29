// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { auditGenomeConsistency } from "./consistency-auditor";
import type { GenomeDetail } from "../genome/project-genome";

// Use a Map keyed by genomeId so multiple sequential tests can hold
// independent fixtures. The mock factory and the audit() helper share
// the same store via plain module-level let bindings.
let currentFixture: GenomeDetail | undefined;
let currentInspectionReqs: Set<string> = new Set();
let currentWbsReqs: Set<string> = new Set();

vi.mock("../genome/project-genome", () => ({
	loadGenome: vi.fn(
		async (): Promise<unknown> => (currentFixture as unknown) ?? null,
	),
}));

vi.mock("../supabase/trusted-server", () => ({
	createTrustedSupabaseClient: () => ({
		from: (table: string) => {
			const rows: Array<Record<string, unknown>> =
				table === "genome_inspection_criteria"
					? Array.from(currentInspectionReqs).map((reqExtId) => ({
							external_id: `${reqExtId}|NONE`,
						}))
					: table === "genome_wbs_tasks"
						? Array.from(currentWbsReqs).map((reqExtId) => ({
								external_id: reqExtId,
							}))
						: [];
			return {
				select: () => ({
					eq: () => Promise.resolve({ data: rows, error: null }),
				}),
			};
		},
	}),
}));

type SetFixtureInput = {
	requirements?: Array<Record<string, unknown>>;
	deliverables?: Array<Record<string, unknown>>;
	risks?: Array<Record<string, unknown>>;
	inspectionRequirementIds?: Set<string>;
	wbsRequirementIds?: Set<string>;
};

function setFixture(input: SetFixtureInput) {
	currentFixture = {
		genome: {
			id: "x",
			stage: "DRAFT",
			summary: null,
			rfp_document_id: null,
			rfp_document_parse_id: null,
			created_at: "",
			updated_at: "",
		},
		requirements: (input.requirements ?? []) as never,
		deliverables: (input.deliverables ?? []) as never,
		evaluationItems: [],
		contractTerms: [],
		risks: (input.risks ?? []) as never,
		auditEvents: [],
	} as unknown as GenomeDetail;
	currentInspectionReqs = input.inspectionRequirementIds ?? new Set<string>();
	currentWbsReqs = input.wbsRequirementIds ?? new Set<string>();
}

async function audit() {
	return auditGenomeConsistency("t", "p", "x");
}

function req(
	externalId: string,
	priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW",
	humanVerified: boolean,
) {
	return {
		id: externalId,
		external_id: externalId,
		title: externalId,
		original_text: externalId,
		normalized_text: externalId,
		requirement_type: "SECURITY",
		atomicity: "ATOMIC",
		priority,
		mandatory: true,
		rfp_page: null,
		human_verified: humanVerified,
		verified_by: null,
		verified_at: null,
	};
}

function del(externalId: string) {
	return {
		id: externalId,
		external_id: externalId,
		title: externalId,
		description: externalId,
		submission_phase: "FINAL",
		mandatory: true,
		rfp_page: null,
	};
}

describe("MVP4 consistency auditor", () => {
	it("flags an unverified requirement as WARN", async () => {
		setFixture({ requirements: [req("NFR-001", "NORMAL", false)] });
		const report = await audit();
		const finding = report.findings.find((f) => f.category === "UNVERIFIED_REQUIREMENT");
		expect(finding).toBeDefined();
		expect(finding?.severity).toBe("WARN");
	});

	it("flags a HIGH-priority requirement without a mapped deliverable as WARN", async () => {
		setFixture({ requirements: [req("SER-001", "HIGH", true)] });
		const report = await audit();
		const finding = report.findings.find(
			(f) => f.category === "MISSING_DELIVERABLE" && f.relatedExternalId === "SER-001",
		);
		expect(finding).toBeDefined();
		expect(finding?.severity).toBe("WARN");
	});

	it("flags a HIGH-priority requirement without inspection as FAIL", async () => {
		setFixture({ requirements: [req("SER-001", "HIGH", true)] });
		const report = await audit();
		const finding = report.findings.find(
			(f) =>
				f.category === "CRITICAL_REQUIREMENT_NO_INSPECTION" && f.relatedExternalId === "SER-001",
		);
		expect(finding).toBeDefined();
		expect(finding?.severity).toBe("FAIL");
	});

	it("does not flag once the requirement is covered", async () => {
		setFixture({
			requirements: [req("SER-001", "HIGH", true)],
			deliverables: [{ ...del("DEL-001"), description: "covers SER-001" }],
			inspectionRequirementIds: new Set(["SER-001"]),
			wbsRequirementIds: new Set(["SER-001"]),
		});
		const report = await audit();
		const findings = report.findings.filter((f) => f.relatedExternalId === "SER-001");
		expect(findings).toEqual([]);
	});

	it("flags CRITICAL risk with empty mitigation as WARN", async () => {
		setFixture({
			risks: [
				{
					id: "r1",
					external_id: "RSK-001",
					severity: "CRITICAL",
					title: "DR fail-over",
					description: "DR site not provisioned",
					mitigation: null,
					rfp_page: null,
				},
			],
		});
		const report = await audit();
		const finding = report.findings.find(
			(f) => f.category === "LOW_PRIORITY_HIGH_SEVERITY_RISK",
		);
		expect(finding).toBeDefined();
		expect(finding?.severity).toBe("WARN");
	});

	it("returns summary text and per-severity counts", async () => {
		setFixture({});
		const report = await audit();
		expect(typeof report.summary).toBe("string");
		expect(report.counts).toMatchObject({
			INFO: expect.any(Number),
			WARN: expect.any(Number),
			FAIL: expect.any(Number),
		});
	});
});

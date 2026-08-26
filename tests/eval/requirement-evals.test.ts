import { describe, expect, it } from "vitest";
import { validateAndMapRequirementOutput } from "../../src/lib/requirements/requirement-output";
import {
	EVAL_ERROR_DEFINITIONS,
	evalErrorByCode,
} from "./error-taxonomy";
import {
	GOLDEN_EXPECTED,
	GOLDEN_EXPECTED_OFFICIAL_IDS,
	GOLDEN_INJECTION_TEXT,
	GOLDEN_PROVIDER_OUTPUT,
	goldenExtractionSpans,
} from "./golden-dataset";
import {
	cardinalityCheck,
	classificationCheck,
	completenessCheck,
	duplicateCandidateCheck,
	evidenceMappingCheck,
	sourceFidelityCheck,
	traceabilityCheck,
	unsupportedAssertionCheck,
} from "./requirement-evals";

async function goldenMapped() {
	return validateAndMapRequirementOutput({
		value: GOLDEN_PROVIDER_OUTPUT,
		spans: goldenExtractionSpans(),
	});
}

describe("M09 eval error taxonomy", () => {
	it("defines the complete E01-E12 taxonomy with unique codes and names", () => {
		expect(EVAL_ERROR_DEFINITIONS).toHaveLength(12);
		const codes = EVAL_ERROR_DEFINITIONS.map((definition) => definition.code);
		expect(new Set(codes).size).toBe(12);
		expect(codes).toEqual(
			["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08", "E09", "E10", "E11", "E12"],
		);
		for (const definition of EVAL_ERROR_DEFINITIONS) {
			expect(definition.name.length).toBeGreaterThan(0);
			expect(definition.description.length).toBeGreaterThan(0);
			expect(evalErrorByCode(definition.code)?.name).toBe(definition.name);
		}
		expect(evalErrorByCode("E99")).toBeNull();
	});
});

describe("M09 requirement evals on the synthetic golden dataset", () => {
	it("passes all six eval checks for the golden provider output", async () => {
		const mapped = await goldenMapped();
		const spans = goldenExtractionSpans();

		expect(completenessCheck(mapped, GOLDEN_EXPECTED).passed).toBe(true);
		expect(sourceFidelityCheck(mapped, spans).passed).toBe(true);
		expect(
			unsupportedAssertionCheck(GOLDEN_PROVIDER_OUTPUT, spans).passed,
		).toBe(true);
		expect(duplicateCandidateCheck(mapped).passed).toBe(true);
		expect(classificationCheck(mapped, GOLDEN_EXPECTED).passed).toBe(true);
		expect(cardinalityCheck(mapped, GOLDEN_EXPECTED).passed).toBe(true);
		expect(evidenceMappingCheck(mapped, GOLDEN_EXPECTED).passed).toBe(true);
		expect(traceabilityCheck(mapped, spans).passed).toBe(true);
		expect(GOLDEN_EXPECTED_OFFICIAL_IDS).toEqual(["SER-001", "PMR-001", "PSR-001"]);
	});

	it("detects a missing requirement as E01", async () => {
		const mapped = await goldenMapped();
		const result = completenessCheck(mapped, [
			...GOLDEN_EXPECTED,
			{
				officialId: "XXX-999",
				type: "FUNCTIONAL",
				atomicity: "ATOMIC",
				citedOrdinals: [1],
			},
		]);
		expect(result.passed).toBe(false);
		expect(result.error?.code).toBe("E01");
		expect(result.details).toContain("XXX-999");
	});

	it("detects source mutation as E02", async () => {
		const mapped = await goldenMapped();
		const mutated = {
			...mapped,
			candidates: mapped.candidates.map((candidate, index) =>
				index === 0
					? { ...candidate, sourceText: candidate.sourceText + " (변조)" }
					: candidate,
			),
		};
		const result = sourceFidelityCheck(mutated, goldenExtractionSpans());
		expect(result.passed).toBe(false);
		expect(result.error?.code).toBe("E02");
	});

	it("detects an unsupported official ID assertion as E03", () => {
		const spans = goldenExtractionSpans();
		const result = unsupportedAssertionCheck(
			{
				candidates: [
					{
						officialId: "FAKE-001",
						interpretation: "근거 없는 주장",
						type: "FUNCTIONAL",
						atomicity: "ATOMIC",
						sourceSpanOrdinals: [1],
					},
				],
			},
			spans,
		);
		expect(result.passed).toBe(false);
		expect(result.error?.code).toBe("E03");
	});

	it("detects duplicated candidates as E05", async () => {
		const mapped = await goldenMapped();
		const first = mapped.candidates[0]!;
		const duplicated = {
			...mapped,
			candidates: [first, { ...first, candidateOrder: 2 }],
		};
		const result = duplicateCandidateCheck(duplicated);
		expect(result.passed).toBe(false);
		expect(result.error?.code).toBe("E05");
	});

	it("detects wrong classification as E06", async () => {
		const mapped = await goldenMapped();
		const misclassified = {
			...mapped,
			candidates: mapped.candidates.map((candidate, index) =>
				index === 0 ? { ...candidate, type: "OTHER" as const } : candidate,
			),
		};
		const result = classificationCheck(misclassified, GOLDEN_EXPECTED);
		expect(result.passed).toBe(false);
		expect(result.error?.code).toBe("E06");
	});

	it("detects over-split and over-merge cardinality as E07 and E08", async () => {
		const mapped = await goldenMapped();
		const first = mapped.candidates[0]!;
		const overSplit = {
			...mapped,
			candidates: [
				...mapped.candidates,
				{ ...first, candidateOrder: mapped.candidates.length + 1 },
			],
		};
		expect(cardinalityCheck(overSplit, GOLDEN_EXPECTED).error?.code).toBe("E07");

		const overMerged = { ...mapped, candidates: [first] };
		expect(cardinalityCheck(overMerged, GOLDEN_EXPECTED).error?.code).toBe("E08");
	});

	it("detects wrong evidence mapping as E09", async () => {
		const mapped = await goldenMapped();
		const wrongMapping = {
			...mapped,
			candidates: mapped.candidates.map((candidate, index) =>
				index === 0
					? {
							...candidate,
							sources: candidate.sources.map((source) => ({
								...source,
								sourceSpanOrdinal: 2,
							})),
						}
					: candidate,
			),
		};
		const result = evidenceMappingCheck(wrongMapping, GOLDEN_EXPECTED);
		expect(result.passed).toBe(false);
		expect(result.error?.code).toBe("E09");
	});

	it("detects a traceability break as E10", async () => {
		const mapped = await goldenMapped();
		const broken = {
			...mapped,
			candidates: mapped.candidates.map((candidate, index) =>
				index === 0
					? {
							...candidate,
							sources: [
								{
									...candidate.sources[0]!,
									sourceSpanId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
								},
							],
						}
					: candidate,
			),
		};
		const result = traceabilityCheck(broken, goldenExtractionSpans());
		expect(result.passed).toBe(false);
		expect(result.error?.code).toBe("E10");
	});

	it("keeps the prompt-injection fixture inert inside golden provider output", async () => {
		const mapped = await goldenMapped();
		const withInjection = await validateAndMapRequirementOutput({
			value: {
				candidates: [
					{
						officialId: null,
						interpretation: GOLDEN_INJECTION_TEXT,
						type: "OTHER",
						atomicity: "REVIEW_REQUIRED",
						sourceSpanOrdinals: [2],
					},
				],
			},
			spans: goldenExtractionSpans(),
		});
		expect(withInjection.candidates[0]!.interpretation).toBe(GOLDEN_INJECTION_TEXT);
		expect(mapped.acceptedOutputSha256).not.toBe(withInjection.acceptedOutputSha256);
	});
});

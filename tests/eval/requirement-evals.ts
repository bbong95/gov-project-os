import type { ExtractionSourceSpan } from "../../src/lib/requirements/requirement-extraction-input";
import type {
	MappedRequirementOutput,
	PersistableRequirementCandidate,
	RawRequirementCandidate,
} from "../../src/lib/requirements/requirement-output";
import type { GoldenExpectedCandidate } from "./golden-dataset";
import type { EvalErrorDefinition } from "./error-taxonomy";

type EvalCheck = {
	id: string;
	passed: boolean;
};

export type EvalCheckResult = EvalCheck & {
	error?: EvalErrorDefinition;
	details?: string;
};

function check(
	id: string,
	passed: boolean,
	error: EvalErrorDefinition,
	details?: string,
): EvalCheckResult {
	return passed ? { id, passed: true } : { id, passed: false, error, details };
}

/**
 * E01 — every golden requirement appears exactly once as a candidate.
 */
export function completenessCheck(
	mapped: MappedRequirementOutput,
	expected: readonly GoldenExpectedCandidate[],
): EvalCheckResult {
	const mappedIds = new Set(
		mapped.candidates
			.map((candidate) => candidate.officialId)
			.filter((id): id is string => id !== null),
	);
	const missing = expected
		.map((item) => item.officialId)
		.filter((officialId) => !mappedIds.has(officialId));
	return check(
		"completeness",
		missing.length === 0,
		{ code: "E01", name: "Missing Requirement", description: "A golden source requirement has no extracted candidate." },
		missing.length > 0 ? "missing: " + missing.join(", ") : undefined,
	);
}

/**
 * E02 — stored source text is byte-identical to the cited immutable originals.
 */
export function sourceFidelityCheck(
	mapped: MappedRequirementOutput,
	spans: readonly ExtractionSourceSpan[],
): EvalCheckResult {
	const spanById = new Map(spans.map((span) => [span.id, span]));
	for (const candidate of mapped.candidates) {
		const joined = candidate.sources
			.map((source) => spanById.get(source.sourceSpanId)?.originalText ?? null)
			.map((text) => text ?? "\u0000-missing-span-\u0000")
			.join("\n\n");
		if (joined !== candidate.sourceText) {
			return check(
				"source-fidelity",
				false,
				{ code: "E02", name: "Source Mutation", description: "Stored source text differs from the immutable original span text." },
				"candidate " + candidate.candidateOrder + " source text mutated",
			);
		}
	}
	return check("source-fidelity", true, {
		code: "E02",
		name: "Source Mutation",
		description: "Stored source text differs from the immutable original span text.",
	});
}

/**
 * E03 — no candidate cites evidence that fails to support its official ID,
 * evaluated against the raw provider output before mapping.
 */
export function unsupportedAssertionCheck(
	raw: { candidates: RawRequirementCandidate[] },
	spans: readonly ExtractionSourceSpan[],
): EvalCheckResult {
	const spansByOrdinal = new Map(spans.map((span) => [span.ordinal, span]));
	for (const candidate of raw.candidates) {
		const officialId = candidate.officialId;
		if (officialId === null) {
			continue;
		}
		const supported = candidate.sourceSpanOrdinals.some((ordinal) =>
			(spansByOrdinal.get(ordinal)?.originalText ?? "").includes(officialId),
		);
		if (!supported) {
			return check(
				"unsupported-assertion",
				false,
				{ code: "E03", name: "Unsupported Inference", description: "A candidate asserts facts without cited source evidence support." },
				"officialId " + candidate.officialId + " not present in cited originals",
			);
		}
	}
	return check("unsupported-assertion", true, {
		code: "E03",
		name: "Unsupported Inference",
		description: "A candidate asserts facts without cited source evidence support.",
	});
}

/**
 * E04/E05 — no duplicated officialId and no duplicated evidence set.
 */
export function duplicateCandidateCheck(
	mapped: MappedRequirementOutput,
): EvalCheckResult {
	const seenOfficialIds = new Set<string>();
	const seenEvidenceKeys = new Set<string>();
	for (const candidate of mapped.candidates) {
		if (candidate.officialId !== null) {
			if (seenOfficialIds.has(candidate.officialId)) {
				return check(
					"duplicate-candidate",
					false,
					{ code: "E05", name: "Missed Duplicate", description: "The same requirement appears as multiple accepted candidates." },
					"duplicate officialId " + candidate.officialId,
				);
			}
			seenOfficialIds.add(candidate.officialId);
		}
		const evidenceKey = candidate.sources
			.map((source) => source.sourceSpanOrdinal)
			.join("+");
		if (seenEvidenceKeys.has(evidenceKey)) {
			return check(
				"duplicate-candidate",
				false,
				{ code: "E04", name: "False Duplicate", description: "Distinct requirements were merged into one duplicated candidate." },
				"duplicate evidence set " + evidenceKey,
			);
		}
		seenEvidenceKeys.add(evidenceKey);
	}
	return check("duplicate-candidate", true, {
		code: "E04",
		name: "False Duplicate",
		description: "Distinct requirements were merged into one duplicated candidate.",
	});
}

/**
 * E06 — type and atomicity match the golden expectation per official ID.
 */
export function classificationCheck(
	mapped: MappedRequirementOutput,
	expected: readonly GoldenExpectedCandidate[],
): EvalCheckResult {
	const expectedByOfficialId = new Map(
		expected.map((item) => [item.officialId, item]),
	);
	for (const candidate of mapped.candidates) {
		if (candidate.officialId === null) {
			continue;
		}
		const expectation = expectedByOfficialId.get(candidate.officialId);
		if (!expectation) {
			continue;
		}
		if (
			candidate.type !== expectation.type ||
			candidate.atomicity !== expectation.atomicity
		) {
			return check(
				"classification",
				false,
				{ code: "E06", name: "Wrong Classification", description: "Type or atomicity does not match the golden expectation." },
				"officialId " +
					candidate.officialId +
					" got " +
					candidate.type +
					"/" +
					candidate.atomicity,
			);
		}
	}
	return check("classification", true, {
		code: "E06",
		name: "Wrong Classification",
		description: "Type or atomicity does not match the golden expectation.",
	});
}

/**
 * E07/E08 — candidate count matches the golden expectation exactly.
 */
export function cardinalityCheck(
	mapped: MappedRequirementOutput,
	expected: readonly GoldenExpectedCandidate[],
): EvalCheckResult {
	if (mapped.candidates.length > expected.length) {
		return check(
			"cardinality",
			false,
			{ code: "E07", name: "Over-Split", description: "One atomic requirement was split into multiple candidates." },
			"candidates " + mapped.candidates.length + " > expected " + expected.length,
		);
	}
	if (mapped.candidates.length < expected.length) {
		return check(
			"cardinality",
			false,
			{ code: "E08", name: "Over-Merge", description: "Multiple requirements were merged into one candidate." },
			"candidates " + mapped.candidates.length + " < expected " + expected.length,
		);
	}
	return check("cardinality", true, {
		code: "E07",
		name: "Over-Split",
		description: "One atomic requirement was split into multiple candidates.",
	});
}

/**
 * E09 — each candidate cites exactly the golden-cited ordinals.
 */
export function evidenceMappingCheck(
	mapped: MappedRequirementOutput,
	expected: readonly GoldenExpectedCandidate[],
): EvalCheckResult {
	const expectedByOfficialId = new Map(
		expected.map((item) => [item.officialId, item]),
	);
	for (const candidate of mapped.candidates as PersistableRequirementCandidate[]) {
		if (candidate.officialId === null) {
			continue;
		}
		const expectation = expectedByOfficialId.get(candidate.officialId);
		if (!expectation) {
			continue;
		}
		const citedOrdinals = candidate.sources
			.map((source) => source.sourceSpanOrdinal)
			.slice()
			.sort((left, right) => left - right);
		const expectedOrdinals = expectation.citedOrdinals
			.slice()
			.sort((left, right) => left - right);
		if (
			citedOrdinals.length !== expectedOrdinals.length ||
			citedOrdinals.some((ordinal, index) => ordinal !== expectedOrdinals[index])
		) {
			return check(
				"evidence-mapping",
				false,
				{ code: "E09", name: "Wrong Mapping", description: "A candidate cites the wrong SourceSpan evidence." },
				"officialId " + candidate.officialId + " cites " + citedOrdinals.join(","),
			);
		}
	}
	return check("evidence-mapping", true, {
		code: "E09",
		name: "Wrong Mapping",
		description: "A candidate cites the wrong SourceSpan evidence.",
	});
}

/**
 * E10 — every candidate has at least one resolvable immutable evidence link.
 */
export function traceabilityCheck(
	mapped: MappedRequirementOutput,
	spans: readonly ExtractionSourceSpan[],
): EvalCheckResult {
	const spanIds = new Set(spans.map((span) => span.id));
	for (const candidate of mapped.candidates) {
		if (
			candidate.sources.length === 0 ||
			candidate.sources.some((source) => !spanIds.has(source.sourceSpanId))
		) {
			return check(
				"traceability",
				false,
				{ code: "E10", name: "Traceability Break", description: "A candidate lacks a resolvable link back to immutable source evidence." },
				"candidate " + candidate.candidateOrder + " has unresolvable evidence",
			);
		}
	}
	return check("traceability", true, {
		code: "E10",
		name: "Traceability Break",
		description: "A candidate lacks a resolvable link back to immutable source evidence.",
	});
}

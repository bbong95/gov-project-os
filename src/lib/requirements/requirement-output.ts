import { sha256Hex } from "../documents/rfp-original";
import type { ExtractionSourceSpan } from "./requirement-extraction-input";
import {
	REQUIREMENT_ATOMICITIES,
	REQUIREMENT_EXTRACTION_LIMITS,
	REQUIREMENT_TYPES,
	RequirementExtractionError,
	type RequirementAtomicity,
	type RequirementType,
} from "./requirement-extraction";

const UTF8_ENCODER = new TextEncoder();
const ROOT_KEYS = ["candidates"] as const;
const CANDIDATE_KEYS = [
	"officialId",
	"interpretation",
	"type",
	"atomicity",
	"sourceSpanOrdinals",
] as const;

export type RawRequirementCandidate = {
	officialId: string | null;
	interpretation: string;
	type: RequirementType;
	atomicity: RequirementAtomicity;
	sourceSpanOrdinals: number[];
};

export type PersistableRequirementCandidate = {
	candidateOrder: number;
	officialId: string | null;
	sourceText: string;
	interpretation: string;
	type: RequirementType;
	atomicity: RequirementAtomicity;
	provenanceState: "AI_DRAFT";
	contentSha256: string;
	sources: Array<{
		sourceSpanId: string;
		sourceSpanOrdinal: number;
		sourceOrder: number;
	}>;
};

export type MappedRequirementOutput = {
	candidates: PersistableRequirementCandidate[];
	acceptedOutputSha256: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
): boolean {
	const keys = Object.keys(value);
	return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function invalidOutput(): never {
	throw new RequirementExtractionError("AI_OUTPUT_INVALID");
}

function outputLimitExceeded(): never {
	throw new RequirementExtractionError("AI_OUTPUT_LIMIT_EXCEEDED");
}

function isRequirementType(value: unknown): value is RequirementType {
	return (
		typeof value === "string" &&
		(REQUIREMENT_TYPES as readonly string[]).includes(value)
	);
}

function isRequirementAtomicity(value: unknown): value is RequirementAtomicity {
	return (
		typeof value === "string" &&
		(REQUIREMENT_ATOMICITIES as readonly string[]).includes(value)
	);
}

function validateCandidate(value: unknown): RawRequirementCandidate {
	if (!isRecord(value) || !hasExactKeys(value, CANDIDATE_KEYS)) {
		return invalidOutput();
	}

	const { officialId, interpretation, type, atomicity, sourceSpanOrdinals } = value;
	if (
		!(
			officialId === null ||
			(typeof officialId === "string" && officialId.trim().length > 0)
		) ||
		typeof interpretation !== "string" ||
		!/\S/u.test(interpretation) ||
		!isRequirementType(type) ||
		!isRequirementAtomicity(atomicity) ||
		!Array.isArray(sourceSpanOrdinals)
	) {
		return invalidOutput();
	}
	if (
		(typeof officialId === "string" &&
			Array.from(officialId).length > REQUIREMENT_EXTRACTION_LIMITS.maxOfficialIdChars) ||
		UTF8_ENCODER.encode(interpretation).byteLength >
			REQUIREMENT_EXTRACTION_LIMITS.maxInterpretationUtf8Bytes ||
		sourceSpanOrdinals.length >
			REQUIREMENT_EXTRACTION_LIMITS.maxSourceSpansPerCandidate
	) {
		return outputLimitExceeded();
	}
	if (
		sourceSpanOrdinals.length === 0 ||
		sourceSpanOrdinals.some(
			(ordinal) => !Number.isInteger(ordinal) || ordinal <= 0,
		) ||
		new Set(sourceSpanOrdinals).size !== sourceSpanOrdinals.length
	) {
		return invalidOutput();
	}

	return {
		officialId,
		interpretation,
		type,
		atomicity,
		sourceSpanOrdinals,
	};
}

export async function validateAndMapRequirementOutput(input: {
	value: unknown;
	spans: readonly ExtractionSourceSpan[];
}): Promise<MappedRequirementOutput> {
	if (!isRecord(input.value) || !hasExactKeys(input.value, ROOT_KEYS)) {
		return invalidOutput();
	}
	const rawCandidates = input.value.candidates;
	if (!Array.isArray(rawCandidates)) {
		return invalidOutput();
	}
	if (rawCandidates.length > REQUIREMENT_EXTRACTION_LIMITS.maxCandidates) {
		return outputLimitExceeded();
	}

	const spansByOrdinal = new Map(input.spans.map((span) => [span.ordinal, span]));
	const candidates: PersistableRequirementCandidate[] = [];
	for (const [index, value] of rawCandidates.entries()) {
		const raw = validateCandidate(value);
		const evidence = raw.sourceSpanOrdinals
			.map((ordinal) => spansByOrdinal.get(ordinal))
			.sort((left, right) => (left?.ordinal ?? 0) - (right?.ordinal ?? 0));
		if (evidence.some((span) => span === undefined)) {
			return invalidOutput();
		}
		const citedSpans = evidence as ExtractionSourceSpan[];
		if (
			raw.officialId !== null &&
			!citedSpans.some((span) => span.originalText.includes(raw.officialId as string))
		) {
			return invalidOutput();
		}

		const sources = citedSpans.map((span, sourceIndex) => ({
			sourceSpanId: span.id,
			sourceSpanOrdinal: span.ordinal,
			sourceOrder: sourceIndex + 1,
		}));
		const candidateOrder = index + 1;
		const sourceText = citedSpans.map((span) => span.originalText).join("\n\n");
		const contentForHash = {
			candidateOrder,
			officialId: raw.officialId,
			sourceText,
			interpretation: raw.interpretation,
			type: raw.type,
			atomicity: raw.atomicity,
			provenanceState: "AI_DRAFT" as const,
			sources,
		};
		const contentSha256 = await sha256Hex(
			UTF8_ENCODER.encode(JSON.stringify(contentForHash)).buffer,
		);
		candidates.push({
			candidateOrder,
			officialId: raw.officialId,
			sourceText,
			interpretation: raw.interpretation,
			type: raw.type,
			atomicity: raw.atomicity,
			provenanceState: "AI_DRAFT",
			contentSha256,
			sources,
		});
	}

	const acceptedOutputSha256 = await sha256Hex(
		UTF8_ENCODER.encode(JSON.stringify(candidates)).buffer,
	);
	return { candidates, acceptedOutputSha256 };
}

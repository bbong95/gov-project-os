import { sha256Hex } from "../documents/rfp-original";
import type { SourceLocation } from "../parsing/document-parser";
import { isSourceLocation } from "../parsing/source-span";
import {
	REQUIREMENT_EXTRACTION_LIMITS,
	REQUIREMENT_POLICY_VERSION,
	REQUIREMENT_PROMPT_VERSION,
	REQUIREMENT_SCHEMA_VERSION,
	RequirementExtractionError,
} from "./requirement-extraction";

const UTF8_ENCODER = new TextEncoder();

export type ExtractionSourceSpan = {
	id: string;
	ordinal: number;
	location: SourceLocation;
	originalText: string;
	normalizedText: string;
};

export type RequirementExtractionInput = {
	tenantId: string;
	projectId: string;
	documentId: string;
	documentParseId: string;
	parserName: string;
	parserVersion: string;
	normalizationVersion: string;
	parseResultSha256: string;
	provider: "OPENAI";
	model: string;
	spans: readonly ExtractionSourceSpan[];
};

export type BuiltRequirementExtractionInput = {
	canonicalInput: string;
	canonicalInputSha256: string;
	fingerprintSha256: string;
};

function canonicalLocation(location: SourceLocation): Record<string, unknown> {
	switch (location.kind) {
		case "TEXT_LINES":
			return {
				kind: location.kind,
				lineStart: location.lineStart,
				lineEnd: location.lineEnd,
			};
		case "PAGE": {
			const result: Record<string, unknown> = {
				kind: location.kind,
				pageNumber: location.pageNumber,
			};
			if (location.blockIndex !== undefined) {
				result.blockIndex = location.blockIndex;
			}
			result.pageMode = location.pageMode;
			return result;
		}
		case "SHEET": {
			const result: Record<string, unknown> = {
				kind: location.kind,
				sheetIndex: location.sheetIndex,
			};
			if (location.sheetName !== undefined) {
				result.sheetName = location.sheetName;
			}
			if (location.cellRange !== undefined) {
				result.cellRange = location.cellRange;
			}
			return result;
		}
		case "SECTION": {
			const result: Record<string, unknown> = {
				kind: location.kind,
				sectionIndex: location.sectionIndex,
			};
			if (location.label !== undefined) {
				result.label = location.label;
			}
			if (location.blockIndex !== undefined) {
				result.blockIndex = location.blockIndex;
			}
			return result;
		}
	}
}

function assertTrustedInput(input: RequirementExtractionInput): void {
	if (input.spans.length === 0) {
		throw new RequirementExtractionError("AI_INPUT_INVALID");
	}

	for (const [index, span] of input.spans.entries()) {
		if (
			span.ordinal !== index + 1 ||
			!isSourceLocation(span.location) ||
			!/\S/u.test(span.normalizedText)
		) {
			throw new RequirementExtractionError("AI_INPUT_INVALID");
		}
	}
}

export async function buildRequirementExtractionInput(
	input: RequirementExtractionInput,
): Promise<BuiltRequirementExtractionInput> {
	assertTrustedInput(input);

	const canonicalInput = JSON.stringify({
		schemaVersion: REQUIREMENT_SCHEMA_VERSION,
		parse: {
			parserName: input.parserName,
			parserVersion: input.parserVersion,
			normalizationVersion: input.normalizationVersion,
			resultSha256: input.parseResultSha256,
		},
		sourceSpans: input.spans.map((span) => ({
			ordinal: span.ordinal,
			location: canonicalLocation(span.location),
			normalizedText: span.normalizedText,
		})),
	});
	const canonicalBytes = UTF8_ENCODER.encode(canonicalInput);
	if (
		canonicalBytes.byteLength >
		REQUIREMENT_EXTRACTION_LIMITS.maxCanonicalInputUtf8Bytes
	) {
		throw new RequirementExtractionError("AI_INPUT_LIMIT_EXCEEDED");
	}
	const canonicalInputSha256 = await sha256Hex(canonicalBytes.buffer);
	const fingerprintMaterial = JSON.stringify({
		tenantId: input.tenantId,
		projectId: input.projectId,
		documentId: input.documentId,
		documentParseId: input.documentParseId,
		parseResultSha256: input.parseResultSha256,
		provider: input.provider,
		model: input.model,
		policyVersion: REQUIREMENT_POLICY_VERSION,
		promptVersion: REQUIREMENT_PROMPT_VERSION,
		schemaVersion: REQUIREMENT_SCHEMA_VERSION,
		canonicalInputSha256,
	});
	const fingerprintSha256 = await sha256Hex(
		UTF8_ENCODER.encode(fingerprintMaterial).buffer,
	);

	return {
		canonicalInput,
		canonicalInputSha256,
		fingerprintSha256,
	};
}

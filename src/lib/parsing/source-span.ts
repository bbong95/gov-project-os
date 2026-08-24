import { sha256Hex } from "../documents/rfp-original";
import {
	DocumentParseError,
	PARSER_LIMITS,
	type ParsedSourceSpan,
	type SourceLocation,
} from "./document-parser";

const UTF8_ENCODER = new TextEncoder();

function isPositiveInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function optionalPositiveInteger(value: unknown): boolean {
	return value === undefined || isPositiveInteger(value);
}

function optionalNonBlankString(value: unknown): boolean {
	return value === undefined || (typeof value === "string" && value.trim().length > 0);
}

export function isSourceLocation(value: unknown): value is SourceLocation {
	if (!value || typeof value !== "object") {
		return false;
	}
	const location = value as Record<string, unknown>;
	switch (location.kind) {
		case "TEXT_LINES":
			return (
				Object.keys(location).length === 3 &&
				isPositiveInteger(location.lineStart) &&
				isPositiveInteger(location.lineEnd) &&
				location.lineEnd >= location.lineStart
			);
		case "PAGE":
			return (
				Object.keys(location).every((key) =>
					["kind", "pageNumber", "blockIndex", "pageMode"].includes(key),
				) &&
				isPositiveInteger(location.pageNumber) &&
				optionalPositiveInteger(location.blockIndex) &&
				(location.pageMode === "LAYOUT" || location.pageMode === "SECTION_APPROXIMATE")
			);
		case "SHEET":
			return (
				Object.keys(location).every((key) =>
					["kind", "sheetIndex", "sheetName", "cellRange"].includes(key),
				) &&
				isPositiveInteger(location.sheetIndex) &&
				optionalNonBlankString(location.sheetName) &&
				optionalNonBlankString(location.cellRange)
			);
		case "SECTION":
			return (
				Object.keys(location).every((key) =>
					["kind", "sectionIndex", "label", "blockIndex"].includes(key),
				) &&
				isPositiveInteger(location.sectionIndex) &&
				optionalNonBlankString(location.label) &&
				optionalPositiveInteger(location.blockIndex)
			);
		default:
			return false;
	}
}

export function normalizeSourceText(originalText: string): string {
	const lines = originalText
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.replace(/^[\t ]+|[\t ]+$/g, ""));
	while (lines[0] === "") {
		lines.shift();
	}
	while (lines.at(-1) === "") {
		lines.pop();
	}
	return lines.join("\n").normalize("NFC");
}

export async function hashParsedSourceSpan(originalText: string): Promise<string> {
	return sha256Hex(UTF8_ENCODER.encode(originalText).buffer);
}

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

export async function hashParsedDocument(spans: ParsedSourceSpan[]): Promise<string> {
	const canonical = JSON.stringify(
		spans.map((span) => ({
			ordinal: span.ordinal,
			location: canonicalLocation(span.location),
			originalTextSha256: span.originalTextSha256,
			normalizedText: span.normalizedText,
		})),
	);
	return sha256Hex(UTF8_ENCODER.encode(canonical).buffer);
}

export function assertParsedSourceSpans(spans: ParsedSourceSpan[]): void {
	if (spans.length === 0) {
		throw new DocumentParseError("EMPTY_SOURCE");
	}
	if (spans.length > PARSER_LIMITS.maxSpans) {
		throw new DocumentParseError("PARSE_LIMIT_EXCEEDED");
	}

	let totalOriginalBytes = 0;
	let totalNormalizedBytes = 0;
	for (const [index, span] of spans.entries()) {
		if (
			span.ordinal !== index + 1 ||
			!isSourceLocation(span.location) ||
			!/[\S]/u.test(span.originalText) ||
			!/[\S]/u.test(span.normalizedText)
		) {
			throw new DocumentParseError("PARSE_FAILED");
		}
		const originalBytes = UTF8_ENCODER.encode(span.originalText).byteLength;
		const normalizedBytes = UTF8_ENCODER.encode(span.normalizedText).byteLength;
		if (
			originalBytes > PARSER_LIMITS.maxSpanUtf8Bytes ||
			normalizedBytes > PARSER_LIMITS.maxSpanUtf8Bytes
		) {
			throw new DocumentParseError("PARSE_LIMIT_EXCEEDED");
		}
		totalOriginalBytes += originalBytes;
		totalNormalizedBytes += normalizedBytes;
	}
	if (
		totalOriginalBytes > PARSER_LIMITS.maxTotalUtf8Bytes ||
		totalNormalizedBytes > PARSER_LIMITS.maxTotalUtf8Bytes
	) {
		throw new DocumentParseError("PARSE_LIMIT_EXCEEDED");
	}
}

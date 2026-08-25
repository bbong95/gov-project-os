import { sha256Hex } from "../documents/rfp-original";
import type { StorageProvider } from "../storage/storage-provider";
import { StorageProviderError } from "../storage/storage-provider";
import {
	DocumentParseError,
	type ParsedDocumentFormat,
	type ParsedDocumentWarning,
	type SourceLocation,
} from "./document-parser";
import type { ParserRegistry } from "./parser-registry";
import {
	assertParsedSourceSpans,
	hashParsedDocument,
	hashParsedSourceSpan,
	isSourceLocation,
} from "./source-span";

export type RfpParseDocument = {
	id: string;
	originalFilename: string;
	mediaType: string;
	storageBucket: string;
	storagePath: string;
	sha256: string;
};

type PersistenceSpan = {
	ordinal: number;
	location: SourceLocation;
	originalText: string;
	normalizedText: string;
};

export type PreparedRfpParse = {
	target_document_id: string;
	target_source_sha256: string;
	target_parser_key: string;
	target_parser_version: string;
	target_normalization_version: string;
	target_detected_format: ParsedDocumentFormat;
	target_warnings: ParsedDocumentWarning[];
	target_result_sha256: string;
	target_spans: PersistenceSpan[];
};

function validWarnings(warnings: ParsedDocumentWarning[]): boolean {
	return warnings.every(
		(warning) =>
			/^[A-Z][A-Z0-9_]{0,127}$/.test(warning.code) &&
			(warning.location === undefined || isSourceLocation(warning.location)),
	);
}

export async function prepareRfpParse(
	document: RfpParseDocument,
	storage: StorageProvider,
	registry: ParserRegistry,
): Promise<PreparedRfpParse> {
	try {
		const blob = await storage.downloadObject(document.storageBucket, document.storagePath);
		const bytes = await blob.arrayBuffer();
		if ((await sha256Hex(bytes)) !== document.sha256) {
			throw new DocumentParseError("SOURCE_INTEGRITY_FAILED");
		}

		const { canonicalMimeType, parser } = registry.resolve(document.originalFilename);
		const parsed = await parser.parse({
			documentId: document.id,
			originalFilename: document.originalFilename,
			canonicalMimeType,
			sourceSha256: document.sha256,
			bytes,
		});
		assertParsedSourceSpans(parsed.spans);
		if (!validWarnings(parsed.warnings)) {
			throw new DocumentParseError("PARSE_FAILED");
		}
		for (const span of parsed.spans) {
			if ((await hashParsedSourceSpan(span.originalText)) !== span.originalTextSha256) {
				throw new DocumentParseError("PARSE_FAILED");
			}
		}
		if ((await hashParsedDocument(parsed.spans)) !== parsed.resultSha256) {
			throw new DocumentParseError("PARSE_FAILED");
		}

		return {
			target_document_id: document.id,
			target_source_sha256: document.sha256,
			target_parser_key: parsed.parserKey,
			target_parser_version: parsed.parserVersion,
			target_normalization_version: parsed.normalizationVersion,
			target_detected_format: parsed.detectedFormat,
			target_warnings: parsed.warnings,
			target_result_sha256: parsed.resultSha256,
			target_spans: parsed.spans.map((span) => ({
				ordinal: span.ordinal,
				location: span.location,
				originalText: span.originalText,
				normalizedText: span.normalizedText,
			})),
		};
	} catch (error) {
		if (error instanceof DocumentParseError) {
			throw error;
		}
		if (error instanceof StorageProviderError) {
			throw new DocumentParseError("PARSE_FAILED");
		}
		throw new DocumentParseError("PARSE_FAILED");
	}
}

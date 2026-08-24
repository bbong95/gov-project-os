export const PARSER_LIMITS = {
	maxSpans: 20_000,
	maxSpanUtf8Bytes: 256 * 1024,
	maxTotalUtf8Bytes: 16 * 1024 * 1024,
} as const;

export type SourceLocation =
	| { kind: "TEXT_LINES"; lineStart: number; lineEnd: number }
	| {
			kind: "PAGE";
			pageNumber: number;
			blockIndex?: number;
			pageMode: "LAYOUT" | "SECTION_APPROXIMATE";
	  }
	| { kind: "SHEET"; sheetIndex: number; sheetName?: string; cellRange?: string }
	| { kind: "SECTION"; sectionIndex: number; label?: string; blockIndex?: number };

export type ParsedSourceSpan = {
	ordinal: number;
	location: SourceLocation;
	originalText: string;
	normalizedText: string;
	originalTextSha256: string;
};

export type ParseInput = {
	documentId: string;
	originalFilename: string;
	canonicalMimeType: string;
	sourceSha256: string;
	bytes: ArrayBuffer;
};

export type ParsedDocumentFormat = "txt" | "hwp" | "hwpx" | "pdf" | "xlsx" | "docx";

export type ParsedDocumentWarning = {
	code: string;
	location?: SourceLocation;
};

export type ParsedDocument = {
	parserKey: string;
	parserVersion: string;
	normalizationVersion: string;
	detectedFormat: ParsedDocumentFormat;
	warnings: ParsedDocumentWarning[];
	spans: ParsedSourceSpan[];
	resultSha256: string;
};

export interface DocumentParser {
	supports(mimeType: string): boolean;
	parse(input: ParseInput): Promise<ParsedDocument>;
}

export type DocumentParseErrorCode =
	| "UNSUPPORTED_FORMAT"
	| "INVALID_TEXT_ENCODING"
	| "EMPTY_SOURCE"
	| "SOURCE_INTEGRITY_FAILED"
	| "PARSE_LIMIT_EXCEEDED"
	| "PARSE_FAILED";

const ERROR_MESSAGES: Record<DocumentParseErrorCode, string> = {
	UNSUPPORTED_FORMAT: "The document format is not supported for parsing.",
	INVALID_TEXT_ENCODING: "The text document is not valid UTF-8.",
	EMPTY_SOURCE: "The document contains no source text.",
	SOURCE_INTEGRITY_FAILED: "The stored original did not match its immutable hash.",
	PARSE_LIMIT_EXCEEDED: "The parsed document exceeded a fixed safety limit.",
	PARSE_FAILED: "The document could not be parsed.",
};

export class DocumentParseError extends Error {
	readonly code: DocumentParseErrorCode;

	constructor(code: DocumentParseErrorCode) {
		super(ERROR_MESSAGES[code]);
		this.name = "DocumentParseError";
		this.code = code;
	}
}

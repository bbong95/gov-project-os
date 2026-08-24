import {
	DocumentParseError,
	type DocumentParser,
	type ParseInput,
	type ParsedDocument,
	type ParsedSourceSpan,
} from "./document-parser";
import {
	assertParsedSourceSpans,
	hashParsedDocument,
	hashParsedSourceSpan,
	normalizeSourceText,
} from "./source-span";

const PARSER_KEY = "plain-text";
const PARSER_VERSION = "1.0.0";
const NORMALIZATION_VERSION = "nfc-lines-v1";

type DecodedLine = {
	lineNumber: number;
	start: number;
	contentEnd: number;
	isBlank: boolean;
};

function decodedLines(text: string): DecodedLine[] {
	const lines: DecodedLine[] = [];
	let start = 0;
	let lineNumber = 1;

	while (start < text.length) {
		let contentEnd = start;
		while (contentEnd < text.length && text[contentEnd] !== "\r" && text[contentEnd] !== "\n") {
			contentEnd += 1;
		}
		lines.push({
			lineNumber,
			start,
			contentEnd,
			isBlank: text.slice(start, contentEnd).trim().length === 0,
		});

		if (contentEnd >= text.length) {
			start = contentEnd;
		} else if (text[contentEnd] === "\r" && text[contentEnd + 1] === "\n") {
			start = contentEnd + 2;
		} else {
			start = contentEnd + 1;
		}
		lineNumber += 1;
	}

	return lines;
}

async function paragraphSpans(text: string): Promise<ParsedSourceSpan[]> {
	const lines = decodedLines(text);
	const spans: ParsedSourceSpan[] = [];
	let cursor = 0;

	while (cursor < lines.length) {
		while (cursor < lines.length && lines[cursor]?.isBlank) {
			cursor += 1;
		}
		if (cursor >= lines.length) {
			break;
		}

		const first = lines[cursor];
		let last = first;
		while (cursor < lines.length && !lines[cursor]?.isBlank) {
			last = lines[cursor];
			cursor += 1;
		}
		if (!first || !last) {
			throw new DocumentParseError("PARSE_FAILED");
		}

		const originalText = text.slice(first.start, last.contentEnd);
		const normalizedText = normalizeSourceText(originalText);
		spans.push({
			ordinal: spans.length + 1,
			location: {
				kind: "TEXT_LINES",
				lineStart: first.lineNumber,
				lineEnd: last.lineNumber,
			},
			originalText,
			normalizedText,
			originalTextSha256: await hashParsedSourceSpan(originalText),
		});
	}

	return spans;
}

export class PlainTextDocumentParser implements DocumentParser {
	supports(mimeType: string): boolean {
		return mimeType === "text/plain";
	}

	async parse(input: ParseInput): Promise<ParsedDocument> {
		if (!this.supports(input.canonicalMimeType) || !input.originalFilename.toLowerCase().endsWith(".txt")) {
			throw new DocumentParseError("UNSUPPORTED_FORMAT");
		}

		let decoded: string;
		try {
			decoded = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
		} catch {
			throw new DocumentParseError("INVALID_TEXT_ENCODING");
		}
		const text = decoded.startsWith("\uFEFF") ? decoded.slice(1) : decoded;
		const spans = await paragraphSpans(text);
		assertParsedSourceSpans(spans);

		return {
			parserKey: PARSER_KEY,
			parserVersion: PARSER_VERSION,
			normalizationVersion: NORMALIZATION_VERSION,
			detectedFormat: "txt",
			warnings: [],
			spans,
			resultSha256: await hashParsedDocument(spans),
		};
	}
}

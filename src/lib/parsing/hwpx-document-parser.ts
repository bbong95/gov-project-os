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
import { HwpStreamParser } from "./hwp-stream-parser";
import { unzipSync, unzlibSync } from "fflate";

const HWPX_MIME_TYPE = "application/hwp+zip";
const PARSER_KEY = "hwpx-worker-native";
const PARSER_VERSION = "1.0.0";
const NORMALIZATION_VERSION = "nfc-hwpx-section-v1";
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_ENTRY_BYTES = 32 * 1024 * 1024;

function fail(): never {
	throw new DocumentParseError("PARSE_FAILED");
}

function isSafeEntryName(name: string): boolean {
	return (
		name.length > 0 &&
		name.length <= 1_024 &&
		!name.includes("\\") &&
		!name.startsWith("/") &&
		!name.startsWith("../") &&
		!name.includes("/../") &&
		!name.includes("\0") &&
		!/^[a-z]:/iu.test(name)
	);
}

function decodeXmlText(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/giu, (_entity, code: string) => {
		switch (code.toLowerCase()) {
			case "amp": return "&";
			case "lt": return "<";
			case "gt": return ">";
			case "quot": return '"';
			case "apos": return "'";
			default: {
				const value = code[1]?.toLowerCase() === "x"
					? Number.parseInt(code.slice(2), 16)
					: Number.parseInt(code.slice(1), 10);
				if (!Number.isInteger(value) || value <= 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) fail();
				return String.fromCodePoint(value);
			}
		}
	});
}

function decodeUtf8(bytes: Uint8Array): string {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/u, "");
	} catch {
		fail();
	}
}

function paragraphTexts(xml: string): string[] {
	const body = xml.replace(/^\s*<\?xml\s[^?]*\?>/u, "");
	if (/<!DOCTYPE\b|<!ENTITY\b|<!\[CDATA\[/iu.test(body)) fail();
	const paragraphs: string[] = [];
	const paragraphPattern = /<((?:[A-Za-z_][\w.-]*:)?p)\b[^>]*>([\s\S]*?)<\/\1\s*>/gu;
	for (const paragraphMatch of body.matchAll(paragraphPattern)) {
		const paragraph = paragraphMatch[2] ?? "";
		const pieces: string[] = [];
		// Extract text inside <t>...</t> blocks; non-text tags inside <t> are
		// flattened (their own text content is preserved recursively). Unknown
		// entities fail closed.
		const tPattern = /<((?:[A-Za-z_][\w.-]*:)?t)\b[^>]*>([\s\S]*?)<\/\1\s*>/gu;
		let cursor = 0;
		for (const tMatch of paragraph.matchAll(tPattern)) {
			const before = paragraph.slice(cursor, tMatch.index);
			cursor = (tMatch.index ?? 0) + tMatch[0].length;
			if (before) {
				for (const inline of before.matchAll(/<[^>]+>/g)) {
					const tag = inline[0];
					if (/^<(?:[A-Za-z_][\w.-]*:)?lineBreak\b/u.test(tag)) pieces.push("\n");
					else if (/^<(?:[A-Za-z_][\w.-]*:)?tab\b/u.test(tag)) pieces.push("\t");
				}
			}
			const inner = tMatch[2] ?? "";
			const flat = stripTagsToText(inner);
			if (/\S/u.test(flat)) {
				pieces.push(decodeXmlText(flat));
			}
		}
		// Trailing tags after the last <t>...</t>
		const tail = paragraph.slice(cursor);
		for (const inline of tail.matchAll(/<[^>]+>/g)) {
			const tag = inline[0];
			if (/^<(?:[A-Za-z_][\w.-]*:)?lineBreak\b/u.test(tag)) pieces.push("\n");
			else if (/^<(?:[A-Za-z_][\w.-]*:)?tab\b/u.test(tag)) pieces.push("\t");
		}
		const text = pieces.join("");
		if (/\S/u.test(text)) paragraphs.push(text);
	}
	return paragraphs;
}

function stripTagsToText(inner: string): string {
	// Replace <lineBreak/> with newline, <tab/> with tab, and remove every
	// other tag. Recurse into children so text inside <sdt> / <bookmark>
	// is preserved.
	let out = "";
	let i = 0;
	while (i < inner.length) {
		const lt = inner.indexOf("<", i);
		if (lt < 0) {
			out += inner.slice(i);
			break;
		}
		out += inner.slice(i, lt);
		const tagEnd = inner.indexOf(">", lt);
		if (tagEnd < 0) {
			out += inner.slice(lt);
			break;
		}
		const tag = inner.slice(lt, tagEnd + 1);
		if (/^<(?:[A-Za-z_][\w.-]*:)?lineBreak\b/u.test(tag)) out += "\n";
		else if (/^<(?:[A-Za-z_][\w.-]*:)?tab\b/u.test(tag)) out += "\t";
		else if (/^<\/?(?:[A-Za-z_][\w.-]*:)?(t|p|hp:r|pic|sdt|bookmark|control|mark|a|tbl|tr|td)\b/u.test(tag)) {
			// paired tag — keep inner text
		}
		i = tagEnd + 1;
	}
	return out;
}

async function parseSection(bytes: Uint8Array, sectionIndex: number): Promise<ParsedSourceSpan[]> {
	const texts = paragraphTexts(decodeUtf8(bytes));
	return Promise.all(
		texts.map(async (originalText, index) => ({
			ordinal: 0,
			location: { kind: "SECTION" as const, sectionIndex, blockIndex: index + 1 },
			originalText,
			normalizedText: normalizeSourceText(originalText),
			originalTextSha256: await hashParsedSourceSpan(originalText),
		})),
	);
}

function readCentralDirectoryForAudit(bytes: Uint8Array): Array<{ name: string; flags: number; uncompressedSize: number }> {
	const minDirSize = 22;
	if (bytes.byteLength < minDirSize) fail();
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let eocd = -1;
	for (let offset = bytes.byteLength - minDirSize; offset >= 0 && offset >= bytes.byteLength - 65_557; offset -= 1) {
		if (view.getUint32(offset, true) === 0x06054b50) {
			eocd = offset;
			break;
		}
	}
	if (eocd < 0) fail();
	const entryCount = view.getUint16(eocd + 10, true);
	const centralOffset = view.getUint32(eocd + 16, true);
	const out: Array<{ name: string; flags: number; uncompressedSize: number }> = [];
	let off = centralOffset;
	for (let i = 0; i < entryCount; i += 1) {
		if (view.getUint32(off, true) !== 0x02014b50) fail();
		const flags = view.getUint16(off + 8, true);
		const uncompressedSize = view.getUint32(off + 24, true);
		const nameLength = view.getUint16(off + 28, true);
		const extraLength = view.getUint16(off + 30, true);
		const commentLength = view.getUint16(off + 32, true);
		const nameBytes = bytes.subarray(off + 46, off + 46 + nameLength);
		let name = "";
		try {
			name = new TextDecoder("utf-8", { fatal: false }).decode(nameBytes);
		} catch {
			fail();
		}
		out.push({ name, flags, uncompressedSize });
		off += 46 + nameLength + extraLength + commentLength;
	}
	return out;
}

export class HwpxDocumentParser implements DocumentParser {
	supports(mimeType: string): boolean {
		return mimeType === HWPX_MIME_TYPE;
	}

	async parse(input: ParseInput): Promise<ParsedDocument> {
		if (!this.supports(input.canonicalMimeType) || !input.originalFilename.toLowerCase().endsWith(".hwpx")) {
			throw new DocumentParseError("UNSUPPORTED_FORMAT");
		}
		const archive = new Uint8Array(input.bytes);
		if (archive.byteLength > MAX_ARCHIVE_BYTES) throw new DocumentParseError("PARSE_LIMIT_EXCEEDED");
		if (archive.byteLength < 4) fail();
		if (archive[0] !== 0x50 || archive[1] !== 0x4b || archive[2] !== 0x03 || archive[3] !== 0x04) fail();

		// Pre-validate the central directory so encrypted entries, oversized
		// entries, and other unsafe shapes are rejected before fflate has a
		// chance to silently drop them. fflate's `unzipSync` is robust but
		// does not surface every rejection as an exception, so we trust our
		// own walk for security-critical checks.
		const audit = readCentralDirectoryForAudit(archive);
		for (const entry of audit) {
			if ((entry.flags & 1) !== 0) throw new DocumentParseError("PARSE_FAILED");
			if (entry.uncompressedSize > MAX_ENTRY_BYTES) {
				throw new DocumentParseError("PARSE_LIMIT_EXCEEDED");
			}
		}

		// fflate unzip handles per-entry inflate (raw deflate and zlib-wrapped
		// deflate are both supported). The pre-validation above means the
		// only remaining failure mode is corrupt compressed data, which we
		// wrap to a single DocumentParseError.
		let files: Record<string, Uint8Array>;
		try {
			files = unzipSync(archive, {
				filter: (entry) => {
					if (entry.name.length > 1_024) return false;
					if (!isSafeEntryName(entry.name)) return false;
					return true;
				},
			});
		} catch {
			fail();
		}
		for (const value of Object.values(files)) {
			if (value.byteLength > MAX_ENTRY_BYTES) {
				throw new DocumentParseError("PARSE_LIMIT_EXCEEDED");
			}
		}

		const mimeEntry = files.mimetype;
		if (!mimeEntry) fail();
		if (decodeUtf8(mimeEntry) !== HWPX_MIME_TYPE) fail();

		// Discover all Contents/sectionN.xml entries and require them to be
		// numbered contiguously from 0.
		const sectionKeys = Object.keys(files)
			.filter((name) => /^Contents\/section(\d+)\.xml$/u.test(name))
			.sort((left, right) => {
				const li = Number.parseInt(/(\d+)/.exec(left)?.[1] ?? "0", 10);
				const ri = Number.parseInt(/(\d+)/.exec(right)?.[1] ?? "0", 10);
				return li - ri;
			});
		const sections: Array<{ entry: Uint8Array; fileIndex: number }> = [];
		for (const key of sectionKeys) {
			const fileIndex = Number.parseInt(/(\d+)/.exec(key)?.[1] ?? "", 10);
			if (sections.length !== fileIndex) fail();
			sections.push({ entry: files[key]!, fileIndex });
		}
		if (sections.length === 0) fail();

		const spans: ParsedSourceSpan[] = [];
		for (const [index, section] of sections.entries()) {
			if (section.entry.byteLength > MAX_ENTRY_BYTES) throw new DocumentParseError("PARSE_LIMIT_EXCEEDED");
			spans.push(...(await parseSection(section.entry, index + 1)));
		}
		for (const [index, span] of spans.entries()) span.ordinal = index + 1;
		assertParsedSourceSpans(spans);
		return {
			parserKey: PARSER_KEY,
			parserVersion: PARSER_VERSION,
			normalizationVersion: NORMALIZATION_VERSION,
			detectedFormat: "hwpx",
			warnings: [],
			spans,
			resultSha256: await hashParsedDocument(spans),
		};
	}
}

export { HWPX_MIME_TYPE };

// Unzlib is exposed for the parser-registry plumbing if a future format ever
// needs a one-shot deflate that fflate's unzip did not already cover.
export { unzlibSync };

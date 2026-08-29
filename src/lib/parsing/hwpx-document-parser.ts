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

const HWPX_MIME_TYPE = "application/hwp+zip";
const PARSER_KEY = "hwpx-worker-native";
const PARSER_VERSION = "1.0.0";
const NORMALIZATION_VERSION = "nfc-hwpx-section-v1";
const MAX_ARCHIVE_ENTRIES = 4_096;
const MAX_ENTRY_BYTES = 32 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;

type ZipEntry = {
	name: string;
	flags: number;
	method: number;
	crc32: number;
	compressedSize: number;
	uncompressedSize: number;
	localHeaderOffset: number;
};

function fail(code: "PARSE_FAILED" | "PARSE_LIMIT_EXCEEDED" = "PARSE_FAILED"): never {
	throw new DocumentParseError(code);
}

function u16(view: DataView, offset: number): number {
	if (offset < 0 || offset + 2 > view.byteLength) fail();
	return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
	if (offset < 0 || offset + 4 > view.byteLength) fail();
	return view.getUint32(offset, true);
}

function safeArchivePath(name: string): boolean {
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

function decodeEntryName(bytes: Uint8Array, flags: number): string {
	if ((flags & 0x800) === 0 && bytes.some((byte) => byte > 0x7f)) fail();
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return fail();
	}
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
	const minimum = 22;
	if (bytes.byteLength < minimum) return fail();
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const earliest = Math.max(0, bytes.byteLength - minimum - 65_535);
	for (let offset = bytes.byteLength - minimum; offset >= earliest; offset -= 1) {
		if (u32(view, offset) === 0x06054b50) return offset;
	}
	return fail();
}

function readZipDirectory(bytes: Uint8Array): ZipEntry[] {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const eocd = findEndOfCentralDirectory(bytes);
	const disk = u16(view, eocd + 4);
	const centralDisk = u16(view, eocd + 6);
	const entriesOnDisk = u16(view, eocd + 8);
	const entryCount = u16(view, eocd + 10);
	const centralSize = u32(view, eocd + 12);
	const centralOffset = u32(view, eocd + 16);
	const commentLength = u16(view, eocd + 20);
	if (
		disk !== 0 ||
		centralDisk !== 0 ||
		entriesOnDisk !== entryCount ||
		entryCount === 0 ||
		entryCount === 0xffff ||
		centralSize === 0xffffffff ||
		centralOffset === 0xffffffff ||
		entryCount > MAX_ARCHIVE_ENTRIES ||
		eocd + 22 + commentLength !== bytes.byteLength ||
		centralOffset + centralSize !== eocd
	) {
		return fail(entryCount > MAX_ARCHIVE_ENTRIES ? "PARSE_LIMIT_EXCEEDED" : "PARSE_FAILED");
	}

	const entries: ZipEntry[] = [];
	const names = new Set<string>();
	let totalUncompressed = 0;
	let offset = centralOffset;
	for (let index = 0; index < entryCount; index += 1) {
		if (u32(view, offset) !== 0x02014b50) return fail();
		const flags = u16(view, offset + 8);
		const method = u16(view, offset + 10);
		const crc32 = u32(view, offset + 16);
		const compressedSize = u32(view, offset + 20);
		const uncompressedSize = u32(view, offset + 24);
		const nameLength = u16(view, offset + 28);
		const extraLength = u16(view, offset + 30);
		const entryCommentLength = u16(view, offset + 32);
		const startDisk = u16(view, offset + 34);
		const localHeaderOffset = u32(view, offset + 42);
		const recordLength = 46 + nameLength + extraLength + entryCommentLength;
		if (offset + recordLength > centralOffset + centralSize) return fail();
		if (
			(flags & 1) !== 0 ||
			(method !== 0 && method !== 8) ||
			startDisk !== 0 ||
			compressedSize === 0xffffffff ||
			uncompressedSize === 0xffffffff ||
			localHeaderOffset === 0xffffffff
		) {
			return fail();
		}
		if (uncompressedSize > MAX_ENTRY_BYTES) return fail("PARSE_LIMIT_EXCEEDED");
		if (
			uncompressedSize > 0 &&
			(compressedSize === 0 || uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO)
		) {
			return fail("PARSE_LIMIT_EXCEEDED");
		}
		totalUncompressed += uncompressedSize;
		if (totalUncompressed > MAX_ARCHIVE_BYTES) return fail("PARSE_LIMIT_EXCEEDED");

		const name = decodeEntryName(bytes.subarray(offset + 46, offset + 46 + nameLength), flags);
		if (!safeArchivePath(name) || names.has(name)) return fail();
		names.add(name);
		entries.push({
			name,
			flags,
			method,
			crc32,
			compressedSize,
			uncompressedSize,
			localHeaderOffset,
		});
		offset += recordLength;
	}
	if (offset !== centralOffset + centralSize) return fail();
	return entries;
}

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRawBounded(compressed: Uint8Array, expectedSize: number): Promise<Uint8Array> {
	let stream: ReadableStream<Uint8Array>;
	try {
		stream = new Blob([Uint8Array.from(compressed).buffer]).stream().pipeThrough(
			new DecompressionStream("deflate-raw" as CompressionFormat),
		);
	} catch {
		return fail();
	}
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > expectedSize || total > MAX_ENTRY_BYTES) {
				await reader.cancel();
				return fail("PARSE_LIMIT_EXCEEDED");
			}
			chunks.push(value);
		}
	} catch {
		return fail();
	}
	if (total !== expectedSize) return fail();
	const output = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return output;
}

async function readZipEntry(archive: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
	const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
	const offset = entry.localHeaderOffset;
	if (u32(view, offset) !== 0x04034b50) return fail();
	const localFlags = u16(view, offset + 6);
	const localMethod = u16(view, offset + 8);
	const nameLength = u16(view, offset + 26);
	const extraLength = u16(view, offset + 28);
	if ((localFlags & 1) !== 0 || localFlags !== entry.flags || localMethod !== entry.method) return fail();
	const nameStart = offset + 30;
	const dataStart = nameStart + nameLength + extraLength;
	const dataEnd = dataStart + entry.compressedSize;
	if (dataEnd > archive.byteLength) return fail();
	const localName = decodeEntryName(archive.subarray(nameStart, nameStart + nameLength), localFlags);
	if (localName !== entry.name) return fail();
	const compressed = archive.subarray(dataStart, dataEnd);
	const output = entry.method === 0
		? new Uint8Array(compressed)
		: await inflateRawBounded(compressed, entry.uncompressedSize);
	if (output.byteLength !== entry.uncompressedSize || crc32(output) !== entry.crc32) return fail();
	return output;
}

function decodeUtf8(bytes: Uint8Array): string {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/u, "");
	} catch {
		return fail();
	}
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
				if (!Number.isInteger(value) || value <= 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) return fail();
				return String.fromCodePoint(value);
			}
		}
	});
}

function paragraphTexts(xml: string): string[] {
	const body = xml.replace(/^\s*<\?xml\s[^?]*\?>/u, "");
	if (/<!DOCTYPE|<!ENTITY|<\?|<!\[CDATA\[/iu.test(body)) return fail();
	const paragraphs: string[] = [];
	const paragraphPattern = /<((?:[A-Za-z_][\w.-]*:)?p)\b[^>]*>([\s\S]*?)<\/\1\s*>/gu;
	for (const paragraphMatch of body.matchAll(paragraphPattern)) {
		const paragraph = paragraphMatch[2] ?? "";
		const pieces: string[] = [];
		const contentPattern = /<((?:[A-Za-z_][\w.-]*:)?t)\b[^>]*>([\s\S]*?)<\/\1\s*>|<(?:[A-Za-z_][\w.-]*:)?lineBreak\b[^>]*\/>|<(?:[A-Za-z_][\w.-]*:)?tab\b[^>]*\/>/gu;
		for (const contentMatch of paragraph.matchAll(contentPattern)) {
			const token = contentMatch[0];
			if (/lineBreak\b/u.test(token)) pieces.push("\n");
			else if (/(?:^|:)tab\b/u.test(token)) pieces.push("\t");
			else {
				const raw = contentMatch[2] ?? "";
				if (/<[^>]+>/u.test(raw) || /&(?!(?:#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);)/iu.test(raw)) return fail();
				pieces.push(decodeXmlText(raw));
			}
		}
		const text = pieces.join("");
		if (/\S/u.test(text)) paragraphs.push(text);
	}
	return paragraphs;
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

export class HwpxDocumentParser implements DocumentParser {
	supports(mimeType: string): boolean {
		return mimeType === HWPX_MIME_TYPE;
	}

	async parse(input: ParseInput): Promise<ParsedDocument> {
		if (!this.supports(input.canonicalMimeType) || !input.originalFilename.toLowerCase().endsWith(".hwpx")) {
			throw new DocumentParseError("UNSUPPORTED_FORMAT");
		}
		const archive = new Uint8Array(input.bytes);
		const entries = readZipDirectory(archive);
		const entryByName = new Map(entries.map((entry) => [entry.name, entry]));
		const mimeEntry = entryByName.get("mimetype");
		if (!mimeEntry || decodeUtf8(await readZipEntry(archive, mimeEntry)) !== HWPX_MIME_TYPE) return fail();

		const sections = entries
			.map((entry) => {
				const match = /^Contents\/section(\d+)\.xml$/u.exec(entry.name);
				return match ? { entry, fileIndex: Number.parseInt(match[1] ?? "", 10) } : undefined;
			})
			.filter((value): value is { entry: ZipEntry; fileIndex: number } => value !== undefined)
			.sort((left, right) => left.fileIndex - right.fileIndex);
		if (sections.length === 0 || sections.some((section, index) => section.fileIndex !== index)) return fail();

		const spans: ParsedSourceSpan[] = [];
		for (const [index, section] of sections.entries()) {
			spans.push(...(await parseSection(await readZipEntry(archive, section.entry), index + 1)));
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

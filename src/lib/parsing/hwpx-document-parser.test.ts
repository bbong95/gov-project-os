// @vitest-environment node

import { describe, expect, it } from "vitest";
import { syntheticHwpxBytes, SYNTHETIC_HWPX_PARAGRAPHS } from "../../../tests/support/synthetic-hwpx";
import type { ParseInput } from "./document-parser";
import { HwpxDocumentParser } from "./hwpx-document-parser";

function input(bytes: Uint8Array = syntheticHwpxBytes()): ParseInput {
	const copiedBytes = Uint8Array.from(bytes);
	return {
		documentId: "00000000-0000-4000-8000-000000000001",
		originalFilename: "synthetic-rfp.hwpx",
		canonicalMimeType: "application/hwp+zip",
		sourceSha256: "0".repeat(64),
		bytes: copiedBytes.buffer,
	};
}

function findAscii(bytes: Uint8Array, text: string, fromEnd = false): number {
	const needle = new TextEncoder().encode(text);
	const start = fromEnd ? bytes.length - needle.length : 0;
	const end = fromEnd ? 0 : bytes.length - needle.length;
	const step = fromEnd ? -1 : 1;
	for (let offset = start; fromEnd ? offset >= end : offset <= end; offset += step) {
		if (needle.every((byte, index) => bytes[offset + index] === byte)) return offset;
	}
	throw new Error("Synthetic ZIP entry not found.");
}

function replaceAllAscii(bytes: Uint8Array, before: string, after: string): Uint8Array {
	const source = new TextEncoder().encode(before);
	const replacement = new TextEncoder().encode(after);
	if (source.length !== replacement.length) throw new Error("Replacement must preserve ZIP name length.");
	const result = Uint8Array.from(bytes);
	let replacements = 0;
	for (let offset = 0; offset <= result.length - source.length; offset += 1) {
		if (source.every((byte, index) => result[offset + index] === byte)) {
			result.set(replacement, offset);
			replacements += 1;
		}
	}
	if (replacements !== 2) throw new Error("Expected local and central ZIP names.");
	return result;
}

describe("HwpxDocumentParser", () => {
	it("extracts paragraph SourceSpans from a synthetic HWPX in section order", async () => {
		const parsed = await new HwpxDocumentParser().parse(input());

		expect(parsed).toMatchObject({
			parserKey: "hwpx-worker-native",
			detectedFormat: "hwpx",
			warnings: [],
		});
		expect(parsed.spans.map((span) => span.originalText)).toEqual(SYNTHETIC_HWPX_PARAGRAPHS);
		expect(parsed.spans.map((span) => span.location)).toEqual([
			{ kind: "SECTION", sectionIndex: 1, blockIndex: 1 },
			{ kind: "SECTION", sectionIndex: 1, blockIndex: 2 },
			{ kind: "SECTION", sectionIndex: 1, blockIndex: 3 },
		]);
		expect(parsed.spans.every((span) => /^[a-f0-9]{64}$/.test(span.originalTextSha256))).toBe(true);
		expect(parsed.resultSha256).toMatch(/^[a-f0-9]{64}$/);
	});

	it("fails closed when bytes are not a ZIP archive", async () => {
		await expect(new HwpxDocumentParser().parse(input(new TextEncoder().encode("not-a-zip")))).rejects.toMatchObject({
			code: "PARSE_FAILED",
		});
	});

	it("rejects a mismatched filename or MIME type", async () => {
		await expect(
			new HwpxDocumentParser().parse({ ...input(), originalFilename: "synthetic-rfp.txt" }),
		).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
		await expect(
			new HwpxDocumentParser().parse({ ...input(), canonicalMimeType: "text/plain" }),
		).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
	});

	it("rejects encrypted ZIP entries", async () => {
		const bytes = Uint8Array.from(syntheticHwpxBytes());
		const centralName = findAscii(bytes, "Contents/section0.xml", true);
		const centralHeader = centralName - 46;
		const view = new DataView(bytes.buffer);
		view.setUint16(centralHeader + 8, view.getUint16(centralHeader + 8, true) | 1, true);

		await expect(new HwpxDocumentParser().parse(input(bytes))).rejects.toMatchObject({
			code: "PARSE_FAILED",
		});
	});

	it("rejects archive path traversal", async () => {
		const bytes = replaceAllAscii(
			syntheticHwpxBytes(),
			"Contents/section0.xml",
			"../evils/section0.xml",
		);

		await expect(new HwpxDocumentParser().parse(input(bytes))).rejects.toMatchObject({
			code: "PARSE_FAILED",
		});
	});

	it("rejects an entry whose declared size exceeds the bounded parser limit", async () => {
		const bytes = Uint8Array.from(syntheticHwpxBytes());
		const centralName = findAscii(bytes, "Contents/section0.xml", true);
		new DataView(bytes.buffer).setUint32(centralName - 46 + 24, 33 * 1024 * 1024, true);

		await expect(new HwpxDocumentParser().parse(input(bytes))).rejects.toMatchObject({
			code: "PARSE_LIMIT_EXCEEDED",
		});
	});

	it("rejects corrupted compressed content", async () => {
		const bytes = Uint8Array.from(syntheticHwpxBytes());
		const localName = findAscii(bytes, "Contents/section0.xml");
		const localHeader = localName - 30;
		const view = new DataView(bytes.buffer);
		const dataStart =
			localHeader + 30 + view.getUint16(localHeader + 26, true) + view.getUint16(localHeader + 28, true);
		bytes[dataStart + 3] = (bytes[dataStart + 3] ?? 0) ^ 0xff;

		await expect(new HwpxDocumentParser().parse(input(bytes))).rejects.toMatchObject({
			code: "PARSE_FAILED",
		});
	});
});

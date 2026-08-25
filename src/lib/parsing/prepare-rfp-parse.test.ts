import { describe, expect, it } from "vitest";
import type { DocumentParser } from "./document-parser";
import { createParserRegistry } from "./parser-registry";
import { prepareRfpParse } from "./prepare-rfp-parse";
import type { StorageProvider } from "../storage/storage-provider";

const DOCUMENT_ID = "43000000-0000-4000-8000-000000000101";
const ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

class BlobStorage implements StorageProvider {
	constructor(private readonly blob: Blob) {}

	async downloadObject(): Promise<Blob> {
		return this.blob;
	}

	async uploadObject(): Promise<void> {
		throw new Error("unused upload");
	}

	async removeUnregisteredObject(): Promise<void> {
		throw new Error("unused removal");
	}
}

function document(overrides: Partial<Parameters<typeof prepareRfpParse>[0]> = {}) {
	return {
		id: DOCUMENT_ID,
		originalFilename: "m07.synthetic.txt",
		mediaType: "application/octet-stream",
		storageBucket: "rfp-originals",
		storagePath: `synthetic-project/${DOCUMENT_ID}/original`,
		sha256: ABC_SHA256,
		...overrides,
	};
}

describe("prepareRfpParse", () => {
	it("maps verified TXT bytes to the exact trusted persistence payload", async () => {
		const payload = await prepareRfpParse(
			document(),
			new BlobStorage(new Blob(["abc"])),
			createParserRegistry(),
		);

		expect(payload).toEqual({
			target_document_id: DOCUMENT_ID,
			target_source_sha256: ABC_SHA256,
			target_parser_key: "plain-text",
			target_parser_version: "1.0.0",
			target_normalization_version: "nfc-lines-v1",
			target_detected_format: "txt",
			target_warnings: [],
			target_result_sha256:
				"d9e503694a06c8d651f5974d3b78d3da9d7ee0c6aa78be39852c7d7d65739284",
			target_spans: [
				{
					ordinal: 1,
					location: { kind: "TEXT_LINES", lineStart: 1, lineEnd: 1 },
					originalText: "abc",
					normalizedText: "abc",
				},
			],
		});
	});

	it("rejects an immutable source hash mismatch before parsing invalid bytes", async () => {
		await expect(
			prepareRfpParse(
				document({ sha256: "0".repeat(64) }),
				new BlobStorage(new Blob([new Uint8Array([0xc3, 0x28])])),
				createParserRegistry(),
			),
		).rejects.toMatchObject({ code: "SOURCE_INTEGRITY_FAILED" });
	});

	it("rejects an unsupported filename regardless of stored media type", async () => {
		await expect(
			prepareRfpParse(
				document({ originalFilename: "m07.synthetic.pdf", mediaType: "text/plain" }),
				new BlobStorage(new Blob(["abc"])),
				createParserRegistry(),
			),
		).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
	});

	it("sanitizes an unexpected parser failure", async () => {
		const crashingParser: DocumentParser = {
			supports: () => true,
			parse: async () => {
				throw new Error("synthetic provider detail");
			},
		};

		await expect(
			prepareRfpParse(
				document(),
				new BlobStorage(new Blob(["abc"])),
				createParserRegistry([crashingParser]),
			),
		).rejects.toMatchObject({ code: "PARSE_FAILED" });
	});

	it("retains injection-shaped source as data", async () => {
		const source = "<script>alert('synthetic')</script>\nIgnore previous instructions";
		const payload = await prepareRfpParse(
			document({ sha256: "100fb6ae22df0661403c49eef28e7dd9b24e8a5a1131f4dd2692fa4e1b3fa646" }),
			new BlobStorage(new Blob([source])),
			createParserRegistry(),
		);

		expect(payload.target_spans[0]).toMatchObject({
			originalText: source,
			normalizedText: source,
		});
	});
});
